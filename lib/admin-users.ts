import type { SupabaseClient } from '@supabase/supabase-js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 搜索词：去掉控制字符和首尾空格，最长 100 字 */
export function cleanQuery(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface UserPage {
  users: AdminUserRow[];
  total: number;
}

/** 数据库函数没迁移时，最多逐页扫描这么多页（每页 1000 人） */
const MAX_SCAN_PAGES = 20;

/** 纯函数：按邮箱或用户编号过滤；没有搜索词就全部保留。给扫描路径和测试用 */
export function matchUsers(users: AdminUserRow[], query: string): AdminUserRow[] {
  const q = query.toLowerCase();
  if (!q) return users;
  return users.filter((u) => (u.email ?? '').toLowerCase().includes(q) || u.id.toLowerCase() === q);
}

type AuthUser = {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
};

async function scanAllUsers(db: SupabaseClient): Promise<AdminUserRow[]> {
  const all: AdminUserRow[] = [];
  for (let page = 1; page <= MAX_SCAN_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = (data?.users ?? []) as AuthUser[];
    for (const u of batch) {
      all.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: u.banned_until ?? null,
      });
    }
    if (batch.length < 1000) break;
  }
  return all;
}

/**
 * 分页搜索用户（邮箱、用户名、用户编号），新注册的排在前面。
 * 优先走数据库函数 admin_search_users；函数还没迁移时逐页扫描，结果一样，只是慢一些。
 */
export async function searchUsers(
  db: SupabaseClient,
  query: string,
  offset: number,
  limit: number
): Promise<UserPage> {
  const { data, error } = await db.rpc('admin_search_users', {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });
  if (!error && Array.isArray(data)) {
    const users = data.map((r: Record<string, unknown>) => ({
      id: String(r.user_id),
      email: (r.email as string) ?? null,
      created_at: String(r.created_at),
      last_sign_in_at: (r.last_sign_in_at as string) ?? null,
      banned_until: (r.banned_until as string) ?? null,
    }));
    // 偏移超出总数时没有任何一行，拿不到总数，就按偏移量返回下界
    const total = data.length ? Number(data[0].total_count) : offset;
    return { users, total };
  }

  const matched = matchUsers(await scanAllUsers(db), query).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return { users: matched.slice(offset, offset + limit), total: matched.length };
}

/** 按用户编号批量取邮箱。少量用 getUserById；多了整页扫一遍，比逐个请求快 */
export async function emailsByIds(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  if (unique.length <= 20) {
    await Promise.all(
      unique.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        if (data?.user?.email) out.set(id, data.user.email);
      })
    );
    return out;
  }
  const wanted = new Set(unique);
  for (const u of await scanAllUsers(db)) {
    if (wanted.has(u.id) && u.email) out.set(u.id, u.email);
  }
  return out;
}
