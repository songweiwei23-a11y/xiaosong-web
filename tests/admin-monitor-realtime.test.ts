import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chinaDayStart, funnelWindow, loadFunnel, readAllRows, readAllUsers } from '@/lib/admin-monitor-data';
import { isToday, pulseByMinute } from '@/lib/monitor';
import { MonitorSignalBus } from '@/lib/admin-monitor-signal';

vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: vi.fn() }));
const now = Date.parse('2026-09-30T16:30:00Z'); // 北京时间 10 月 1 日 00:30

function database(tables: Record<string, any[]>, users: any[] = []) {
  const db: any = {
    rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'missing function' } })),
    auth: { admin: { listUsers: vi.fn(async ({ page, perPage }) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null })) } },
    from: (table: string) => {
      let rows = [...(tables[table] || [])];
      const q: any = {
        select: () => q, order: () => q,
        eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] === value); return q; },
        gte: (key: string, value: string) => { rows = rows.filter((r) => r[key] >= value); return q; },
        lte: (key: string, value: string) => { rows = rows.filter((r) => r[key] <= value); return q; },
        in: (key: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[key])); return q; },
        range: (from: number, to: number) => { rows = rows.slice(from, to + 1); return q; },
        then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return q;
    },
  };
  return db as SupabaseClient;
}

afterEach(() => vi.useRealTimers());
describe('完整统计与北京时间', () => {
  it('读取超过 1000 条的记录及用户，任何一页失败都不能当成 0', async () => {
    const values = Array.from({ length: 1301 }, (_, id) => ({ id }));
    const query = vi.fn(async (from, to) => ({ data: values.slice(from, to + 1), error: null }));
    expect(await readAllRows(query)).toHaveLength(1301);
    expect(query.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(await readAllUsers(database({}, values))).toHaveLength(1301);
    await expect(readAllRows(async () => ({ data: null, error: { message: 'network failure' } }))).rejects.toThrow('network failure');
  });
  it('北京零点已经过了，UTC 零点还没过；未来记录不得混入', () => {
    expect(new Date(chinaDayStart(now)).toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(funnelWindow(1, now).since).toBe('2026-09-30T16:00:00.000Z');
    expect(isToday('2026-09-30T15:59:59Z', now)).toBe(false);
    expect(isToday('2026-09-30T16:00:00Z', now)).toBe(true);
    expect(isToday('2026-09-30T17:00:00Z', now)).toBe(false);
    expect(pulseByMinute([{ created_at: '2026-09-30T17:00:00Z' }], now).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('漏斗超过 1000 人仍完整去重；排除老用户、自由对话和未审核订单', async () => {
    const at = new Date(now - 1000).toISOString();
    const users = Array.from({ length: 1301 }, (_, i) => ({ id: `u${i}`, created_at: at }));
    users.push({ id: 'old', created_at: '2020-01-01T00:00:00Z' });
    const events = users.slice(0, 1301).flatMap((u) => [1, 2].map(() => ({ kind: 'landing_view', visitor_id: u.id, created_at: at })));
    const db = database({
      funnel_events: events,
      usage_events: [
        { user_id: 'u0', feature: 'remix', created_at: at }, { user_id: 'u0', feature: 'breakdown', created_at: at },
        { user_id: 'u1', feature: 'freeChat', created_at: at }, { user_id: 'u2', feature: 'knowledge', created_at: at },
        { user_id: 'old', feature: 'script', created_at: at },
      ],
      payment_orders: [
        { user_id: 'u0', status: 'approved', created_at: '2026-09-20T00:00:00Z', reviewed_at: at },
        { user_id: 'u1', status: 'reviewing', created_at: at, reviewed_at: null },
        { user_id: 'old', status: 'approved', created_at: at, reviewed_at: at },
      ],
    }, users);
    expect((await loadFunnel(db, 1, now)).steps.map((s) => s.count)).toEqual([1301, 0, 0, 1301, 1, 1]);
  });
  it('已安装的 RPC 直接使用聚合；权限错误不悄悄走兼容路径', async () => {
    const db = database({});
    vi.mocked(db.rpc).mockResolvedValueOnce({ data: { landing_view: 2100, signup: 1200 }, error: null } as any);
    expect((await loadFunnel(db, 7, now)).steps[0].count).toBe(2100);
    vi.mocked(db.rpc).mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } } as any);
    await expect(loadFunnel(db, 7, now)).rejects.toThrow('permission denied');
  });
});

describe('实时通知生命周期', () => {
  it('共享订阅、变更即通知、一秒检查遗漏版本，最后一块屏关闭就释放连接', async () => {
    vi.useFakeTimers();
    let revision = 1;
    let onChange = () => {};
    const channel: any = { on: vi.fn((_type, _filter, callback) => { onChange = callback; return channel; }), subscribe: vi.fn((callback) => { callback('SUBSCRIBED'); return channel; }) };
    const removeChannel = vi.fn();
    const db: any = {
      channel: vi.fn(() => channel), removeChannel,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { revision, updated_at: 'now' }, error: null }) }) }) }),
    };
    const bus = new MonitorSignalBus(db);
    const a = vi.fn(), b = vi.fn();
    const offA = bus.subscribe(a), offB = bus.subscribe(b);
    await vi.advanceTimersByTimeAsync(0);
    expect(db.channel).toHaveBeenCalledTimes(1);
    a.mockClear(); b.mockClear(); onChange();
    expect(a).toHaveBeenLastCalledWith({ mode: 'realtime', error: undefined, refresh: true });
    revision++;
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.mock.calls.filter(([s]) => s.refresh)).toHaveLength(2);
    offA(); expect(removeChannel).not.toHaveBeenCalled();
    offB(); expect(removeChannel).toHaveBeenCalledTimes(1);
    const before = b.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.mock.calls).toHaveLength(before);
  });
});
