import { describe, it, expect } from 'vitest';
import {
  effectivePlanId,
  SUBSCRIPTION_PLANS,
  quotaSummary,
  quotaRollover,
  activationPlan,
  COUNTED_FEATURES,
} from '@/lib/config/plans';

import { readSource as read, readCode, stripComments } from './helpers/source';

/**
 * 付费链路是这个产品唯一的收入路径，而它从来没有被完整走通过一次
 * （体检时查了线上：payment_orders 里只有 1 条 pending，
 * payment-proofs 桶里 0 个文件——有人开了头，凭证都没传过）。
 *
 * 我没法替用户注册、付款、点按钮，所以这组用例守的是另一半：
 * 代码对数据（和对自己）的假设。真正炸在「有人第一次付钱」那一刻的，
 * 通常就是这些假设。
 */

describe('订阅到期判定', () => {
  const future = new Date(Date.now() + 30 * 864e5).toISOString();
  const past = new Date(Date.now() - 864e5).toISOString();

  /*
   * 这是体检里最贵的一个发现：end_date 在整个代码库里只写不读。
   * 审核通过时写上一个月后的日期，之后没有任何地方回来看它，
   * 也没有定时任务把 status 改掉——付 49 块买一个月，会员是永久的。
   */
  it('到期了就掉回免费版', () => {
    expect(effectivePlanId({ plan: 'basic', status: 'active', end_date: past })).toBe('free');
    expect(effectivePlanId({ plan: 'pro', status: 'active', end_date: past })).toBe('free');
  });

  it('没到期照常享有权益', () => {
    expect(effectivePlanId({ plan: 'basic', status: 'active', end_date: future })).toBe('basic');
  });

  it('没有到期时间视为不过期', () => {
    // 线上现有 10 条订阅的 end_date 全是 null，含手动开的企业版。
    // 按"过期"处理会把它们当场全部误降级
    expect(effectivePlanId({ plan: 'enterprise', status: 'active', end_date: null })).toBe(
      'enterprise'
    );
    expect(effectivePlanId({ plan: 'free', status: 'active' })).toBe('free');
  });

  it('封禁（inactive）一律按免费版，且不因为 end_date 没过期就放行', () => {
    expect(effectivePlanId({ plan: 'pro', status: 'inactive', end_date: future })).toBe('free');
  });

  it('没有订阅记录就是免费版', () => {
    expect(effectivePlanId(null)).toBe('free');
    expect(effectivePlanId(undefined)).toBe('free');
  });

  it('套餐名是脏数据时兜底成免费版', () => {
    // 审核那段注释里记着：曾经用中文名凑英文 id，「基础会员」凑出「基础」，
    // 写进库后 getPlan 兜底成免费版——用户付了钱权益一点没涨，还不报错
    expect(effectivePlanId({ plan: '基础', status: 'active', end_date: future })).toBe('free');
    expect(effectivePlanId({ plan: '', status: 'active' })).toBe('free');
  });

  it('日期解析不出来时不降级——宁可少收一次，也不要误伤付费用户', () => {
    expect(effectivePlanId({ plan: 'basic', status: 'active', end_date: '不是日期' })).toBe('basic');
  });

  it('判定点都用同一个函数，不再各写一份', () => {
    for (const f of ['lib/api-guard.ts', 'app/api/quota/check/route.ts', 'lib/history.ts']) {
      const src = read(f);
      expect(src, `${f} 没用 effectivePlanId`).toContain('effectivePlanId');
      // 不取 end_date 就无从判断
      expect(src, `${f} 查询里没带上 end_date`).toMatch(/select\('plan, status, end_date'\)/);
    }
  });

  /*
   * 上面那条原来只列了 api-guard 和 quota/check 两个文件——而 lib/history.ts
   * 里还有第三份旧写法，就这么躲过去了。手写清单守不住"还有没有别处"这件事：
   * 清单是穷举，而问题恰恰出在没被穷举到的那个文件上。
   *
   * 所以这条改成全仓扫描。只看 status 不看 end_date 的写法，一处都不许有。
   */
  it('全仓没有第二处"只看 status"的旧写法', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const SKIP = new Set(['node_modules', '.next', '.git', 'tests', '编导知识大全', 'docs']);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(process.cwd());

    // 防止扫描空转：真的扫到了足够多的源文件才算数
    expect(files.length, '扫描没扫到文件，这条用例是空过的').toBeGreaterThan(80);

    const OLD = /status === 'active'\s*\?\s*\w+\.plan\s*:\s*'free'/;
    const offenders = files.filter((p) =>
      OLD.test(stripComments(fs.readFileSync(p, 'utf8')))
    );
    expect(
      offenders.map((p) => path.relative(process.cwd(), p)),
      '这些文件还在只看 status 判定套餐，到期的订阅会被当成有效'
    ).toEqual([]);
  });
});

describe('额度文案与重置逻辑一致', () => {
  /*
   * 2026-09-27 起：免费版是新账号一次性体验，全部功能都不按月重置；
   * 会员按月收费，当期没用完的到期清零。
   */
  it('免费版标明一次性，没有一行写成「次/月」', () => {
    const text = quotaSummary('free').join(' ');
    expect(text).toContain('一次性');
    expect(text).not.toContain('次/月');
    expect(text).toMatch(/脚本生成：\d+ 次/);
  });

  it('会员全部按月，没有「一次性」', () => {
    for (const id of ['basic', 'pro'] as const) {
      expect(quotaSummary(id).join(' ')).not.toContain('一次性');
      expect(quotaSummary(id).join(' ')).toContain('次/月');
    }
  });

  it('服务端拦截和首页显示用同一个换期函数', () => {
    for (const f of ['lib/api-guard.ts', 'app/api/quota/check/route.ts', 'lib/history.ts']) {
      expect(readCode(f), f).toContain('quotaRollover(subscription, quota)');
    }
    // 原来"周期过了就当满额"的写法不许再出现
    expect(readCode('app/api/quota/check/route.ts')).not.toMatch(/new Date\(\) > new Date\(quota\.current_period_end\)/);
    expect(readCode('lib/history.ts')).not.toContain('periodOver');
  });

  it('api-guard 换期后不直接放行，拿换期后的数字接着判（过期会员不能被放过一次）', () => {
    const src = readCode('lib/api-guard.ts');
    const roll = src.indexOf('quotaRollover(subscription, quota)');
    // 换期之后第一个放行只能是企业版的"不限量"，不能是换期本身
    const enterprise = src.indexOf("if (planId === 'enterprise')");
    const judge = src.indexOf('judgeQuota(planId, feature, quota)');
    expect(roll).toBeGreaterThan(0);
    expect(enterprise).toBeGreaterThan(roll);
    expect(judge).toBeGreaterThan(enterprise);
    expect(src.slice(roll, enterprise)).not.toMatch(/return \{ ok: true/);
    expect(src).toMatch(/Object\.assign\(quota, roll\.patch\)/);
  });
});

describe('换期规则（quotaRollover）', () => {
  const DAY = 864e5;
  const NOW = Date.UTC(2026, 8, 27, 4, 0, 0);
  const iso = (t: number) => new Date(t).toISOString();
  const used = (n: number) => Object.fromEntries(COUNTED_FEATURES.map((f) => [f.column, n]));
  const free = SUBSCRIPTION_PLANS.free.quotas;

  it('免费版：周期早就过了也不重置——一次性体验', () => {
    const q = { ...used(10), current_period_end: iso(NOW - 90 * DAY) };
    expect(quotaRollover(null, q, NOW)).toEqual({ kind: 'none' });
    expect(quotaRollover({ plan: 'free', status: 'active', end_date: null }, q, NOW)).toEqual({ kind: 'none' });
  });

  it('会员在有效期内、当期结束了：开新一期，计数清零', () => {
    const sub = { plan: 'basic', status: 'active', end_date: iso(NOW + 20 * DAY) };
    const r = quotaRollover(sub, { ...used(37), current_period_end: iso(NOW - DAY) }, NOW);
    expect(r.kind).toBe('renew');
    if (r.kind !== 'renew') return;
    for (const f of COUNTED_FEATURES) expect(r.patch[f.column], f.column).toBe(0);
    // 新一期不超过会员到期日：按月续费的人，额度的一期和会员的一期对得上
    expect(r.patch.current_period_end).toBe(sub.end_date);
  });

  it('会员当期还没结束：什么都不动（没用完的也不提前清）', () => {
    const sub = { plan: 'pro', status: 'active', end_date: iso(NOW + 20 * DAY) };
    expect(quotaRollover(sub, { ...used(5), current_period_end: iso(NOW + 3 * DAY) }, NOW)).toEqual({ kind: 'none' });
  });

  it('长期有效的会员（手动开的企业版等）：一期一个自然月', () => {
    const r = quotaRollover({ plan: 'enterprise', status: 'active', end_date: null }, { ...used(60), current_period_end: iso(NOW - DAY) }, NOW);
    expect(r.kind).toBe('renew');
    if (r.kind === 'renew') expect(r.patch.current_period_end).toBe('2026-10-27T04:00:00.000Z');
  });

  it('会员到期没续：剩余次数清零，也不回到免费体验额度', () => {
    const sub = { plan: 'basic', status: 'active', end_date: iso(NOW - DAY) };
    // 用量要低于每一项的免费上限才看得出"抬上去"：最小的是前采建档 3 次
    const r = quotaRollover(sub, { ...used(2), current_period_end: iso(NOW - DAY) }, NOW);
    expect(r.kind).toBe('expire');
    if (r.kind !== 'expire') return;
    // 每个计数抬到免费版上限 → 免费版这一档也是 0 次可用
    for (const f of COUNTED_FEATURES) {
      expect(r.patch[f.column], f.column).toBe(free[f.key]);
    }
  });

  it('到期清零只写一次：已经抬满的不再重复写库', () => {
    const sub = { plan: 'pro', status: 'active', end_date: iso(NOW - DAY) };
    const full = Object.fromEntries(COUNTED_FEATURES.map((f) => [f.column, free[f.key] as number]));
    expect(quotaRollover(sub, { ...full, current_period_end: iso(NOW - DAY) }, NOW)).toEqual({ kind: 'none' });
    // 本来就用得比免费上限多的，不往回改小
    const over = { ...full, script_used: 99 };
    expect(quotaRollover(sub, over, NOW)).toEqual({ kind: 'none' });
  });

  it('封禁的不算"到期"，不动额度', () => {
    const sub = { plan: 'pro', status: 'inactive', end_date: iso(NOW - DAY) };
    expect(quotaRollover(sub, { ...used(0), current_period_end: iso(NOW - DAY) }, NOW)).toEqual({ kind: 'none' });
  });

  it('开通会员时新一期到下个月同一天，和月付的会员到期日一致', () => {
    const p = activationPlan(null, 'basic', 'monthly', NOW);
    expect(p.quotaPeriodEnd).toBe(p.endDate);
  });
});

describe('订单状态机', () => {
  const review = read('app/api/admin/orders/review/route.ts');
  const orders = read('app/api/orders/route.ts');

  it('只有传了凭证的订单才能审核', () => {
    // pending 是还没传凭证，approved/rejected 是审过了，都不该再审
    expect(review).toMatch(/order\.status !== 'reviewing'/);
    expect(review).toContain('用户还没上传转账凭证');
    expect(review).toContain('该订单已通过审核');
  });

  it('金额由服务端按套餐算，不采信前端传的价', () => {
    // 否则改个请求体就能 1 块钱开企业版
    expect(orders).toMatch(/const amount = plan\.price;/);
    expect(orders).not.toMatch(/body\.amount|body\.price/);
  });

  it('免费版不能下单', () => {
    expect(orders).toMatch(/planId === 'free'/);
  });

  it('凭证路径必须落在下单人自己的目录下', () => {
    // 存储桶的策略管得住"谁能传"，管不住"订单里填谁的路径"——
    // 不校验就能借别人的转账截图过审
    expect(orders).toMatch(/startsWith\(`\$\{guard\.userId\}\/`\)/);
  });

  it('改订单只能改自己的、且只在未审阶段', () => {
    expect(orders).toMatch(/\.eq\('user_id', guard\.userId!\)/);
    expect(orders).toMatch(/\.in\('status', \['pending', 'reviewing'\]\)/);
  });

  it('开通会员用订单上的 plan_id，不是拿中文名去凑', () => {
    expect(review).toMatch(/const planId = order\.plan_id/);
    expect(review).toMatch(/planId in SUBSCRIPTION_PLANS/);
    // 注释里记着当初的错法，所以要看去掉注释之后的代码
    expect(readCode('app/api/admin/orders/review/route.ts')).not.toContain("replace('会员'");
  });

  it('开通失败必须报错，不能只记日志', () => {
    // 默默记日志的话，管理员以为审核成功了，用户却什么都没得到
    const block = review.slice(review.indexOf('if (subError)'), review.indexOf('if (subError)') + 400);
    expect(block).toContain('status: 500');
    expect(block).toContain('开通会员失败');
  });

  it('开通后重置额度，覆盖所有计费功能', async () => {
    // 不重置的话，用户升级后带着上个周期用满的数字进来，
    // 交了钱却立刻显示额度已用完
    expect(review).toMatch(/for \(const f of COUNTED_FEATURES\) resetColumns\[f\.column\] = 0/);
    expect(review).toMatch(/current_period_end/);
    /*
     * 这里原来是 expect(review).toContain('knowledge_used')。
     * 上一版能通过，靠的是审核代码里**一行注释**恰好提到了 knowledge_used——
     * 注释删掉它就红，而逻辑一点没变。改成断言真正要保证的事：
     * 那个循环覆盖的计费功能里包含知识库。
     */
    const { COUNTED_FEATURES } = await import('@/lib/config/plans');
    expect(COUNTED_FEATURES.map((f) => f.column)).toContain('knowledge_used');
  });
});

/**
 * 审核通过后，到期日和额度周期怎么算。
 *
 * 原来的两个坑（都会让付了钱的人吃亏，而且不报错）：
 *   1. 到期日从"现在"起算——提前续费会吞掉已付费的剩余天数
 *   2. 额度周期被设成和订阅一样长——**年付用户一整年只有一个月额度**
 * 修之前线上还没有人买过年付，所以没人中招；这组用例确保以后也不会。
 */
describe('开通与续费', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-09-24T12:00:00Z');
  const iso = (ms: number) => new Date(ms).toISOString();

  it('同款续费、还没到期：从原到期日往后顺延，剩余天数不丢', async () => {
    const { activationPlan } = await import('@/lib/config/plans');
    const end = NOW + 20 * DAY; // 还剩 20 天
    const p = activationPlan({ plan: 'pro', status: 'active', end_date: iso(end) }, 'pro', 'monthly', NOW);
    expect(p.isRenewal).toBe(true);
    // 新到期日 = 原到期日 + 1 个月，而不是 今天 + 1 个月
    const newEnd = Date.parse(p.endDate!);
    expect(newEnd - end, '新到期日没有从原到期日起算').toBeGreaterThanOrEqual(28 * DAY);
    expect(newEnd, '剩余的 20 天被吞掉了').toBeGreaterThan(NOW + 45 * DAY);
  });

  it('同款续费不清零额度——他还在当前这一轮里', async () => {
    const { activationPlan } = await import('@/lib/config/plans');
    const p = activationPlan({ plan: 'pro', status: 'active', end_date: iso(NOW + 5 * DAY) }, 'pro', 'monthly', NOW);
    expect(p.resetQuota).toBe(false);
  });

  it('升级：从现在起算，额度清零（价格页写明"升级后立即生效"）', async () => {
    const { activationPlan } = await import('@/lib/config/plans');
    const p = activationPlan({ plan: 'basic', status: 'active', end_date: iso(NOW + 20 * DAY) }, 'pro', 'monthly', NOW);
    expect(p.isRenewal).toBe(false);
    expect(p.resetQuota).toBe(true);
    expect(Date.parse(p.endDate!)).toBeLessThan(NOW + 32 * DAY);
  });

  it('已过期再买：从现在起算，不从过去的到期日顺延', async () => {
    const { activationPlan } = await import('@/lib/config/plans');
    const p = activationPlan({ plan: 'pro', status: 'active', end_date: iso(NOW - 10 * DAY) }, 'pro', 'monthly', NOW);
    expect(p.isRenewal).toBe(false);
    expect(Date.parse(p.endDate!)).toBeGreaterThan(NOW + 27 * DAY);
  });

  it('长期有效的会员又付了一次：保持长期有效，不能反而变成会过期', async () => {
    const { activationPlan } = await import('@/lib/config/plans');
    const p = activationPlan({ plan: 'enterprise', status: 'active', end_date: null }, 'enterprise', 'monthly', NOW);
    expect(p.endDate).toBeNull();
  });

  it('改规则前提交的年付单照样按年开通，但额度一期仍是一个月', async () => {
    // 现在只卖月付；这条守的是已经付了年费、还没审的老单
    const { activationPlan, addOneMonth } = await import('@/lib/config/plans');
    const p = activationPlan(null, 'basic', 'yearly', NOW);
    expect(Date.parse(p.endDate!)).toBeGreaterThan(NOW + 360 * DAY);
    // 额度周期若跟着订阅走，年付用户一年只有一个月额度
    expect(p.quotaPeriodEnd).toBe(addOneMonth(NOW));
  });

  it('只卖月付：下单接口和支付页都不再开年付', () => {
    const orders = readCode('app/api/orders/route.ts');
    expect(orders).toMatch(/const cycle = 'monthly';/);
    expect(orders).not.toMatch(/yearlyPrice/);
    for (const f of ['app/payment/page.tsx', 'app/dashboard/membership/page.tsx', 'app/pricing/page.tsx', 'app/admin/settings/page.tsx']) {
      expect(readCode(f), f).not.toMatch(/yearlyPrice|setBillingCycle|年付 ¥/);
    }
    expect(Object.values(SUBSCRIPTION_PLANS).some((p) => 'yearlyPrice' in p)).toBe(false);
  });

  it('复用待付订单时按本人过滤（不赌行级权限一直开着）', () => {
    const orders = readCode('app/api/orders/route.ts');
    expect(orders).toMatch(/\.from\('payment_orders'\)\s*\.select\('\*'\)\s*\.eq\('user_id', guard\.userId!\)\s*\.eq\('plan_id', planId\)/);
  });

  it('审核代码用的是 activationPlan，没有再自己算"现在 + 一个月"', () => {
    // 去掉注释再查：注释里会复述旧写法用来解释，不能让它干扰判断
    const code = readCode('app/api/admin/orders/review/route.ts');
    expect(code).toContain('activationPlan(');
    expect(code).toContain('plan.quotaPeriodEnd');
    // 旧写法的特征
    expect(code, '又从"现在"起算到期日了').not.toMatch(/const endDate = new Date\(\);/);
    expect(code, '额度周期又被设成订阅到期日了').not.toMatch(/current_period_end:\s*endDate/);
  });
});

/**
 * 给用户看的会员状态。会员页原来把当前套餐写死成 "free"，
 * 全站也没有任何地方显示到期时间。
 */
describe('会员状态', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-09-24T12:00:00Z');
  const iso = (ms: number) => new Date(ms).toISOString();

  it('付费有效：给出到期日和剩余天数', async () => {
    const { membershipStatus } = await import('@/lib/config/plans');
    const s = membershipStatus({ plan: 'pro', status: 'active', end_date: iso(NOW + 10 * DAY) }, NOW);
    expect(s.planId).toBe('pro');
    expect(s.daysLeft).toBe(10);
    expect(s.expired).toBeNull();
  });

  it('付费已过期：按免费版算，同时告诉用户是哪个套餐哪天过期的', async () => {
    const { membershipStatus } = await import('@/lib/config/plans');
    const s = membershipStatus({ plan: 'pro', status: 'active', end_date: iso(NOW - DAY) }, NOW);
    expect(s.planId).toBe('free');
    expect(s.expired?.planName).toBe('专业会员');
  });

  it('封禁不算"过期"——不能提示人家续费就好', async () => {
    const { membershipStatus } = await import('@/lib/config/plans');
    const s = membershipStatus({ plan: 'pro', status: 'inactive', end_date: iso(NOW - DAY) }, NOW);
    expect(s.expired).toBeNull();
  });

  it('没有到期日的付费套餐是长期有效', async () => {
    const { membershipStatus } = await import('@/lib/config/plans');
    const s = membershipStatus({ plan: 'enterprise', status: 'active', end_date: null }, NOW);
    expect(s.permanent).toBe(true);
    expect(s.daysLeft).toBeNull();
  });

  it('和服务端放行用的是同一套判定', async () => {
    const { membershipStatus, effectivePlanId } = await import('@/lib/config/plans');
    const cases = [
      { plan: 'pro', status: 'active', end_date: iso(Date.now() + DAY) },
      { plan: 'pro', status: 'active', end_date: iso(Date.now() - DAY) },
      { plan: 'basic', status: 'inactive', end_date: null },
      null,
    ];
    for (const c of cases) expect(membershipStatus(c).planId).toBe(effectivePlanId(c));
  });

  it('会员页不再把当前套餐写死', () => {
    const page = readCode('app/dashboard/membership/page.tsx');
    expect(page, '当前套餐又写死了').not.toMatch(/currentPlan\s*=\s*["']free["']/);
    expect(page).toContain('/api/account');
  });

  it('当前的付费套餐可以续费——不能因为"是当前套餐"就禁用', () => {
    const page = readCode('app/dashboard/membership/page.tsx');
    expect(page).toContain('续费');
    expect(page, '当前套餐又被一律禁用了').not.toMatch(/disabled=\{currentPlan === plan\.id\}/);
  });
});

describe('审核后写入的字段必须是库里真有的', () => {
  /*
   * 这类错只有第一个人付钱时才会炸：列名写错 → upsert 整条失败 →
   * 订单显示"已通过"，会员其实没开通。代码注释里记着已经犯过一次
   * （写成 current_period_start/end，而 subscriptions 表上没这两列）。
   *
   * 下面这张表是体检时从线上库 dump 出来的真实列，用它兜住。
   * 之后加的列要有对应的迁移：interview_used ← 20260929_interview_import.sql，breakdown_used ← 20260930_breakdown.sql，remix_used ← 20260930_remix.sql
   */
  const LIVE_COLUMNS: Record<string, string[]> = {
    subscriptions: ['created_at', 'end_date', 'id', 'plan', 'start_date', 'status', 'updated_at', 'user_id'],
    user_quotas: [
      'breakdown_used', 'created_at', 'current_period_end', 'current_period_start', 'deal_reason_used',
      'free_chat_used', 'id', 'interview_used', 'is_legacy_user', 'knowledge_used', 'last_reset_at',
      'positioning_used', 'registered_with_invitation', 'remix_used', 'review_used', 'script_used',
      'storyboard_used', 'title_used', 'topic_used', 'updated_at', 'user_id',
    ],
    payment_orders: [
      'amount', 'billing_cycle', 'created_at', 'id', 'payment_method', 'plan_id',
      'plan_name', 'proof_image_url', 'proof_uploaded_at', 'review_note', 'reviewed_at',
      'reviewer_id', 'status', 'user_id',
    ],
  };

  it('subscriptions：写入的列都存在', () => {
    for (const col of ['user_id', 'plan', 'status', 'start_date', 'end_date', 'updated_at']) {
      expect(LIVE_COLUMNS.subscriptions, `subscriptions 没有 ${col} 列`).toContain(col);
    }
  });

  it('user_quotas：重置要写的列都存在', () => {
    const { COUNTED_FEATURES } = SUBSCRIPTION_PLANS as unknown as Record<string, never>;
    void COUNTED_FEATURES;
    for (const col of ['current_period_start', 'current_period_end', 'updated_at', 'knowledge_used']) {
      expect(LIVE_COLUMNS.user_quotas, `user_quotas 没有 ${col} 列`).toContain(col);
    }
  });

  it('user_quotas：每个计费功能的列都存在', async () => {
    const { COUNTED_FEATURES } = await import('@/lib/config/plans');
    for (const f of COUNTED_FEATURES) {
      expect(LIVE_COLUMNS.user_quotas, `user_quotas 缺 ${f.column}（${f.name}）`).toContain(f.column);
    }
  });

  it('payment_orders：下单和补凭证写的列都存在', () => {
    for (const col of [
      'user_id', 'plan_id', 'plan_name', 'amount', 'billing_cycle', 'payment_method',
      'status', 'proof_image_url', 'proof_uploaded_at', 'reviewed_at', 'reviewer_id', 'review_note',
    ]) {
      expect(LIVE_COLUMNS.payment_orders, `payment_orders 没有 ${col} 列`).toContain(col);
    }
  });
});

describe('存储桶迁移与线上实际一致', () => {
  const sql = read('supabase/migrations/20240108_storage_buckets.sql');

  it('转账凭证桶必须是私有的', () => {
    /*
     * 迁移里原本写的是 public=true。线上实际是 false（实测匿名和公开 URL
     * 都读不到，凭证是安全的），但文件和现实不符——拿这份迁移去开新环境，
     * 就会真的建出一个公开桶，转账截图对全网可见。
     */
    const block = sql.slice(sql.indexOf("'payment-proofs'"), sql.indexOf("'payment-qrcodes'"));
    expect(block, 'payment-proofs 在迁移里仍被建成公开桶').not.toMatch(/^\s*true,\s*$/m);
  });

  it('不引用不存在的 profiles 表', () => {
    // 线上没有 profiles 表（是 user_profiles）。引用它的策略要么创建失败，
    // 要么一执行就报「关系不存在」——admin-stats.ts 的注释里记着同一个坑
    expect(sql, '迁移里还在引用不存在的 profiles 表').not.toMatch(/FROM\s+profiles\b/i);
  });
});
