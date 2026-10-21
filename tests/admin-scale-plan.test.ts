/**
 * 后台扩展方案的执行（2026-10-22）：权限默认拒绝与按权限声明、监控按角色裁剪与缓存、
 * 告警规则与节流、生成排队与名额归还、定时任务鉴权、订单认领。
 * 外部服务都用假的，不碰真实数据库、真实 webhook 和真实模型。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hasPermission, isKnownRole, ROLE_PERMISSIONS } from '@/lib/admin-permissions';
import {
  acquireSlot,
  resetSlots,
  slotStats,
  slotOptionsFromEnv,
  SlotTimeoutError,
  SlotFullError,
  MAX_HOLD_MS,
} from '@/lib/generation-slots';
import {
  evaluateAlerts,
  dueAlerts,
  webhookBody,
  alertConfig,
  sendAlert,
  thresholdsFromEnv,
  DEFAULT_THRESHOLDS,
  THROTTLE_MS,
} from '@/lib/alerts';
import { cronRequestAuthorized } from '@/lib/cron-auth';
import { redactSnapshot, type ActiveUser, type MonitorEvent, type ViewScope } from '@/lib/monitor';
import { createTtlValue, lookupUsers, resetLookupCache } from '@/lib/admin-monitor-data';
import { adminWriteLimited } from '@/lib/admin-rate';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const ROOT = path.join(process.cwd(), 'app/api/admin');

function adminRoutes(dir = ROOT): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...adminRoutes(full));
    else if (e.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('权限：默认拒绝，每个接口都声明自己要的权限', () => {
  it('认得的角色才进后台；未知角色没有任何权限', () => {
    expect(isKnownRole('developer')).toBe(true);
    expect(isKnownRole('finance')).toBe(true);
    expect(isKnownRole('intern')).toBe(false);
    expect(hasPermission('intern', 'view_orders')).toBe(false);
    expect(hasPermission('__proto__', 'view_orders')).toBe(false);
  });

  it('现有角色的权限没有减少（开发者和管理员全部，运营保留原有读写）', () => {
    for (const perm of Object.keys(Object.fromEntries(ROLE_PERMISSIONS.admin.map((p) => [p, true])))) {
      expect(hasPermission('admin', perm as never)).toBe(true);
      expect(hasPermission('developer', perm as never)).toBe(true);
    }
    expect(hasPermission('operator', 'view_monitor')).toBe(true);
    expect(hasPermission('operator', 'view_orders')).toBe(true);
    expect(hasPermission('operator', 'view_users')).toBe(true);
    expect(hasPermission('operator', 'review_orders')).toBe(true);
    expect(hasPermission('operator', 'view_content')).toBe(true);
    // 收紧的两项（方案明确列出）：运营不看审计日志和管理员名单
    expect(hasPermission('operator', 'view_logs')).toBe(false);
    expect(hasPermission('operator', 'view_admins')).toBe(false);
  });

  it('新角色的边界：财务不看内容、客服不审单、只读分析不写入', () => {
    expect(hasPermission('finance', 'review_orders')).toBe(true);
    expect(hasPermission('finance', 'view_content')).toBe(false);
    expect(hasPermission('finance', 'manage_users')).toBe(false);
    expect(hasPermission('support', 'manage_users')).toBe(true);
    expect(hasPermission('support', 'review_orders')).toBe(false);
    expect(hasPermission('support', 'view_content')).toBe(false);
    expect(hasPermission('analyst', 'view_monitor')).toBe(true);
    expect(hasPermission('analyst', 'manage_users')).toBe(false);
    expect(hasPermission('analyst', 'view_content')).toBe(false);
  });

  it('requireAdmin 只放行认得的角色', () => {
    expect(read('lib/admin-auth.ts')).toContain('if (!isKnownRole(roleData.role)) return null;');
  });

  it('每个管理员接口都用 requireAdminPermission 声明权限；只有两处例外（返回自己角色的、用户管理的 POST）', () => {
    const exceptions = new Set(['check-role/route.ts', 'users/route.ts']);
    const bad: string[] = [];
    for (const file of adminRoutes()) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const text = fs.readFileSync(file, 'utf8');
      const plain = /(?<=await )requireAdmin\(\)/.test(text);
      const declares = /requireAdminPermission\('[a-z_]+'\)/.test(text);
      // 例外文件不要求声明（check-role 只返回自己的角色；用户管理的 POST 逐动作校验，见下一条）
      if (!declares && !exceptions.has(rel)) bad.push(`${rel}：没有声明任何权限`);
      if (plain && !exceptions.has(rel)) bad.push(`${rel}：还在只校验身份（requireAdmin）`);
    }
    expect(bad).toEqual([]);
  });

  it('用户管理的 POST 每个动作都逐一校验权限（不是只看身份）', () => {
    const users = read('app/api/admin/users/route.ts');
    expect(users).toContain('PERMISSION_FOR_ACTION');
    expect(users).toContain('hasPermission(');
  });
});

describe('监控：按角色裁剪，看不到的字段真的去掉', () => {
  const snap = () => ({
    active: [
      { id: 'u1', email: 'alice@x.com', lastAction: '脚本生成 · 主题：猫粮', online: true },
    ] as unknown as ActiveUser[],
    events: [
      {
        id: 'usage:1',
        type: 'usage',
        at: '2026-10-22T00:00:00Z',
        title: 'alice@x.com 用了「脚本生成」',
        detail: '主题：猫粮',
        summary: '主题：猫粮',
        excerpt: '结果开头……',
        level: 'info',
        user: { id: 'u1', email: 'alice@x.com', plan: '免费版' },
        ref: { kind: 'history', id: '1' },
      },
      {
        id: 'order:1',
        type: 'order',
        at: '2026-10-22T00:00:00Z',
        title: 'alice@x.com 要充值',
        detail: '基础会员（月付） ¥49 · 当前：待审核',
        level: 'urgent',
        user: { id: 'u1', email: 'alice@x.com', plan: '免费版' },
      },
    ] as unknown as MonitorEvent[],
  });

  it('有全部权限：原样返回', () => {
    const s = snap();
    expect(redactSnapshot(s, { content: true, users: true })).toBe(s);
  });

  it('没有内容权限：去掉输入摘要、结果开头、看全文入口；动态的详情也清空；订单金额保留', () => {
    const scope: ViewScope = { content: false, users: true };
    const out = redactSnapshot(snap(), scope);
    const usage = out.events[0];
    expect(usage.summary).toBeUndefined();
    expect(usage.excerpt).toBeUndefined();
    expect(usage.ref).toBeUndefined();
    expect(usage.detail).toBe('');
    expect(out.events[1].detail).toContain('¥49');
    expect(out.active[0].lastAction).toBe('脚本生成');
  });

  it('没有用户权限：邮箱打码（列表和动态标题里都打码）', () => {
    const out = redactSnapshot(snap(), { content: true, users: false });
    expect(out.active[0].email).not.toBe('alice@x.com');
    expect(out.active[0].email).toContain('@x.com');
    expect(out.events[0].title).not.toContain('alice@x.com');
    expect(out.events[0].user?.email).not.toBe('alice@x.com');
  });

  it('监控接口按当前管理员裁剪；打码和裁剪函数都在 lib 里', () => {
    const route = read('app/api/admin/monitor/route.ts');
    expect(route).toContain("hasPermission(admin.role, 'view_content')");
    expect(route).toContain("hasPermission(admin.role, 'view_users')");
    expect(route).toContain('redactSnapshot(payload');
  });
});

describe('缓存：慢的统计值每分钟算一次，失败不缓存，并发共享一次计算', () => {
  it('过期前只算一次；并发请求共享同一次计算', async () => {
    const load = vi.fn(async () => 42);
    const get = createTtlValue(60_000, load);
    const [a, b] = await Promise.all([get(), get()]);
    expect([a, b]).toEqual([42, 42]);
    expect(await get()).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('计算失败的结果不缓存，下一次重算', async () => {
    let n = 0;
    const get = createTtlValue(60_000, async () => {
      n++;
      if (n === 1) throw new Error('boom');
      return 7;
    });
    await expect(get()).rejects.toThrow('boom');
    expect(await get()).toBe(7);
    expect(n).toBe(2);
  });
});

describe('用户资料和会员：只查活跃的人，分批、短期缓存', () => {
  beforeEach(() => resetLookupCache());

  it('按人分组返回；第二次在 10 秒内不再查库', async () => {
    const seen: string[][] = [];
    const chain = (table: string) => ({
      select: () => ({
        in: async (_col: string, ids: string[]) => {
          seen.push([table, ...ids] as never);
          if (table === 'user_profiles') {
            return { data: [{ id: 'p1', user_id: 'u1', profile_name: '川菜号' }], error: null };
          }
          return { data: [{ user_id: 'u1', plan: 'pro', status: 'active', end_date: null }], error: null };
        },
      }),
    });
    const db = { from: (t: string) => chain(t) } as never;
    const out = await lookupUsers(db, ['u1', 'u2']);
    expect(out.profiles.get('u1')?.[0].profile_name).toBe('川菜号');
    expect(out.plans.get('u1')?.plan).toBe('pro');
    expect(out.profiles.has('u2')).toBe(false);
    const calls = seen.length;
    await lookupUsers(db, ['u1', 'u2']);
    expect(seen.length).toBe(calls);
  });
});

describe('告警：规则、节流、推送格式', () => {
  it('超过阈值才命中；没超过什么也不报', () => {
    expect(evaluateAlerts({ dbLatencyMs: 10, pendingReview: 0, oldestPendingMinutes: null, generationQueued: 0 })).toEqual([]);
    const hits = evaluateAlerts({ dbLatencyMs: 1200, pendingReview: 2, oldestPendingMinutes: 45, generationQueued: 60 }, DEFAULT_THRESHOLDS);
    expect(hits.map((h) => h.id).sort()).toEqual(['db-latency', 'generation-queue', 'orders-unreviewed']);
  });

  it('同一条规则节流：30 分钟内只推一次，过了再推', () => {
    const state = new Map<string, number>();
    const hit = [{ id: 'db-latency', title: 't', message: 'm' }];
    const t0 = 1_000_000;
    expect(dueAlerts(hit, state, t0)).toHaveLength(1);
    expect(dueAlerts(hit, state, t0 + THROTTLE_MS - 1)).toHaveLength(0);
    expect(dueAlerts(hit, state, t0 + THROTTLE_MS)).toHaveLength(1);
  });

  it('企业微信和飞书的消息格式不一样，各自组装', () => {
    expect(webhookBody('wecom', 'hi')).toEqual({ msgtype: 'text', text: { content: 'hi' } });
    expect(webhookBody('feishu', 'hi')).toEqual({ msg_type: 'text', content: { text: 'hi' } });
  });

  it('没配置 webhook（或不是 https）就不推送，sendAlert 返回 false 且不发请求', async () => {
    expect(alertConfig({})).toBeNull();
    expect(alertConfig({ ALERT_WEBHOOK_URL: 'http://insecure.example/x' })).toBeNull();
    const doFetch = vi.fn();
    const ok = await sendAlert({ id: 'x', title: 't', message: 'm' }, {}, doFetch as never);
    expect(ok).toBe(false);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it('配置后按格式推送；飞书用 ALERT_WEBHOOK_KIND=feishu 切换', async () => {
    const env = { ALERT_WEBHOOK_URL: 'https://hooks.example/abc', ALERT_WEBHOOK_KIND: 'feishu' };
    const doFetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const ok = await sendAlert({ id: 'x', title: '数据库变慢', message: '很慢' }, env, doFetch as never);
    expect(ok).toBe(true);
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example/abc');
    expect(JSON.parse(String(init.body)).msg_type).toBe('text');
    expect(JSON.parse(String(init.body)).content.text).toContain('数据库变慢');
  });

  it('阈值可以用环境变量改，乱填的回到默认值', () => {
    expect(thresholdsFromEnv({ ALERT_DB_LATENCY_MS: '2000' }).dbLatencyMs).toBe(2000);
    expect(thresholdsFromEnv({ ALERT_DB_LATENCY_MS: 'abc' }).dbLatencyMs).toBe(DEFAULT_THRESHOLDS.dbLatencyMs);
    expect(thresholdsFromEnv({ ALERT_DB_LATENCY_MS: '-5' }).dbLatencyMs).toBe(DEFAULT_THRESHOLDS.dbLatencyMs);
  });

  it('告警检查接口：定时任务密钥或管理员权限才能调用，且会调用告警规则', () => {
    const tick = read('app/api/admin/alerts/tick/route.ts');
    expect(tick).toContain("cronRequestAuthorized(request, 'ALERT_CRON_SECRET')");
    expect(tick).toContain("requireAdminPermission('view_monitor')");
    expect(tick).toContain('evaluateAlerts(');
    expect(tick).toContain('dueAlerts(');
  });
});

describe('定时任务鉴权：密钥至少 16 位，等长比较', () => {
  const env = { S: 'a'.repeat(16), SHORT: 'a'.repeat(8) };
  const req = (secret?: string) => new Request('http://x/', { headers: secret ? { 'x-cron-secret': secret } : {} });

  it('正确的密钥通过；错的、没带的、太短的密钥都不通过', () => {
    expect(cronRequestAuthorized(req('a'.repeat(16)), 'S', env)).toBe(true);
    expect(cronRequestAuthorized(req('b'.repeat(16)), 'S', env)).toBe(false);
    expect(cronRequestAuthorized(req(), 'S', env)).toBe(false);
    expect(cronRequestAuthorized(req('a'.repeat(8)), 'SHORT', env)).toBe(false);
    expect(cronRequestAuthorized(req('a'.repeat(16)), 'MISSING', env)).toBe(false);
  });
});

describe('生成排队：默认关闭；开启后限制全局和单用户，排队有上限和超时', () => {
  const ON = { global: 2, perUser: 1, maxWaitMs: 60_000, maxQueue: 3 };
  beforeEach(() => resetSlots());
  afterEach(() => {
    resetSlots();
    vi.useRealTimers();
  });

  it('默认关闭：不限制，也不排队', async () => {
    const off = slotOptionsFromEnv({});
    expect(off.global).toBe(0);
    const releases = await Promise.all(Array.from({ length: 10 }, () => acquireSlot('u1', off)));
    expect(releases).toHaveLength(10);
    expect(slotStats().running).toBe(0);
  });

  it('全局上限 2：第三个排队，有人归还后才进', async () => {
    const r1 = await acquireSlot('a', ON);
    const r2 = await acquireSlot('b', ON);
    let started = false;
    const pending = acquireSlot('c', ON).then((r) => {
      started = true;
      return r;
    });
    await Promise.resolve();
    expect(started).toBe(false);
    expect(slotStats().queued).toBe(1);
    r1();
    const r3 = await pending;
    expect(started).toBe(true);
    r2();
    r3();
    expect(slotStats().running).toBe(0);
  });

  it('单用户只能同时占一个：同一个人的第二个请求排队', async () => {
    const r1 = await acquireSlot('a', ON);
    let started = false;
    const pending = acquireSlot('a', ON).then((r) => {
      started = true;
      return r;
    });
    await Promise.resolve();
    expect(started).toBe(false);
    r1();
    (await pending)();
    expect(started).toBe(true);
  });

  it('排队超时：明确失败，不无限挂着', async () => {
    vi.useFakeTimers();
    await acquireSlot('a', ON);
    await acquireSlot('b', ON);
    const pending = acquireSlot('c', ON);
    vi.advanceTimersByTime(60_001);
    await expect(pending).rejects.toBeInstanceOf(SlotTimeoutError);
    expect(slotStats().queued).toBe(0);
  });

  it('队列满：直接拒绝', async () => {
    await acquireSlot('a', ON);
    await acquireSlot('b', ON);
    for (const u of ['c', 'd', 'e']) void acquireSlot(u, ON).catch(() => {});
    await expect(acquireSlot('f', ON)).rejects.toBeInstanceOf(SlotFullError);
  });

  it('优先级高的先出队', async () => {
    const first = await acquireSlot('x', { ...ON, global: 1 });
    const order: string[] = [];
    const low = acquireSlot('low', { ...ON, global: 1 }, 0).then((r) => {
      order.push('low');
      return r;
    });
    const high = acquireSlot('high', { ...ON, global: 1 }, 1).then((r) => {
      order.push('high');
      return r;
    });
    first();
    const rHigh = await high;
    expect(order).toEqual(['high']);
    rHigh();
    (await low)();
    expect(order).toEqual(['high', 'low']);
  });

  it('占用超过上限的名额会被收回，免得忘了归还的一条卡死整个队列', async () => {
    vi.useFakeTimers();
    await acquireSlot('a', ON);
    await acquireSlot('b', ON);
    vi.advanceTimersByTime(MAX_HOLD_MS + 1);
    const got = await acquireSlot('c', ON);
    expect(slotStats().running).toBe(1);
    got();
  });

  it('生成接口：拿到名额后所有结束路径都归还（成功、上游失败、流出错、外层异常）', () => {
    const route = read('app/api/dify/stream/route.ts');
    expect(route).toContain('acquireSlot(guard.userId!, slotOptionsFromEnv(), 0)');
    expect(route.match(/releaseSlot\(\);/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe('订单认领：租约、抢占、审核前检查', () => {
  it('认领是原子的：只有待审、且没人认领或租约过期或就是自己，才能认领', () => {
    const claim = read('app/api/admin/orders/claim/route.ts');
    expect(claim).toContain(".eq('status', 'reviewing')");
    expect(claim).toContain('claimed_by.is.null');
    expect(claim).toContain('claim_lease_until.lt.');
    expect(claim).toContain('LEASE_MS = 15 * 60_000');
  });

  it('审核前检查别人的认领；没迁移时这两列不存在，跳过不报错', () => {
    const review = read('app/api/admin/orders/review/route.ts');
    expect(review).toContain('order.claimed_by && order.claimed_by !== admin.userId');
    expect(review).toContain('认领处理');
  });

  it('认领列没迁移时明确告诉管理员去执行迁移', () => {
    expect(read('app/api/admin/orders/claim/route.ts')).toContain('20261022_order_claims.sql');
  });

  it('迁移文件：认领列和监控索引都是可以重复执行的', () => {
    const claims = read('supabase/migrations/20261022_order_claims.sql');
    expect(claims).toContain('add column if not exists claimed_by');
    expect(claims).toContain('add column if not exists claim_lease_until');
    const idx = read('supabase/migrations/20261022_ops_indexes.sql');
    expect(idx).toContain('create index if not exists script_history_created_idx');
    expect(idx).toContain('create index if not exists payment_orders_created_idx');
  });
});

describe('其它：看全文要理由、写操作限流、成本看板', () => {
  it('看完整记录改成 POST，理由至少 4 个字，并写进审计日志', () => {
    const rec = read('app/api/admin/monitor/record/route.ts');
    expect(rec).toContain('export async function POST(');
    expect(rec).toContain('reason.length < 4');
    expect(rec).toContain('details: { kind, recordId: id, reason }');
    const parts = read('components/admin/monitor/parts.tsx');
    expect(parts).toContain('window.prompt(');
    expect(parts).toContain('method: "POST"');
  });

  it('写操作限流：同一管理员每分钟 60 次以内放行，超过就拒绝', () => {
    const id = 'admin-rate-test-' + Math.random();
    const results = Array.from({ length: 61 }, () => adminWriteLimited(id));
    expect(results.slice(0, 60).every((x) => x === false)).toBe(true);
    expect(results[60]).toBe(true);
  });

  it('成本看板：只读，要用量查看权限，只统计板块生成的用量', () => {
    const cost = read('app/api/admin/cost/route.ts');
    expect(cost).toContain("requireAdminPermission('view_usage')");
    expect(cost).toContain('creation_completion_evidence');
    expect(cost).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });

  it('订单写操作接入了限流（审核、会员、邀请码）', () => {
    expect(read('app/api/admin/orders/review/route.ts')).toContain('adminWriteLimited(admin.userId)');
    expect(read('app/api/admin/subscriptions/route.ts')).toContain('adminWriteLimited(admin.userId)');
    expect(read('app/api/admin/invitations/route.ts')).toContain('adminWriteLimited(admin.userId)');
  });
});
