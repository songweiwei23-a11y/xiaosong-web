/**
 * 注册时的代理归属（2026-10-28）：用代理的码注册，就把新用户记到这个代理名下。
 * - 普通码（没有代理）：不记；
 * - 老库还没有 agent_id 列：注册照常完成，只是不记归属（不能因为迁移没跑就锁住注册）；
 * - 归属写失败：注册照常完成，但要记日志（不静默）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Invite = { status: string; used_by: string | null; expires_at: string | null } | null;

const state = {
  invite: null as Invite,
  agentId: null as string | null,
  agentColumnMissing: false,
  claim: { ok: true, plan_type: 'free' } as { ok: boolean; plan_type?: string },
  referrals: [] as Array<{ row: Record<string, unknown>; opts: unknown }>,
  referralError: null as { message: string } | null,
  /** 代理的状态：active / paused；null = 没有这个代理 */
  agentStatus: 'active' as string | null,
  agentStatusError: null as { message: string } | null,
  created: 0,
};

/** 其它表的写入都成功（注册授权、配额、订阅），不关心内容 */
function anyTable(): any {
  const p = Promise.resolve({ error: null });
  const proxy: any = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'then') return p.then.bind(p);
        return () => proxy;
      },
    }
  );
  return proxy;
}

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      if (table === 'invitation_codes') {
        return {
          // 注册路由读两次码：先查状态，再查 agent_id（列可能还不存在）
          select: (cols: string) => ({
            ilike: () => ({
              maybeSingle: async () => {
                if (cols.includes('agent_id')) {
                  if (state.agentColumnMissing) {
                    return { data: null, error: { message: 'column invitation_codes.agent_id does not exist' } };
                  }
                  return { data: { agent_id: state.agentId }, error: null };
                }
                return { data: state.invite, error: null };
              },
            }),
          }),
        };
      }
      if (table === 'agent_referrals') {
        return {
          upsert: async (row: Record<string, unknown>, opts: unknown) => {
            state.referrals.push({ row, opts });
            return { error: state.referralError };
          },
        };
      }
      if (table === 'agents') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.agentStatus === null ? null : { status: state.agentStatus },
                error: state.agentStatusError,
              }),
            }),
          }),
        };
      }
      return anyTable();
    },
    rpc: async () => ({ data: [state.claim], error: null }),
    auth: {
      admin: {
        createUser: async () => {
          state.created += 1;
          return { data: { user: { id: 'user-1' } }, error: null };
        },
        deleteUser: async () => ({ error: null }),
      },
    },
  }),
}));

const { POST } = await import('@/app/api/auth/register/route');

let ipSeq = 0;
function register(code: string) {
  return POST(
    new Request('https://example.test/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ipSeq}` },
      body: JSON.stringify({ email: 'new@example.com', password: 'abcdef', code }),
    })
  );
}

beforeEach(() => {
  state.invite = { status: 'active', used_by: null, expires_at: null };
  state.agentId = null;
  state.agentColumnMissing = false;
  state.claim = { ok: true, plan_type: 'free' };
  state.referrals = [];
  state.referralError = null;
  state.agentStatus = 'active';
  state.agentStatusError = null;
  state.created = 0;
  vi.restoreAllMocks();
});

describe('注册时记下代理归属', () => {
  it('代理的码：注册成功，并把新用户记到这个代理名下（第一次绑定为准）', async () => {
    state.agentId = 'agent-1';
    const res = await register('xsab12cd34');
    expect(res.status).toBe(200);
    expect(state.referrals).toEqual([
      {
        row: expect.objectContaining({ user_id: 'user-1', agent_id: 'agent-1', invitation_code: 'XSAB12CD34' }),
        opts: { onConflict: 'user_id', ignoreDuplicates: true },
      },
    ]);
  });

  it('普通码（没有代理）：注册成功，不记归属', async () => {
    state.agentId = null;
    const res = await register('xsab12cd34');
    expect(res.status).toBe(200);
    expect(state.referrals).toEqual([]);
  });

  it('老库还没有 agent_id 列：注册照常完成，只是不记归属', async () => {
    state.agentColumnMissing = true;
    const res = await register('xsab12cd34');
    expect(res.status).toBe(200);
    expect(state.referrals).toEqual([]);
  });

  it('代理已停用：它的码不能注册，也不建账号、不占用码', async () => {
    state.agentId = 'agent-1';
    state.agentStatus = 'paused';
    const res = await register('xsab12cd34');
    expect(res.status).toBe(400);
    expect(state.created).toBe(0);
    expect(state.referrals).toEqual([]);
  });

  it('代理已被删除（查不到）：同样拒绝，不建账号', async () => {
    state.agentId = 'agent-gone';
    state.agentStatus = null;
    const res = await register('xsab12cd34');
    expect(res.status).toBe(400);
    expect(state.created).toBe(0);
  });

  it('读不到代理状态：返回 503，不建账号（宁可暂时注册不了，也不放进一个停用的代理的码）', async () => {
    state.agentId = 'agent-1';
    state.agentStatusError = { message: 'connection reset' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await register('xsab12cd34');
    expect(res.status).toBe(503);
    expect(state.created).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('[auth/register] 读取代理状态失败:', 'connection reset');
  });

  it('归属写失败：注册照常完成，但记一条日志（不静默）', async () => {
    state.agentId = 'agent-1';
    state.referralError = { message: 'connection reset' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await register('xsab12cd34');
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith('[auth/register] 记录代理归属失败:', 'connection reset');
  });
});
