import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 封禁 / 解封 / 改会员（2026-10-10 后台巡检 H1、H2）。
 *
 * H1：封禁和解封只能改订阅状态，不能把套餐写成 free。
 * H2：页面选的到期日按北京时间当天 23:59:59 存；格式不对要拒绝。
 * 用一张内存里的订阅表模拟 PostgREST 的链式调用，检查最终落库的值。
 */

const h = vi.hoisted(() => {
  type Row = Record<string, any>;
  const state = {
    subs: new Map<string, Row>(),
    logs: [] as Row[],
    authBanned: new Set<string>(),
  };

  function table(name: string) {
    const ctx: { filters: Record<string, any>; op: string; payload: any; single: boolean } = {
      filters: {}, op: 'select', payload: null, single: false,
    };
    const run = async () => {
      if (name === 'subscriptions') {
        const id = ctx.filters.user_id;
        if (ctx.op === 'select') {
          const row = state.subs.get(id) ?? null;
          return { data: ctx.single ? row : row ? [row] : [], error: null };
        }
        if (ctx.op === 'update') {
          const row = state.subs.get(id);
          if (row) Object.assign(row, ctx.payload);
          return { data: null, error: null };
        }
        if (ctx.op === 'insert') {
          state.subs.set(ctx.payload.user_id, { ...ctx.payload });
          return { data: null, error: null };
        }
        if (ctx.op === 'upsert') {
          const prev = state.subs.get(ctx.payload.user_id) ?? {};
          state.subs.set(ctx.payload.user_id, { ...prev, ...ctx.payload });
          return { data: [{ user_id: ctx.payload.user_id }], error: null };
        }
      }
      if (name === 'admin_logs' && ctx.op === 'insert') {
        state.logs.push(ctx.payload);
      }
      return { data: null, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (col: string, v: unknown) => { ctx.filters[col] = v; return b; },
      maybeSingle: () => { ctx.single = true; return b; },
      update: (p: Row) => { ctx.op = 'update'; ctx.payload = p; return b; },
      insert: (p: Row) => { ctx.op = 'insert'; ctx.payload = p; return b; },
      upsert: (p: Row) => { ctx.op = 'upsert'; ctx.payload = p; return b; },
      then: (res: any, rej: any) => run().then(res, rej),
    };
    return b;
  }

  const client = {
    from: (t: string) => table(t),
    auth: {
      admin: {
        updateUserById: async (id: string, attrs: Row) => {
          if (attrs.ban_duration === 'none') state.authBanned.delete(id);
          else state.authBanned.add(id);
          return { data: {}, error: null };
        },
        getUserById: async () => ({ data: { user: null }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
    storage: {},
  };

  return { state, client };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: () => h.client }));
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: async () => ({ userId: 'admin-1', email: 'admin@example.com', role: 'admin' }),
  getServiceSupabase: () => h.client,
}));

const { POST } = await import('@/app/api/admin/users/route');

const call = (body: Record<string, unknown>) =>
  POST(new Request('https://example.test/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

const PRO_END = '2026-12-31T15:59:59.000Z';

beforeEach(() => {
  h.state.subs.clear();
  h.state.logs.length = 0;
  h.state.authBanned.clear();
});

describe('封禁与解封不动套餐（H1）', () => {
  it('封禁付费会员：套餐、到期日保留，只把订阅状态改成 inactive', async () => {
    h.state.subs.set('u1', { user_id: 'u1', plan: 'pro', status: 'active', end_date: PRO_END });
    const res = await call({ userId: 'u1', action: 'ban_user' });
    expect(res.status).toBe(200);
    expect(h.state.authBanned.has('u1')).toBe(true);
    expect(h.state.subs.get('u1')).toMatchObject({ plan: 'pro', status: 'inactive', end_date: PRO_END });
  });

  it('封禁后解封：套餐仍是 pro，状态回到 active', async () => {
    h.state.subs.set('u1', { user_id: 'u1', plan: 'pro', status: 'active', end_date: PRO_END });
    await call({ userId: 'u1', action: 'ban_user' });
    const res = await call({ userId: 'u1', action: 'unban_user' });
    expect(res.status).toBe(200);
    expect(h.state.authBanned.has('u1')).toBe(false);
    expect(h.state.subs.get('u1')).toMatchObject({ plan: 'pro', status: 'active', end_date: PRO_END });
  });

  it('没有订阅行的用户被封禁：新建一行免费版，状态 inactive', async () => {
    const res = await call({ userId: 'u2', action: 'ban_user' });
    expect(res.status).toBe(200);
    expect(h.state.subs.get('u2')).toMatchObject({ plan: 'free', status: 'inactive' });
  });

  it('封禁和解封的源码里不再写 plan: free（防止回退）', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/users/route.ts'), 'utf8');
    const banBlock = src.slice(src.indexOf("case 'ban_user'"), src.indexOf("case 'reset_password'"));
    expect(banBlock).not.toMatch(/plan:\s*'free'/);
  });
});

describe('改会员的到期日按北京时间（H2）', () => {
  it('填 2026-11-10：存成北京时间 11-10 23:59:59（即 UTC 15:59:59）', async () => {
    const res = await call({ userId: 'u3', action: 'update_membership', plan: 'pro', endDate: '2026-11-10' });
    expect(res.status).toBe(200);
    expect(h.state.subs.get('u3')).toMatchObject({ plan: 'pro', end_date: '2026-11-10T15:59:59.000Z' });
  });

  it('到期日格式不对：返回 400，不写入任何东西', async () => {
    const res = await call({ userId: 'u4', action: 'update_membership', plan: 'pro', endDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(h.state.subs.has('u4')).toBe(false);
  });

  it('不填到期日：永久（end_date 为 null）', async () => {
    const res = await call({ userId: 'u5', action: 'update_membership', plan: 'pro', endDate: null });
    expect(res.status).toBe(200);
    expect(h.state.subs.get('u5')).toMatchObject({ plan: 'pro', end_date: null });
  });
});
