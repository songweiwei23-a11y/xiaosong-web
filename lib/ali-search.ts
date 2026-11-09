/**
 * 服务端直接调阿里云联网搜索 Lite。请求和结果的读法与 Dify 工作流里那两个节点一致
 * （docs/dify 的 DSL：「准备搜索请求」「整理联网结果」），只是这里能一轮搜多次。
 */
import type { SearchConfig } from '@/lib/search-config';

export interface SearchHit {
  url: string;
  title: string;
  /** 搜索结果里带的正文（mainText），可能不完整 */
  content: string;
  published: string;
}

export type SearchFailure = 'auth' | 'quota' | 'bad_response' | 'network' | 'unavailable';
export type SearchResult = { ok: true; hits: SearchHit[] } | { ok: false; reason: SearchFailure; status?: number };

const OK_CODES = ['0', '200', 'OK', 'Success', 'success'];

/** 读搜索接口的返回。出错、失败、结构不对一律不当成「搜到 0 条」，而是失败——0 条和没搜成是两回事 */
export function parseSearchResponse(status: number, body: string): SearchResult {
  if (status === 401 || status === 403) return { ok: false, reason: 'auth', status };
  if (status === 429) return { ok: false, reason: 'quota', status };
  if (!(status >= 200 && status < 300)) return { ok: false, reason: 'unavailable', status };
  let r: Record<string, any>;
  try { r = JSON.parse(body); } catch { return { ok: false, reason: 'bad_response', status }; }
  if (!r || typeof r !== 'object') return { ok: false, reason: 'bad_response', status };
  const code = r.code == null ? '' : String(r.code);
  if (r.error || Number(r.http_code) >= 400 || r.result?.status === 'failed' || (code && !OK_CODES.includes(code))) {
    const msg = `${code} ${r.message || r.error?.message || ''}`;
    if (/auth|forbidden|apikey|api key|unauthor|permission|InvalidApiKey/i.test(msg) || Number(r.http_code) === 401 || Number(r.http_code) === 403) return { ok: false, reason: 'auth', status };
    if (/throttl|quota|limit|arrear|欠费|余额/i.test(msg) || Number(r.http_code) === 429) return { ok: false, reason: 'quota', status };
    return { ok: false, reason: 'unavailable', status };
  }
  if (!Array.isArray(r.result?.search_result)) return { ok: false, reason: 'bad_response', status };
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const page of r.result.search_result.slice(0, 30)) {
    if (!page || typeof page.link !== 'string' || !/^https?:\/\/[^\s]+$/i.test(page.link)) continue;
    let host = '';
    try { const u = new URL(page.link); if (u.username || u.password) continue; host = u.hostname; } catch { continue; }
    const url = page.link.slice(0, 2000);
    if (seen.has(url)) continue;
    seen.add(url);
    hits.push({
      url,
      title: String(page.title || host).slice(0, 200),
      content: String(page.content || page.snippet || '').slice(0, 20_000),
      published: String(page.meta_info?.publishedTime || '').slice(0, 80),
    });
  }
  return { ok: true, hits };
}

/** 接口自带的时间过滤（官方文档的 time_range）：只要这段时间内发布的 */
export type TimeRange = 'day' | 'week' | 'month' | 'year';

/**
 * 要最近 N 天的 → 交给接口的时间过滤（2026-11-09 联网整改阶段 1）。
 * 原来没传，搜回来的是不分时间的结果，再在本地按日期丢，新内容本来就没被搜回来。
 * 「今天」（规则和搜索计划给的都是 2 天）用 day：实测按 week 搜，「今天的热点新闻」拿到的是 3～4 天前的；
 * day 一条都搜不到时会自动放宽到 week（见 lib/free-chat-web），不会因为太严而空手。
 */
export function timeRangeOf(recencyDays: number): TimeRange | undefined {
  if (!recencyDays || recencyDays <= 0) return undefined;
  if (recencyDays <= 2) return 'day';
  if (recencyDays <= 8) return 'week';
  if (recencyDays <= 40) return 'month';
  if (recencyDays <= 400) return 'year';
  return undefined;
}
/** 按时间搜不到时放宽一档 */
export function widerRange(r: TimeRange | undefined): TimeRange | undefined {
  return r === 'day' ? 'week' : r === 'week' ? 'month' : r === 'month' ? 'year' : undefined;
}

/**
 * 全账号每秒最多 3 次调用（官方文档：ops-web-search-001 QPS 上限 3，账号和子账号共用）。
 * 原来一个问题同时发最多 5 次，开物助理、深度研究也一起发，超出的被限流、在定向搜索里当成「这一路没结果」悄悄丢掉。
 * 现在本进程里所有搜索排队：任意 1 秒内最多 3 次（三次以内不用等）；被限流的等一下再试一次。
 * 2026-11-09 基线实测（单人连续 20 问、41 次搜索）没有出现限流；多人同时用时才可能撞上，排队是兜底。
 */
export const ALI_QPS = 3;
/** 最近几次发出的时间（预约好的也算）：任意 1 秒内最多 ALI_QPS 次，三次以内不用等 */
let starts: number[] = [];
/** 算出这一次该什么时候发（并预约上）；纯计算，测试可直接调 */
export function reserveAliSlot(now: number): number {
  starts = starts.filter((t) => t > now - 1000).sort((a, b) => a - b);
  const at = starts.length < ALI_QPS ? now : Math.max(now, starts[starts.length - ALI_QPS] + 1000);
  starts.push(at);
  return at;
}
async function takeSlot(): Promise<void> {
  const now = Date.now();
  const at = reserveAliSlot(now);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}
/** 测试用 */
export function resetAliQueue(): void { starts = []; }

export interface AliSearchOptions {
  topK?: number; timeoutMs?: number; way?: 'lite' | 'pro' | 'pro-fetch'; rewrite?: boolean; today?: string;
  /** 只要这段时间内发布的（接口的 time_range） */
  timeRange?: TimeRange;
  /** 多轮多源搜索（接口的 extend_search）：长尾问题更全，复杂问题约 7 秒；不能和 lite 一起用 */
  extend?: boolean;
  /** 测试用：不排队、不等重试 */
  noQueue?: boolean;
}

async function aliSearchOnce(query: string, config: SearchConfig, opts: AliSearchOptions): Promise<SearchResult> {
  let res: Response;
  try {
    const way = opts.way ?? 'lite';
    res = await fetch(config.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.slice(0, 500), query_rewrite: opts.rewrite ?? false,
        top_k: opts.topK ?? 8, content_type: 'mainText', way,
        ...(opts.timeRange ? { time_range: opts.timeRange } : {}),
        ...(opts.extend && way !== 'lite' ? { extend_search: true } : {}),
        ...(opts.today ? { history: [{ role: 'system', content: `今天是${opts.today}（北京时间）。保留问题的实体、地区、比较对象和技术限定；只改写检索措辞，不添加不存在的事实。` }] } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      redirect: 'error',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  return parseSearchResponse(res.status, await res.text().catch(() => ''));
}

export async function aliSearch(query: string, config: SearchConfig, opts: AliSearchOptions = {}): Promise<SearchResult> {
  if (!opts.noQueue) await takeSlot();
  const first = await aliSearchOnce(query, config, opts);
  if (first.ok || first.reason !== 'quota' || opts.noQueue) return first;
  // 被限流：等一秒多再试一次（还在队列里排，不插队）
  await new Promise((r) => setTimeout(r, 1200));
  await takeSlot();
  return aliSearchOnce(query, config, opts);
}

export const SEARCH_FAILURE_TEXT: Record<SearchFailure, string> = {
  auth: '搜索密钥不对或没有权限：请在后台「联网搜索密钥」重新粘贴验证',
  quota: '搜索服务调用太频繁或账户额度不足（阿里云那边），请稍后再试，还不行就刷新页面或到阿里云控制台查看',
  bad_response: '搜索服务返回的内容读不懂，可能地址填错了',
  network: '连不上搜索服务，请稍后再试，还不行就刷新页面',
  unavailable: '搜索服务暂时不可用，请稍后再试，还不行就刷新页面',
};
