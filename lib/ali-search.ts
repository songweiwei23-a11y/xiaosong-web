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

export async function aliSearch(query: string, config: SearchConfig, opts: { topK?: number; timeoutMs?: number; way?: 'lite' | 'pro' | 'pro-fetch'; rewrite?: boolean; today?: string } = {}): Promise<SearchResult> {
  let res: Response;
  try {
    res = await fetch(config.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.slice(0, 500), query_rewrite: opts.rewrite ?? false,
        top_k: opts.topK ?? 8, content_type: 'mainText', way: opts.way ?? 'lite',
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

export const SEARCH_FAILURE_TEXT: Record<SearchFailure, string> = {
  auth: '搜索密钥不对或没有权限：请在后台「联网搜索密钥」重新粘贴验证',
  quota: '搜索服务调用太频繁或账户额度不足（阿里云那边），请稍后再试或到阿里云控制台查看',
  bad_response: '搜索服务返回的内容读不懂，可能地址填错了',
  network: '连不上搜索服务，请稍后再试',
  unavailable: '搜索服务暂时不可用，请稍后再试',
};
