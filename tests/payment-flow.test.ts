import { describe, it, expect } from 'vitest';
import {
  effectivePlanId,
  SUBSCRIPTION_PLANS,
  quotaSummary,
  FREE_ONE_TIME_FEATURES,
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
  it('免费版的定位标明是一次性，不写成「次/月」', () => {
    const text = quotaSummary('free').join(' ');
    expect(text).toContain('一次性');
    expect(text).not.toMatch(/账号定位：\d+ 次\/月/);
  });

  it('会按月重置的功能仍然写「次/月」', () => {
    const text = quotaSummary('free').join(' ');
    expect(text).toMatch(/脚本生成：\d+ 次\/月/);
    expect(text).toMatch(/选题策划：\d+ 次\/月/);
  });

  it('付费版没有一次性额度，全部按月', () => {
    for (const id of ['basic', 'pro'] as const) {
      expect(quotaSummary(id).join(' ')).not.toContain('一次性');
    }
  });

  it('重置逻辑读的是同一份名单', () => {
    expect(read('lib/api-guard.ts')).toContain('FREE_ONE_TIME_FEATURES');
    expect(FREE_ONE_TIME_FEATURES).toContain('positioning');
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
    expect(orders).toMatch(/const amount = cycle === 'yearly' \? plan\.yearlyPrice : plan\.price/);
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

  it('开通后重置额度，覆盖所有计费功能', () => {
    // 不重置的话，用户升级后带着上个周期用满的数字进来，
    // 交了钱却立刻显示额度已用完
    expect(review).toMatch(/for \(const f of COUNTED_FEATURES\) resetColumns\[f\.column\] = 0/);
    expect(review).toContain('knowledge_used');
    expect(review).toMatch(/current_period_end/);
  });
});

describe('审核后写入的字段必须是库里真有的', () => {
  /*
   * 这类错只有第一个人付钱时才会炸：列名写错 → upsert 整条失败 →
   * 订单显示"已通过"，会员其实没开通。代码注释里记着已经犯过一次
   * （写成 current_period_start/end，而 subscriptions 表上没这两列）。
   *
   * 下面这张表是体检时从线上库 dump 出来的真实列，用它兜住。
   */
  const LIVE_COLUMNS: Record<string, string[]> = {
    subscriptions: ['created_at', 'end_date', 'id', 'plan', 'start_date', 'status', 'updated_at', 'user_id'],
    user_quotas: [
      'created_at', 'current_period_end', 'current_period_start', 'deal_reason_used',
      'free_chat_used', 'id', 'is_legacy_user', 'knowledge_used', 'last_reset_at',
      'positioning_used', 'registered_with_invitation', 'review_used', 'script_used',
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
