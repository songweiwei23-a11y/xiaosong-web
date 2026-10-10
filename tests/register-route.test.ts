import { beforeEach, describe, expect, it, vi } from 'vitest';

type Invite = { status: string; used_by: string | null; expires_at: string | null } | null;

const state = {
  invite: null as Invite,
  createUserError: null as { message: string } | null,
  claim: { ok: true, plan_type: 'free' } as { ok: boolean; plan_type?: string; reason?: string },
  createdCalls: 0,
  deletedUsers: 0,
  releasedAuthorizations: 0,
};

function chain(result: unknown, onDelete?: () => void): any {
  const p = Promise.resolve(result);
  const proxy: any = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === 'then') return p.then.bind(p);
        if (key === 'delete' && onDelete) return () => { onDelete(); return proxy; };
        return () => proxy;
      },
    }
  );
  return proxy;
}

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      if (table === 'invitation_codes') return chain({ data: state.invite, error: null });
      if (table === 'registration_authorizations') {
        return chain({ error: null }, () => { state.releasedAuthorizations += 1; });
      }
      return chain({ error: null });
    },
    rpc: async () => ({ data: [state.claim], error: null }),
    auth: {
      admin: {
        createUser: async () => {
          state.createdCalls += 1;
          if (state.createUserError) return { data: { user: null }, error: state.createUserError };
          return { data: { user: { id: 'user-1' } }, error: null };
        },
        deleteUser: async () => { state.deletedUsers += 1; return { error: null }; },
      },
    },
  }),
}));

const { POST } = await import('@/app/api/auth/register/route');

let ipSeq = 0;
function register(body: Record<string, unknown>, ip = `10.0.0.${++ipSeq}`) {
  return POST(
    new Request('https://example.test/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    })
  );
}

const GOOD = { email: 'a@example.com', password: 'abcdef', code: 'xs8af30e2k' };
const FRESH: Invite = { status: 'active', used_by: null, expires_at: null };

beforeEach(() => {
  state.invite = FRESH;
  state.createUserError = null;
  state.claim = { ok: true, plan_type: 'free' };
  state.createdCalls = 0;
  state.deletedUsers = 0;
  state.releasedAuthorizations = 0;
});

describe('注册接口：邀请码先核对，再建号', () => {
  it('码不存在：不建账号，返回统一的码错误', async () => {
    state.invite = null;
    const res = await register(GOOD);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/邀请码无效/);
    expect(state.createdCalls).toBe(0);
  });

  it('码已用过、已作废、已过期：和「码不存在」用同一句话，也不建账号', async () => {
    const variants: Invite[] = [
      { status: 'used', used_by: 'someone', expires_at: null },
      { status: 'revoked', used_by: null, expires_at: null },
      { status: 'active', used_by: null, expires_at: '2020-01-01T00:00:00Z' },
    ];
    const messages = new Set<string>();
    for (const invite of variants) {
      state.invite = invite;
      const res = await register(GOOD);
      expect(res.status).toBe(400);
      messages.add((await res.json()).error);
    }
    expect(messages.size).toBe(1);
    expect(state.createdCalls).toBe(0);
  });

  it('码里带通配符或奇怪字符：直接拒绝，不进查询', async () => {
    state.invite = FRESH;
    const res = await register({ ...GOOD, code: 'XS%' });
    expect(res.status).toBe(400);
    expect(state.createdCalls).toBe(0);
  });

  it('码有效：建号、兑换，返回成功', async () => {
    const res = await register(GOOD);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(state.createdCalls).toBe(1);
  });

  it('兑换时被别人抢先（原子兑换失败）：删掉刚建的账号', async () => {
    state.claim = { ok: false, reason: '这个邀请码已经被使用过了' };
    const res = await register(GOOD);
    expect(res.status).toBe(400);
    expect(state.deletedUsers).toBe(1);
  });
});

describe('注册接口：错误不泄露邮箱是否已注册', () => {
  it('邮箱已注册：和其它建号失败返回同一句话，并收回注册授权', async () => {
    state.createUserError = { message: 'A user with this email address has already been registered' };
    const res = await register(GOOD);
    expect(res.status).toBe(400);
    const msg = (await res.json()).error;
    expect(msg).toMatch(/可能已经注册过了/);
    expect(msg).not.toMatch(/已注册过了，直接登录|已经注册过了，直接登录/);
    expect(state.releasedAuthorizations).toBe(1);
  });

  it('密码不合要求：单独提示密码，不说邮箱的事', async () => {
    state.createUserError = { message: 'Password should be at least 6 characters' };
    const res = await register(GOOD);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/密码不符合要求/);
  });
});

describe('注册接口：限流', () => {
  it('同一 IP 短时间内的注册尝试超过 20 次：第 21 次起返回 429', async () => {
    const ip = '203.0.113.99';
    state.invite = null;
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await register(GOOD, ip)).status);
    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('IP 取代理追加的最右一段，左边伪造的不算', async () => {
    const ip = '198.51.100.7';
    state.invite = null;
    for (let i = 0; i < 20; i++) await register(GOOD, `${i}.${i}.${i}.${i}, ${ip}`);
    const res = await register(GOOD, `9.9.9.9, ${ip}`);
    expect(res.status).toBe(429);
  });
});
