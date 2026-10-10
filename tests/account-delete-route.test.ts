import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  isAdmin: false,
  email: 'me@example.com' as string | null,
  purged: [] as string[],
  purgeError: null as Error | null,
};

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: 'user-2' }),
}));

vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      const data =
        table === 'admin_roles' ? null
        : table === 'user_settings' ? { is_admin: state.isAdmin }
        : null;
      const p = Promise.resolve({ data, error: null });
      const proxy: any = new Proxy({}, {
        get: (_t, key) => (key === 'then' ? p.then.bind(p) : () => proxy),
      });
      return proxy;
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: state.email ? { id: 'user-2', email: state.email } : null }, error: null }),
      },
    },
  }),
}));

vi.mock('@/lib/admin-delete-user', () => ({
  purgeUser: async (_db: unknown, userId: string) => {
    if (state.purgeError) throw state.purgeError;
    state.purged.push(userId);
    return { deleted: {}, skipped: [], files: 0 };
  },
}));

const { POST } = await import('@/app/api/account/delete/route');

const call = (confirmEmail: unknown) =>
  POST(new Request('https://example.test/api/account/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmEmail }),
  }));

beforeEach(() => {
  state.isAdmin = false;
  state.email = 'me@example.com';
  state.purged = [];
  state.purgeError = null;
});

describe('自助注销', () => {
  it('管理员账号不能自助注销，哪怕邮箱对得上', async () => {
    state.isAdmin = true;
    const res = await call('me@example.com');
    expect(res.status).toBe(403);
    expect(state.purged).toHaveLength(0);
  });

  it('没输邮箱或邮箱不对：不删任何东西', async () => {
    expect((await call('')).status).toBe(400);
    expect((await call('other@example.com')).status).toBe(400);
    expect((await call(undefined)).status).toBe(400);
    expect(state.purged).toHaveLength(0);
  });

  it('邮箱对上（忽略大小写和首尾空格）：删除当前账号的数据', async () => {
    const res = await call('  ME@example.com ');
    expect(res.status).toBe(200);
    expect(state.purged).toEqual(['user-2']);
  });

  it('删除中途失败：返回原因，账号没删，用户可以再点一次', async () => {
    state.purgeError = new Error('「works」里的数据没删掉（boom），账号还没删，可以再点一次删除');
    const res = await call('me@example.com');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/可以再点一次删除/);
  });
});
