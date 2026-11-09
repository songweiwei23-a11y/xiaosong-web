/**
 * 第二个搜索引擎（2026-11-09 联网整改阶段 3）：智谱 Web Search、博查 Web Search，和阿里云一起用、互为补充。
 * 两家都支持把时间过滤交给引擎（一天内 / 一周内 / 一个月内 / 一年内）。
 *
 * 密钥：后台「联网搜索密钥」页粘贴，先真搜一次验证通过才加密保存（app_secrets，和阿里云同一套加密），页面不回显。
 * 用不用：每家单独开关（meta.enabled），默认关；用固定 20 问对比后再打开选中的那家（见 .tmp/search-bench）。
 *
 * 返回格式：
 *   智谱（官方文档）：{ search_result: [{ title, content, link, media, publish_date }] }
 *   博查（第三方整理，和 Bing 一致）：{ code, data: { webPages: { value: [{ name, url, snippet, summary, siteName, datePublished }] } } }
 *   博查读法两种都认（有的版本没有外层 data），验证保存时会真搜一次确认读得出来。
 */
import { getServiceSupabase } from '@/lib/admin-auth';
import { openSearchKey, sealSearchKey, validApiKey } from '@/lib/search-config';
import type { SearchFailure, SearchHit, SearchResult, TimeRange } from '@/lib/ali-search';

export type ExtraEngine = 'zhipu' | 'bocha';
export const EXTRA_ENGINES: ExtraEngine[] = ['zhipu', 'bocha'];
export const ENGINE_LABEL: Record<ExtraEngine, string> = { zhipu: '智谱搜索', bocha: '博查搜索' };
const SECRET_NAME: Record<ExtraEngine, string> = { zhipu: 'zhipu_web_search', bocha: 'bocha_web_search' };
const ENDPOINT: Record<ExtraEngine, string> = {
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/web_search',
  bocha: 'https://api.bocha.cn/v1/web-search',
};
const RECENCY: Record<TimeRange, string> = { day: 'oneDay', week: 'oneWeek', month: 'oneMonth', year: 'oneYear' };

function toHits(rows: { url: unknown; title: unknown; content: unknown; published: unknown }[]): SearchHit[] {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const r of rows.slice(0, 50)) {
    if (typeof r.url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(r.url)) continue;
    let host = '';
    try { const u = new URL(r.url); if (u.username || u.password) continue; host = u.hostname; } catch { continue; }
    const url = r.url.slice(0, 2000);
    if (seen.has(url)) continue;
    seen.add(url);
    hits.push({ url, title: String(r.title || host).slice(0, 200), content: String(r.content || '').slice(0, 20_000), published: String(r.published || '').slice(0, 80) });
  }
  return hits;
}

function failureOf(status: number, msg: string): SearchFailure {
  if (status === 401 || status === 403 || /auth|unauthor|api ?key|token|鉴权|认证|权限/i.test(msg)) return 'auth';
  if (status === 429 || /rate|limit|quota|余额|欠费|并发|1701|1113/i.test(msg)) return 'quota';
  return 'unavailable';
}

export function parseZhipu(status: number, body: string): SearchResult {
  let r: Record<string, any> = {};
  try { r = JSON.parse(body); } catch { return { ok: false, reason: status >= 200 && status < 300 ? 'bad_response' : failureOf(status, ''), status }; }
  if (!(status >= 200 && status < 300) || r?.error) return { ok: false, reason: failureOf(status, `${r?.error?.code ?? ''} ${r?.error?.message ?? ''}`), status };
  if (!Array.isArray(r.search_result)) return { ok: false, reason: 'bad_response', status };
  return { ok: true, hits: toHits(r.search_result.map((x: Record<string, unknown>) => ({ url: x?.link, title: x?.title, content: x?.content, published: x?.publish_date }))) };
}

export function parseBocha(status: number, body: string): SearchResult {
  let r: Record<string, any> = {};
  try { r = JSON.parse(body); } catch { return { ok: false, reason: status >= 200 && status < 300 ? 'bad_response' : failureOf(status, ''), status }; }
  const code = r?.code == null ? 200 : Number(r.code);
  if (!(status >= 200 && status < 300) || code !== 200) return { ok: false, reason: failureOf(status !== 200 ? status : code, `${r?.msg ?? ''} ${r?.message ?? ''}`), status };
  const value = (r.data ?? r)?.webPages?.value;
  if (!Array.isArray(value)) return { ok: false, reason: 'bad_response', status };
  return { ok: true, hits: toHits(value.map((x: Record<string, unknown>) => ({ url: x?.url, title: x?.name, content: x?.summary || x?.snippet, published: x?.datePublished || x?.dateLastCrawled }))) };
}

export interface EngineSearchOptions { topK?: number; timeRange?: TimeRange; timeoutMs?: number }

export async function engineSearch(engine: ExtraEngine, apiKey: string, query: string, opts: EngineSearchOptions = {}): Promise<SearchResult> {
  const count = Math.min(Math.max(opts.topK ?? 10, 1), 50);
  const body = engine === 'zhipu'
    ? { search_query: query.slice(0, 70), search_engine: 'search_pro', search_intent: false, count, content_size: 'high', search_recency_filter: opts.timeRange ? RECENCY[opts.timeRange] : 'noLimit' }
    : { query: query.slice(0, 200), count, summary: true, freshness: opts.timeRange ? RECENCY[opts.timeRange] : 'noLimit' };
  let res: Response;
  try {
    res = await fetch(ENDPOINT[engine], {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      redirect: 'error',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  const text = await res.text().catch(() => '');
  return engine === 'zhipu' ? parseZhipu(res.status, text) : parseBocha(res.status, text);
}

export interface EngineState { configured: boolean; enabled: boolean; verifiedAt?: string }

let cache: { at: number; value: Record<ExtraEngine, { key: string | null; enabled: boolean; verifiedAt?: string }> } | null = null;
const CACHE_MS = 60_000;
export function clearEngineCache(): void { cache = null; }

async function readAll(): Promise<Record<ExtraEngine, { key: string | null; enabled: boolean; verifiedAt?: string }>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = { zhipu: { key: null, enabled: false }, bocha: { key: null, enabled: false } } as Record<ExtraEngine, { key: string | null; enabled: boolean; verifiedAt?: string }>;
  try {
    const { data } = await getServiceSupabase().from('app_secrets').select('name, value, meta').in('name', Object.values(SECRET_NAME));
    for (const e of EXTRA_ENGINES) {
      const row = (data ?? []).find((r) => r.name === SECRET_NAME[e]);
      if (!row) continue;
      const meta = (row.meta || {}) as Record<string, unknown>;
      value[e] = { key: typeof row.value === 'string' ? openSearchKey(row.value) : null, enabled: meta.enabled === true, verifiedAt: typeof meta.verifiedAt === 'string' ? meta.verifiedAt : undefined };
    }
  } catch { /* 读不到就当都没配 */ }
  cache = { at: Date.now(), value };
  return value;
}

/** 后台看的状态（不含密钥） */
export async function engineStates(): Promise<Record<ExtraEngine, EngineState>> {
  const all = await readAll();
  return Object.fromEntries(EXTRA_ENGINES.map((e) => [e, { configured: !!all[e].key, enabled: !!all[e].key && all[e].enabled, verifiedAt: all[e].verifiedAt }])) as Record<ExtraEngine, EngineState>;
}

/** 线上联网要一起用的引擎（配了密钥且打开了的）；force 给评测用：配了就用，不看开关 */
export async function activeEngines(force?: ExtraEngine[]): Promise<{ engine: ExtraEngine; key: string }[]> {
  const all = await readAll();
  return EXTRA_ENGINES.filter((e) => all[e].key && (force ? force.includes(e) : all[e].enabled)).map((e) => ({ engine: e, key: all[e].key! }));
}

export async function saveEngineKey(engine: ExtraEngine, rawKey: unknown, adminId: string): Promise<void> {
  const key = validApiKey(rawKey);
  if (!key) throw new Error('密钥格式不对');
  const now = new Date().toISOString();
  const prev = (await readAll())[engine];
  const { error } = await getServiceSupabase().from('app_secrets').upsert({
    name: SECRET_NAME[engine], value: sealSearchKey(key),
    meta: { engine, verifiedAt: now, enabled: prev.enabled, encryption: 'aes-256-gcm-v1' }, updated_at: now, updated_by: adminId,
  }, { onConflict: 'name' });
  clearEngineCache();
  if (error) throw new Error('保存失败，请重试');
}

export async function setEngineEnabled(engine: ExtraEngine, enabled: boolean, adminId: string): Promise<void> {
  const { data, error } = await getServiceSupabase().from('app_secrets').select('meta').eq('name', SECRET_NAME[engine]).maybeSingle();
  if (error || !data) throw new Error('还没有配置这个引擎的密钥');
  const { error: e2 } = await getServiceSupabase().from('app_secrets').update({ meta: { ...(data.meta as Record<string, unknown>), enabled }, updated_at: new Date().toISOString(), updated_by: adminId }).eq('name', SECRET_NAME[engine]);
  clearEngineCache();
  if (e2) throw new Error('保存失败，请重试');
}
