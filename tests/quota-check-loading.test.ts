import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  allowed: true,
  from: vi.fn(),
  service: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => state.allowed
    ? { ok: true, userId: 'owner' }
    : { ok: false, response: Response.json({}, { status: 401 }) },
}));
vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => {
    state.service();
    return { from: state.from };
  },
}));

import { GET } from '@/app/api/quota/check/route';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

function query(result: unknown, filters: [string, unknown][]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    gte: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

beforeEach(() => {
  state.allowed = true;
  state.from.mockReset();
  state.service.mockReset();
});

describe('首页额度查询的等待和权限', () => {
  it('套餐查询未完成时，本月用量已开始查询，并且都限于已登录用户', async () => {
    const subscription = deferred<{ data: null }>();
    const started: string[] = [];
    const filters: [string, unknown][] = [];
    state.from.mockImplementation((table: string) => {
      started.push(table);
      return query(
        table === 'subscriptions' ? subscription.promise
          : table === 'usage_events' ? { count: 9, error: null }
            : { data: null },
        filters,
      );
    });

    const response = GET();
    await Promise.resolve();
    await Promise.resolve();
    const startedBeforeSubscriptionCompleted = [...started];
    subscription.resolve({ data: null });
    const body = await (await response).json();

    expect(startedBeforeSubscriptionCompleted).toEqual(['subscriptions', 'user_quotas', 'usage_events']);
    expect(filters).toEqual([['user_id', 'owner'], ['user_id', 'owner'], ['user_id', 'owner']]);
    expect(body).toMatchObject({ plan: 'free', monthUsed: 9, totalUsed: 0, exhausted: false });
  });

  it('使用事件表不可用时，仍按原规则退回统计本月历史', async () => {
    const filters: [string, unknown][] = [];
    state.from.mockImplementation((table: string) => query(
      table === 'usage_events' ? { count: null, error: { code: '42P01' } }
        : table === 'script_history' ? { count: 4, error: null }
          : { data: null },
      filters,
    ));

    const response = await GET();
    expect((await response.json()).monthUsed).toBe(4);
    expect(state.from.mock.calls.map(([table]) => table)).toEqual([
      'subscriptions', 'user_quotas', 'usage_events', 'script_history',
    ]);
    expect(filters.every(([key, value]) => key === 'user_id' && value === 'owner')).toBe(true);
  });

  it('未登录时返回 401，不创建服务端数据库客户端', async () => {
    state.allowed = false;
    expect((await GET()).status).toBe(401);
    expect(state.service).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
  });
});
