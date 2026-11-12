/**
 * 选题索引（2026-10-03）：素材库「全部产出 · 选题库」按一条一条列，靠这张表不用每次拆全文。
 * 表见 supabase/migrations/20261003_library_assets.sql。
 *
 * 原来的做法：每次打开都取最近 300 批选题的全文现拆——300 批以前的看不到、数量少算，
 * 而且每次切分类都把全部全文拉一遍。现在：
 *   - 每批只拆一次，存标题、预览和搜索用的纯文字；
 *   - 新出的批次、删过其中几条的批次（input_data.deletedTopics 变了）下次打开时补拆，每次最多 SYNC_BATCH 批；
 *   - 数量 = 各批条数相加，不受数据库默认 1000 行上限影响（所有读取都按页取完）。
 * 表还没建（迁移没跑）时退回全量现拆，结果一样，只是慢——页面会提示去跑迁移。
 */
import { splitTopicSections } from './topic-library';
import { outputPreview } from './library-outputs';
import { DEFAULT_PROFILE_SCOPE, PROFILE_UUID } from './profile-history';
import { DB_PAGE, fetchAllPages } from './db-pages';

export const TOPIC_INDEX_TABLE = 'library_topic_index';
export const TOPIC_TASK = '选题策划';
/** 一次请求最多补拆多少批：旧数据多时分几次补，免得一次请求太久 */
export const SYNC_BATCH = 120;
const FETCH_CHUNK = 30;

export interface TopicIndexItem { t: string; p: string; s: string }
export interface TopicIndexRow {
  history_id: string;
  user_id: string;
  profile_key: string;
  created_at: string;
  work_id: string | null;
  item_count: number;
  items: TopicIndexItem[];
  search_text: string;
  version: number;
}

/** 列表里的一条选题（和「全部产出」其他库的格式一样） */
export interface TopicListItem { id: string; historyId: string; taskType: string; title: string; preview: string; createdAt: string; workId: string | null }

export const topicIndexMissing = (msg?: string) => new RegExp(TOPIC_INDEX_TABLE).test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '');

const plainLower = (s: string) => s.replace(/[#*>`|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** 这批选题属于哪个档案：和 lib/profile-history 的筛选口径一致（profile_id 或 profileId，都没有算 default） */
export function profileKeyOf(input: unknown): string {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  for (const k of ['profile_id', 'profileId']) {
    const v = o[k];
    if (typeof v === 'string' && PROFILE_UUID.test(v)) return v.toLowerCase();
  }
  return DEFAULT_PROFILE_SCOPE;
}

const deletedCount = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** 一批选题 → 一行索引 */
export function buildTopicIndexRow(h: { id: string; created_at: string; work_id?: string | null; input_data?: unknown; result?: string | null }, userId: string): TopicIndexRow {
  const items = splitTopicSections(String(h.result || '')).map((s) => ({
    t: s.title.slice(0, 80),
    p: outputPreview(s.body),
    s: plainLower(`${s.title}\n${s.body}`),
  }));
  const input = h.input_data && typeof h.input_data === 'object' ? (h.input_data as Record<string, unknown>) : {};
  return {
    history_id: h.id,
    user_id: userId,
    profile_key: profileKeyOf(input),
    created_at: h.created_at,
    work_id: h.work_id ?? null,
    item_count: items.length,
    items,
    search_text: items.map((i) => i.s).join('\n'),
    version: deletedCount(input.deletedTopics),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- supabase 查询链的类型跟着 select 字符串变，这里只当通用查询用 */
type Db = any;

export { fetchAllPages, DB_PAGE };

/**
 * 补齐索引：新出的、删过选题的批次重拆；历史删掉的从索引里删。
 * 返回还剩多少批没补（> 0 时页面提示「还在整理」并再请求一次）；表没建返回 null。
 */
export async function syncTopicIndex(db: Db, userId: string): Promise<{ pending: number } | null> {
  let indexed: { history_id: string; version: number }[];
  try {
    indexed = await fetchAllPages((from, to) => db.from(TOPIC_INDEX_TABLE).select('history_id, version').eq('user_id', userId).order('history_id').range(from, to));
  } catch (e) {
    if (topicIndexMissing((e as Error).message)) return null;
    throw e;
  }
  // 只取编号、时间和删过几条，不取正文
  const batches = await fetchAllPages<{ id: string; created_at: string; deleted: unknown }>((from, to) =>
    db.from('script_history').select('id, created_at, deleted:input_data->deletedTopics').eq('user_id', userId).eq('task_type', TOPIC_TASK).order('id').range(from, to)
  );

  const have = new Map(indexed.map((r) => [r.history_id, r.version]));
  const alive = new Set(batches.map((b) => b.id));
  const orphans = indexed.filter((r) => !alive.has(r.history_id)).map((r) => r.history_id);
  for (let i = 0; i < orphans.length; i += 100) {
    const { error } = await db.from(TOPIC_INDEX_TABLE).delete().eq('user_id', userId).in('history_id', orphans.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }

  // 新的先补：用户最常看的是最近的
  const stale = batches
    .filter((b) => have.get(b.id) !== deletedCount(b.deleted))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const todo = stale.slice(0, SYNC_BATCH);
  for (let i = 0; i < todo.length; i += FETCH_CHUNK) {
    const ids = todo.slice(i, i + FETCH_CHUNK).map((b) => b.id);
    const { data, error } = await db.from('script_history').select('id, created_at, work_id, input_data, result').eq('user_id', userId).in('id', ids);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((h: any) => buildTopicIndexRow(h, userId));
    if (!rows.length) continue;
    const up = await db.from(TOPIC_INDEX_TABLE).upsert(rows, { onConflict: 'history_id' });
    if (up.error) throw new Error(up.error.message);
  }
  return { pending: stale.length - todo.length };
}

export interface TopicScope {
  /** null = 全部档案；'default' = 没有档案的旧记录；否则档案 uuid */
  profileKey: string | null;
  range: { gte?: string; lt?: string };
}

const applyScope = (q: any, scope: TopicScope) => {
  let r = q;
  if (scope.profileKey) r = r.eq('profile_key', scope.profileKey.toLowerCase());
  if (scope.range.gte) r = r.gte('created_at', scope.range.gte);
  if (scope.range.lt) r = r.lt('created_at', scope.range.lt);
  return r;
};

/** 选题库共有多少条（按页把每批的条数取完再相加） */
export async function countIndexedTopics(db: Db, userId: string, scope: TopicScope): Promise<number> {
  const rows = await fetchAllPages<{ item_count: number }>((from, to) =>
    applyScope(db.from(TOPIC_INDEX_TABLE).select('history_id, item_count').eq('user_id', userId), scope).order('history_id').range(from, to)
  );
  return rows.reduce((a, r) => a + (r.item_count || 0), 0);
}

const toListItem = (row: { history_id: string; created_at: string; work_id: string | null }, it: TopicIndexItem, idx: number): TopicListItem => ({
  id: `${row.history_id}#${idx}`, historyId: row.history_id, taskType: TOPIC_TASK, title: it.t, preview: it.p, createdAt: row.created_at, workId: row.work_id ?? null,
});

/**
 * 选题库一页。没有关键词：按各批条数算出这一页落在哪几批，只取那几批；
 * 有关键词：先用整批文字筛出可能命中的批，再逐条筛。
 */
export async function listIndexedTopics(db: Db, userId: string, scope: TopicScope, kw: string, page: { offset: number; limit: number }): Promise<{ items: TopicListItem[]; total: number }> {
  const order = (q: any) => q.order('created_at', { ascending: false }).order('history_id', { ascending: false });
  if (kw) {
    const needle = kw.toLowerCase();
    const rows = await fetchAllPages<any>((from, to) =>
      order(applyScope(db.from(TOPIC_INDEX_TABLE).select('history_id, created_at, work_id, items').eq('user_id', userId).ilike('search_text', `%${needle}%`), scope)).range(from, to)
    );
    const hits = rows.flatMap((r) => (Array.isArray(r.items) ? r.items : []).map((it: TopicIndexItem, i: number) => ({ r, it, i }))).filter(({ it }) => String(it.s || '').includes(needle));
    return { total: hits.length, items: hits.slice(page.offset, page.offset + page.limit).map(({ r, it, i }) => toListItem(r, it, i)) };
  }

  const meta = await fetchAllPages<{ history_id: string; item_count: number }>((from, to) =>
    order(applyScope(db.from(TOPIC_INDEX_TABLE).select('history_id, item_count, created_at').eq('user_id', userId), scope)).range(from, to)
  );
  const total = meta.reduce((a, r) => a + (r.item_count || 0), 0);
  // 这一页覆盖哪几批，以及第一批从第几条开始
  const need: string[] = [];
  let skip = 0;
  let pos = 0;
  for (const r of meta) {
    const end = pos + (r.item_count || 0);
    if (end > page.offset && pos < page.offset + page.limit) {
      if (!need.length) skip = page.offset - pos;
      need.push(r.history_id);
    }
    if (end >= page.offset + page.limit) break;
    pos = end;
  }
  if (!need.length) return { total, items: [] };
  const { data, error } = await db.from(TOPIC_INDEX_TABLE).select('history_id, created_at, work_id, items').eq('user_id', userId).in('history_id', need);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((r: any) => [r.history_id, r]));
  const flat = need.flatMap((id) => {
    const r: any = byId.get(id);
    return r ? (Array.isArray(r.items) ? r.items : []).map((it: TopicIndexItem, i: number) => toListItem(r, it, i)) : [];
  });
  return { total, items: flat.slice(skip, skip + page.limit) };
}

/**
 * 索引表没建时的兜底：按页把全部选题批次取完现拆。结果和索引一样（不截断），只是每次都要拉全文。
 */
export async function scanTopics(db: Db, userId: string, profileFilter: string | null, range: TopicScope['range'], kw: string, page: { offset: number; limit: number }): Promise<{ items: TopicListItem[]; total: number }> {
  const rows = await fetchAllPages<any>((from, to) => {
    let q = db.from('script_history').select('id, created_at, work_id, input_data, result').eq('user_id', userId).eq('task_type', TOPIC_TASK);
    if (profileFilter) q = q.or(profileFilter);
    if (range.gte) q = q.gte('created_at', range.gte);
    if (range.lt) q = q.lt('created_at', range.lt);
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
  });
  const needle = kw.toLowerCase();
  const all = rows.flatMap((h) => {
    const row = buildTopicIndexRow(h, userId);
    return row.items.map((it, i) => ({ it, item: toListItem(row, it, i) }));
  }).filter(({ it }) => !needle || it.s.includes(needle));
  return { total: all.length, items: all.slice(page.offset, page.offset + page.limit).map(({ item }) => item) };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
