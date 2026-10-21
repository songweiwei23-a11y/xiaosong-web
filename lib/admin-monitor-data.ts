import type { SupabaseClient, User } from '@supabase/supabase-js';
import { FUNNEL_KINDS, buildFunnel, type FunnelCounts } from '@/lib/funnel';
import type { RawGeneration, RawProfile, RawSubscription } from '@/lib/monitor';

/*
 * 实时动态的完整内容缓存。
 * 生成记录和对话写入后内容不再改，所以每条只从数据库读一次，之后每秒刷新只补新出现的记录。
 * 没有这层缓存，「最近 200 条完整内容」每秒都要重读一遍，数据库扛不住。
 * 只保留列表里还在的那些（见 pruneContent），内存有上限。
 */
export const generationContent = new Map<string, RawGeneration>();
export const usageDetailContent = new Map<string, { id: string; detail: unknown }>();

/** 缓存里没有的 id 才去读，每次最多 100 个（in 查询别太长）。读到的放进缓存。 */
export async function fillContent<T>(
  cache: Map<string, T>,
  ids: string[],
  load: (missing: string[]) => Promise<T[]>,
  idOf: (row: T) => string,
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !cache.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    for (const row of await load(missing.slice(i, i + 100))) cache.set(idOf(row), row);
  }
}

/** 只留 keep 里的 id，其余从缓存里去掉 */
export function pruneContent<T>(cache: Map<string, T>, keep: Iterable<string>): void {
  const live = new Set(keep);
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
}

/*
 * 带过期时间的单值缓存（2026-10-22，后台扩展方案 P0-2）。
 * 只要一个统计值是「慢而且变化不快」的（比如历史生成总数），就用它，别每秒去算。
 * 同一时刻的并发请求共享同一次计算；计算失败不缓存。
 */
export function createTtlValue<T>(ttlMs: number, load: () => Promise<T>): () => Promise<T> {
  let entry: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (entry && Date.now() - entry.at < ttlMs) return entry.value;
    const value = load();
    const mine = { at: Date.now(), value };
    entry = mine;
    value.catch(() => {
      if (entry === mine) entry = null;
    });
    return value;
  };
}

/*
 * 用户资料和会员的按人查询（2026-10-22，P0-4）。
 * 原来每秒把全部用户资料、全部会员整表读一遍，只为了认出「最近活跃」的人。
 * 现在只查这一批活跃用户，分批 100 个，每人缓存 10 秒。
 */
export interface UserLookup {
  profiles: Map<string, RawProfile[]>;
  plans: Map<string, RawSubscription>;
}

const lookupCache = new Map<string, { at: number; profiles: RawProfile[]; sub: RawSubscription | null }>();
const LOOKUP_TTL_MS = 10_000;

export async function lookupUsers(db: SupabaseClient, userIds: string[]): Promise<UserLookup> {
  const now = Date.now();
  const ids = [...new Set(userIds)];
  const missing = ids.filter((id) => {
    const hit = lookupCache.get(id);
    return !hit || now - hit.at >= LOOKUP_TTL_MS;
  });
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const [profRes, subRes] = await Promise.all([
      db.from('user_profiles').select('id, user_id, profile_name').in('user_id', chunk),
      db.from('subscriptions').select('user_id, plan, status, end_date').in('user_id', chunk),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (subRes.error) throw new Error(subRes.error.message);
    const profiles = new Map<string, RawProfile[]>();
    for (const p of (profRes.data ?? []) as RawProfile[]) {
      if (!p.user_id) continue;
      profiles.set(p.user_id, [...(profiles.get(p.user_id) ?? []), p]);
    }
    const plans = new Map<string, RawSubscription>();
    for (const s of (subRes.data ?? []) as RawSubscription[]) if (s.user_id) plans.set(s.user_id, s);
    for (const id of chunk) {
      lookupCache.set(id, { at: now, profiles: profiles.get(id) ?? [], sub: plans.get(id) ?? null });
    }
  }
  const out: UserLookup = { profiles: new Map(), plans: new Map() };
  for (const id of ids) {
    const hit = lookupCache.get(id);
    if (!hit) continue;
    if (hit.profiles.length) out.profiles.set(id, hit.profiles);
    if (hit.sub) out.plans.set(id, hit.sub);
  }
  // 顺手清掉很久没人查的条目，内存有上限
  if (lookupCache.size > 5000) for (const [id, v] of lookupCache) if (now - v.at > 10 * LOOKUP_TTL_MS) lookupCache.delete(id);
  return out;
}

/** 测试用 */
export function resetLookupCache() {
  lookupCache.clear();
}

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

/*
 * 用户目录的缓存时长。大屏每秒刷新，整份用户列表 1 秒内复用一次，新注册的用户很快就能显示邮箱和档案。
 * （2026-10-21：原来是 60 秒，新用户要等一分钟才显示。）
 */
export const USERS_CACHE_MS = 1_000;
let usersCache: { at: number; users: User[] } | null = null;

/** 带短时缓存的 readAllUsers。大屏高频刷新时不必每次翻完全部用户页 */
export async function readAllUsersCached(db: SupabaseClient, now = Date.now()): Promise<User[]> {
  if (usersCache && now - usersCache.at < USERS_CACHE_MS) return usersCache.users;
  const users = await readAllUsers(db);
  usersCache = { at: now, users };
  return users;
}

/** 测试用：清掉缓存 */
export function resetUsersCache() {
  usersCache = null;
}

/*
 * 同一份快照的合并器（2026-10-10 巡检 M4）。
 * 多个管理员同时开大屏，或者一次实时信号触发很多次刷新时，原来每次都全量重算一遍。
 * 现在：ttl 内只算一次，并发请求共享同一个进行中的结果；失败的结果不缓存，下次重试。
 */
const coalesced = new Map<string, { at: number; value: Promise<unknown> }>();

export async function coalesce<T>(key: string, ttlMs: number, fn: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = coalesced.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fn();
  coalesced.set(key, { at: now, value });
  value.catch(() => {
    if (coalesced.get(key)?.value === value) coalesced.delete(key);
  });
  return value;
}

/** 测试用：清掉合并器的缓存 */
export function resetCoalesced() {
  coalesced.clear();
}

/*
 * 快照按「数据版本」缓存，只留最新一份。
 *
 * 2026-10-21 修：原来只按 5 秒时间缓存。数据库变了、大屏已经收到变更通知去取数，
 * 取到的却是 5 秒内算好的旧快照，要等下一次变更或 30 秒心跳才会更新，看起来就是"不实时"。
 * 现在键是 admin_monitor_signal 的版本号：版本没变就共享同一份结果（包括正在算的），版本变了就重新算。
 * 只留一份，所以不会随时间越攒越多。
 */
let latestSnapshot: { key: string; value: Promise<unknown> } | null = null;

export function snapshotForRevision<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (latestSnapshot?.key === key) return latestSnapshot.value as Promise<T>;
  const value = fn();
  const entry = { key, value };
  latestSnapshot = entry;
  value.catch(() => {
    // 失败的结果不缓存，下次请求重算
    if (latestSnapshot === entry) latestSnapshot = null;
  });
  return value;
}

/** 测试用：清掉最新快照 */
export function resetSnapshot() {
  latestSnapshot = null;
}

/**
 * 读数据版本号（见 lib/admin-monitor-signal）。读不到（迁移没跑、网络抖动）返回 null，
 * 调用方退回到按时间缓存。
 */
export async function readMonitorRevision(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.from('admin_monitor_signal').select('revision,updated_at').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return `${data.revision}:${data.updated_at}`;
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
