import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCode } from './helpers/source';

/**
 * 管理员授权（设为管理员）。
 *
 * 线上 admin_roles 表的 user_id 没有唯一约束，upsert(onConflict: 'user_id')
 * 会直接报 42P10：「there is no unique or exclusion constraint matching the ON CONFLICT specification」。
 * 这里用一张同样没有唯一约束的假表复现：只要路由又用回 onConflict，测试就红。
 */

type Row = { user_id: string; role: string };

const state = {
  roles: [] as Row[],
  users: [
    { id: 'admin-1', email: 'song.weiwei23@gmail.com' },
    { id: 'user-9', email: '2323111680@qq.com' },
  ] as { id: string; email: string }[],
};

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: async () => ({ userId: 'admin-1', role: 'admin' }),
  requireAdminPermission: async () => ({ userId: 'admin-1', role: 'admin' }),
  getServiceSupabase: () => ({
    from: (table: string) => builder(table),
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: state.users }, error: null }),
        getUserById: async (id: string) => ({
          data: { user: state.users.find((u) => u.id === id) ?? null },
          error: null,
        }),
      },
    },
  }),
}));

vi.mock('@/lib/admin-logger', () => ({
  logAdminAction: async () => {},
  AdminActions: { GRANT_ADMIN: 'grant_admin', REVOKE_ADMIN: 'revoke_admin' },
}));

type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

/** 模拟 PostgREST 的链式调用。admin_roles 没有 user_id 唯一约束，所以 upsert 必须失败 */
function builder(table: string) {
  const s: { op: Op; eqUserId: string | null; payload: any } = { op: 'select', eqUserId: null, payload: null };

  const run = async () => {
    if (table !== 'admin_roles') {
      return { data: table === 'user_settings' ? [] : null, error: null };
    }
    const matches = (r: Row) => s.eqUserId === null || r.user_id === s.eqUserId;
    if (s.op === 'upsert') {
      return {
        data: null,
        error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' },
      };
    }
    if (s.op === 'insert') {
      state.roles.push({ user_id: s.payload.user_id, role: s.payload.role });
      return { data: null, error: null };
    }
    if (s.op === 'update') {
      state.roles.filter(matches).forEach((r) => (r.role = s.payload.role));
      return { data: null, error: null };
    }
    if (s.op === 'delete') {
      state.roles = state.roles.filter((r) => !matches(r));
      return { data: null, error: null };
    }
    return { data: state.roles.filter(matches).map((r) => ({ ...r })), error: null };
  };

  const b: any = {
    select: () => b,
    limit: () => b,
    eq: (col: string, v: unknown) => {
      if (col === 'user_id') s.eqUserId = String(v);
      return b;
    },
    insert: (p: any) => ((s.op = 'insert'), (s.payload = p), b),
    update: (p: any) => ((s.op = 'update'), (s.payload = p), b),
    delete: () => ((s.op = 'delete'), b),
    upsert: (p: any) => ((s.op = 'upsert'), (s.payload = p), b),
    then: (res: any, rej: any) => run().then(res, rej),
  };
  return b;
}

const { POST } = await import('@/app/api/admin/permissions/route');

const post = (body: unknown) =>
  POST(new Request('https://example.test/api/admin/permissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  state.roles = [];
});

describe('设为管理员（admin_roles 授权）', () => {
  it('第一次授权：成功写入 admin_roles，不再报 ON CONFLICT 错误', async () => {
    const res = await post({ action: 'add_admin', email: '2323111680@qq.com' });
    expect(res.status).toBe(200);
    expect(state.roles).toEqual([{ user_id: 'user-9', role: 'admin' }]);
  });

  it('重复授权同一个人：更新而不是多插一行', async () => {
    await post({ action: 'add_admin', email: '2323111680@qq.com' });
    const res = await post({ action: 'add_admin', email: '2323111680@qq.com' });
    expect(res.status).toBe(200);
    expect(state.roles).toHaveLength(1);
  });

  it('邮箱没注册过：返回 404，不写任何记录', async () => {
    const res = await post({ action: 'add_admin', email: 'nobody@example.com' });
    expect(res.status).toBe(404);
    expect(state.roles).toHaveLength(0);
  });

  it('撤销自己的管理员权限会被拒绝', async () => {
    await post({ action: 'add_admin', email: '2323111680@qq.com' });
    const res = await post({ action: 'remove_admin', email: 'song.weiwei23@gmail.com' });
    expect(res.status).toBe(400);
  });

  it('源码里不再用 upsert(onConflict) 写 admin_roles', () => {
    const code = readCode('app/api/admin/permissions/route.ts');
    expect(code).not.toMatch(/onConflict/);
    expect(code).not.toMatch(/\.upsert\(/);
  });
});
