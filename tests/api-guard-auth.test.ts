import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  server: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  service: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/admin-auth', () => ({
  getServerSupabase: () => state.server(),
  getServiceSupabase: () => {
    state.service();
    return { from: state.from };
  },
}));

import { requireUser, requireUserWithQuota } from '@/lib/api-guard';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';

beforeEach(() => {
  Object.values(state).forEach((mock) => mock.mockReset());
  state.server.mockResolvedValue({ auth: { getUser: state.getUser, signOut: state.signOut } });
  state.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
});

function database(subscription: unknown, quota: unknown) {
  const filters: [string, unknown][] = [];
  const inserts: unknown[] = [];
  state.from.mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return builder; }),
      maybeSingle: vi.fn(async () => ({ data: table === 'subscriptions' ? subscription : quota })),
      insert: vi.fn(async (row: unknown) => { inserts.push(row); return { error: null }; }),
    };
    return builder;
  });
  return { filters, inserts };
}

describe.each([
  ['普通 API', requireUser],
  ['生成 API', () => requireUserWithQuota('script')],
] as const)('%s 的认证故障处理', (_, guard) => {
  it('确实没有用户会话时仍返回 401', async () => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await guard();
    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: '请先登录' });
    expect(state.service).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    { name: 'AuthInvalidJwtError', message: 'invalid JWT' },
    { status: 401, message: 'unauthorized' },
    { status: 403, code: 'user_banned', message: 'user is banned' },
    { status: 400, code: 'refresh_token_not_found', message: 'refresh token not found' },
    { status: 400, code: 'bad_jwt', message: 'invalid JWT' },
  ])('明确无效的认证仍拒绝访问，返回 401：%j', async (error) => {
    state.getUser.mockResolvedValue({ data: { user: null }, error });
    const result = await guard();
    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(result.userId).toBeUndefined();
    expect(state.service).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'AuthRetryableFetchError', status: 0, message: 'network failed' },
    { name: 'TimeoutError', message: 'request timed out' },
    { name: 'AbortError', message: 'request aborted' },
    { status: 408, message: 'request timeout' },
    { status: 429, message: 'rate limit exceeded' },
    { status: 500, message: 'sensitive upstream error' },
    { status: 503, message: 'service unavailable' },
    { status: 504, message: 'gateway timeout' },
  ])('临时认证故障返回 503，既不放行也不要求退出：%j', async (error) => {
    // 即使 SDK 同时附带 user，也不得在有认证错误时放行。
    state.getUser.mockResolvedValue({ data: { user: { id: 'owner', email: 'private@example.test' } }, error });
    const result = await guard();
    expect(result.ok).toBe(false);
    expect(result.userId).toBeUndefined();
    expect(result.response?.status).toBe(503);
    expect(result.response?.headers.get('Retry-After')).toBe('5');
    expect(result.response?.headers.get('Cache-Control')).toBe('no-store');
    expect(result.response?.headers.get('Set-Cookie')).toBeNull();
    expect(await result.response?.json()).toEqual({
      error: '登录服务暂时连接不稳定，请稍后重试', code: 'AUTH_TEMPORARILY_UNAVAILABLE', retryable: true,
    });
    expect(state.service).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it('getUser 抛出网络异常时也返回可重试 503', async () => {
    state.getUser.mockRejectedValue(new TypeError('fetch failed: private upstream information'));
    const result = await guard();
    expect(result.response?.status).toBe(503);
    expect(await result.response?.text()).not.toContain('private upstream');
    expect(state.service).not.toHaveBeenCalled();
  });

  it('getUser 抛出明确失效异常时仍返回 401', async () => {
    state.getUser.mockRejectedValue({ name: 'AuthSessionMissingError', message: 'session missing' });
    expect((await guard()).response?.status).toBe(401);
    expect(state.service).not.toHaveBeenCalled();
  });
});

describe('认证成功后的权限和配额不变', () => {
  it('普通 API 返回经过认证的用户，不访问特权数据库', async () => {
    expect(await requireUser()).toEqual({ ok: true, userId: 'owner' });
    expect(state.service).not.toHaveBeenCalled();
  });

  it('订阅被停用时仍返回封禁 403', async () => {
    const { filters } = database({ plan: 'free', status: 'inactive' }, { script_used: 0 });
    const result = await requireUserWithQuota('script');
    expect(result.response?.status).toBe(403);
    expect(await result.response?.json()).toEqual({ error: '您的账户已被封禁，请联系管理员' });
    expect(filters).toEqual([['user_id', 'owner'], ['user_id', 'owner']]);
  });

  it('免费档有额度时照常放行，并只查询自己的记录', async () => {
    const { filters, inserts } = database(null, { script_used: 0 });
    expect(await requireUserWithQuota('script')).toEqual({ ok: true, userId: 'owner' });
    expect(filters).toEqual([['user_id', 'owner'], ['user_id', 'owner']]);
    expect(inserts).toEqual([]);
  });

  it('原有功能额度用完后仍返回 402', async () => {
    database(null, { script_used: SUBSCRIPTION_PLANS.free.quotas.script });
    const result = await requireUserWithQuota('script');
    expect(result.response?.status).toBe(402);
    expect(await result.response?.json()).toMatchObject({
      feature: 'script', used: SUBSCRIPTION_PLANS.free.quotas.script, limit: SUBSCRIPTION_PLANS.free.quotas.script,
    });
  });

  it('新用户仍创建自己的额度记录后放行', async () => {
    const { inserts } = database(null, null);
    expect(await requireUserWithQuota('script')).toEqual({ ok: true, userId: 'owner' });
    expect(inserts).toEqual([{ user_id: 'owner' }]);
  });
});
