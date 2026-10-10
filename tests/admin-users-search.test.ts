import { describe, expect, it } from 'vitest';
import { cleanQuery, emailsByIds, matchUsers, searchUsers, UUID_RE, type AdminUserRow } from '@/lib/admin-users';

const U = (id: string, email: string, created: string): AdminUserRow => ({
  id,
  email,
  created_at: created,
  last_sign_in_at: null,
  banned_until: null,
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const users = [
  U(A, 'Alice@Example.com', '2026-10-01T00:00:00Z'),
  U(B, 'bob@test.cn', '2026-10-05T00:00:00Z'),
];

/** 只实现后台搜索用到的几个方法的假客户端 */
function fakeDb(opts: { rpcRows?: unknown[] | null; rpcError?: { message: string } | null; list?: AdminUserRow[]; byId?: Record<string, { email: string }> }) {
  const calls: { rpc: unknown[]; listPages: number[]; byId: string[] } = { rpc: [], listPages: [], byId: [] };
  const db = {
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push([name, args]);
      if (opts.rpcError) return { data: null, error: opts.rpcError };
      return { data: opts.rpcRows ?? [], error: null };
    },
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
          calls.listPages.push(page);
          const all = opts.list ?? [];
          const slice = all.slice((page - 1) * perPage, page * perPage);
          return { data: { users: slice }, error: null };
        },
        getUserById: async (id: string) => {
          calls.byId.push(id);
          const hit = opts.byId?.[id];
          return { data: { user: hit ? { id, email: hit.email } : null }, error: null };
        },
      },
    },
  };
  return { db: db as never, calls };
}

describe('后台用户搜索：搜索词清理', () => {
  it('去掉控制字符和首尾空格，最长 100 字', () => {
    expect(cleanQuery('  a\u0000b\n ')).toBe('ab');
    expect(cleanQuery('x'.repeat(300)).length).toBe(100);
    expect(cleanQuery(null)).toBe('');
  });

  it('用户编号格式严格校验（不合格的不拿去查）', () => {
    expect(UUID_RE.test(A)).toBe(true);
    expect(UUID_RE.test("abc' OR 1=1")).toBe(false);
  });
});

describe('后台用户搜索：扫描路径（数据库函数还没迁移时）', () => {
  it('按邮箱不分大小写匹配；用户编号精确匹配', () => {
    expect(matchUsers(users, 'alice').map((u) => u.id)).toEqual([A]);
    expect(matchUsers(users, 'TEST.CN').map((u) => u.id)).toEqual([B]);
    expect(matchUsers(users, A).map((u) => u.id)).toEqual([A]);
    expect(matchUsers(users, '')).toHaveLength(2);
  });

  it('数据库函数报错时退回扫描，结果仍按新注册在前、分页正确', async () => {
    const { db, calls } = fakeDb({ rpcError: { message: 'function admin_search_users does not exist' }, list: users });
    const page = await searchUsers(db, '', 0, 1);
    expect(calls.rpc).toHaveLength(1);
    expect(calls.listPages).toEqual([1]);
    expect(page.total).toBe(2);
    expect(page.users.map((u) => u.id)).toEqual([B]);
    const second = await searchUsers(db, '', 1, 1);
    expect(second.users.map((u) => u.id)).toEqual([A]);
  });

  it('数据库函数可用时直接用它，总数来自 total_count', async () => {
    const { db } = fakeDb({
      rpcRows: [
        { user_id: B, email: 'bob@test.cn', created_at: '2026-10-05T00:00:00Z', last_sign_in_at: null, banned_until: null, total_count: 7 },
      ],
    });
    const page = await searchUsers(db, 'bob', 0, 20);
    expect(page.total).toBe(7);
    expect(page.users[0].email).toBe('bob@test.cn');
  });
});

describe('批量取邮箱', () => {
  it('少量用户逐个查，多了整页扫一遍', async () => {
    const small = fakeDb({ byId: { [A]: { email: 'a@x.com' } } });
    const m1 = await emailsByIds(small.db, [A, A]);
    expect(m1.get(A)).toBe('a@x.com');
    expect(small.calls.byId).toEqual([A]);

    const many = Array.from({ length: 25 }, (_, i) => U(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, `u${i}@x.com`, '2026-10-01T00:00:00Z'));
    const big = fakeDb({ list: many });
    const m2 = await emailsByIds(big.db, many.map((u) => u.id));
    expect(m2.size).toBe(25);
    expect(big.calls.byId).toHaveLength(0);
    expect(big.calls.listPages).toEqual([1]);
  });
});
