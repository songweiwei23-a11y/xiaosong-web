import { describe, expect, it, vi } from 'vitest';
import { readCode } from './helpers/source';

const authState = { error: null as null | { name?: string; status?: number } };

vi.mock('@/lib/admin-auth', () => ({
  getServerSupabase: async () => ({
    auth: {
      getUser: async () => (authState.error
        ? { data: { user: null }, error: authState.error }
        : { data: { user: { id: 'user-1' } }, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'p1', profile_name: '档案' }], error: null }) }) }),
    }),
  }),
}));

const { GET } = await import('@/app/api/profiles/route');

describe('档案列表接口：超时不能当成「没登录」', () => {
  it('认证服务超时或断线：返回 503，页面会提示重试', async () => {
    authState.error = { name: 'AuthRetryableFetchError', status: 0 };
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it('真的没登录或会话过期：返回 401', async () => {
    authState.error = { name: 'AuthSessionMissingError', status: 400 };
    expect((await GET()).status).toBe(401);
    authState.error = { name: 'AuthApiError', status: 401 };
    expect((await GET()).status).toBe(401);
  });

  it('已登录：返回档案数组', async () => {
    authState.error = null;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'p1', profile_name: '档案' }]);
  });

  it('接口不再自己新建 Supabase 客户端（那样就没有超时保护）', () => {
    const src = readCode('app/api/profiles/route.ts');
    expect(src).not.toMatch(/createServerClient\(/);
    expect(src).toMatch(/getServerSupabase\(\)/);
  });
});

describe('切换档案弹层：卡住时要有提示和重试', () => {
  it('请求 10 秒超时，失败显示「重试」，不无限转骨架', () => {
    const src = readCode('components/dashboard/ProfileQuickSwitch.tsx');
    expect(src).toMatch(/new AbortController\(\)/);
    expect(src).toMatch(/10_000/);
    expect(src).toMatch(/setLoadError\(true\)/);
    expect(src).toMatch(/重试/);
  });
});
