import type { SupabaseClient, User } from '@supabase/supabase-js';
import { FUNNEL_KINDS, buildFunnel, type FunnelCounts } from '@/lib/funnel';

/** 用小于 PostgREST 默认上限的页面读取，不能把 limit(50000) 当全量。 */
export async function readAllRows<T>(query: (from: number, to: number) => PromiseLike<{
  data: unknown[] | null; error: { message: string; code?: string } | null;
}>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await query(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function readAllUsers(db: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw new Error(result.error.message);
    users.push(...result.data.users);
    if (result.data.users.length < 1000) return users;
  }
}

/** 业务日统一为北京时间，不能随生产服务器的 UTC 时区改变。 */
export function chinaDayStart(now: number): number {
  const offset = 8 * 60 * 60 * 1000;
  return Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset;
}

export function funnelWindow(days: 1 | 7 | 30, now: number) {
  return { since: new Date(days === 1 ? chinaDayStart(now) : now - days * 86_400_000).toISOString(), now: new Date(now).toISOString() };
}

export type FunnelSnapshot = {
  days: 1 | 7 | 30; now: string; anonymousReady: boolean;
  steps: ReturnType<typeof buildFunnel>;
};

// 访问知识库和自由对话不等于产出了第一条创作内容。
export const CREATIVE_FEATURES = ['positioning', 'topic', 'script', 'storyboard', 'review', 'title', 'opening', 'growth', 'dealReason', 'interview', 'breakdown', 'remix', 'direction'];

/** 迁移后的数据库聚合一次完成；迁移前也分页全量读取，失败明确报错。 */
export async function loadFunnel(db: SupabaseClient, days: 1 | 7 | 30, now = Date.now()): Promise<FunnelSnapshot> {
  const window = funnelWindow(days, now);
  const aggregate = await db.rpc('admin_funnel_counts', { p_since: window.since, p_now: window.now });
  if (!aggregate.error && aggregate.data) {
    return { days, now: window.now, anonymousReady: true, steps: buildFunnel(aggregate.data as FunnelCounts) };
  }
  if (aggregate.error && !['PGRST202', '42883'].includes(aggregate.error.code)) throw new Error(aggregate.error.message);
  const [events, users, usage, orders] = await Promise.all([
    readAllRows<{ kind: string; visitor_id: string }>((from, to) => db.from('funnel_events').select('kind,visitor_id').gte('created_at', window.since).lte('created_at', window.now).order('id').range(from, to)),
    readAllUsers(db),
    readAllRows<{ user_id: string }>((from, to) => db.from('usage_events').select('user_id').in('feature', CREATIVE_FEATURES).gte('created_at', window.since).lte('created_at', window.now).order('id').range(from, to)),
    readAllRows<{ user_id: string; reviewed_at: string | null; created_at: string }>((from, to) => db.from('payment_orders').select('user_id,reviewed_at,created_at').eq('status', 'approved').order('id').range(from, to)),
  ]);
  const signups = new Set(users.filter((u) => u.created_at >= window.since && u.created_at <= window.now).map((u) => u.id));
  const counts: FunnelCounts = { landing_view: 0, landing_try: 0, register_view: 0, signup: signups.size, activated: 0, paid: 0 };
  for (const kind of FUNNEL_KINDS) counts[kind] = new Set(events.filter((e) => e.kind === kind).map((e) => e.visitor_id)).size;
  counts.activated = new Set(usage.map((r) => r.user_id).filter((id) => signups.has(id))).size;
  counts.paid = new Set(orders.filter((r) => { const at = r.reviewed_at || r.created_at; return at >= window.since && at <= window.now; }).map((r) => r.user_id).filter((id) => signups.has(id))).size;
  return { days, now: window.now, anonymousReady: true, steps: buildFunnel(counts) };
}
