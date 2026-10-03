export interface WebSource { title: string; url: string }
export interface WebSearchStatus { status: 'searching' | 'done' | 'unavailable' | 'quota_exhausted'; sources: WebSource[]; message?: string }

export function sanitizeWebSources(value: unknown): WebSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((x): x is WebSource => {
    if (!x || typeof x !== 'object' || typeof x.url !== 'string') return false;
    try {
      const u = new URL(x.url);
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || seen.has(u.href)) return false;
      seen.add(u.href); return true;
    } catch { return false; }
  }).slice(0, 6).map(x => ({ title: String(x.title || new URL(x.url).hostname).slice(0, 180), url: x.url }));
}

/** 搜索节点沿用固定 ID；兼容原 Tavily 和替换后的 HTTP 搜索节点。 */
export function isWebSearchNode(data: any): boolean {
  return String(data?.node_id || '') === '1790086576262'
    || /^(?:Tavily Search|Serper Search|阿里云联网搜索(?: Lite)?|联网搜索(?:[ ·｜|－-].*)?)$/i.test(String(data?.title || ''));
}

/** 只根据真正执行的外部搜索汇报状态，不把知识库检索冒充联网。 */
export function difyWebStatus(event: any): WebSearchStatus | null {
  const d = event?.data;
  if (!d || !isWebSearchNode(d)) return null;
  if (event.event === 'node_started') return { status: 'searching', sources: [] };
  if (event.event !== 'node_finished') return null;
  if (d.status !== 'succeeded' || d.error) return { status: 'unavailable', sources: [] };
  const found: WebSource[] = [];
  let failed = false;
  const collect = (value: any, depth = 0) => {
    if (depth > 10 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      try { collect(JSON.parse(value), depth + 1); } catch {
        if (/ToolInvokeError|invalid.*api.?key|exceed.*(?:quota|credit)|HTTP.*(?:401|403|429|500)|联网搜索暂时不可用/i.test(value)) failed = true;
      }
    } else if (Array.isArray(value)) value.slice(0, 20).forEach(x => collect(x, depth + 1));
    else if (typeof value === 'object') {
      if (value.error) failed = true;
      if (Number(value.status_code) >= 400 || Number(value.http_code) >= 400 || value.status === 'failed') failed = true;
      if (value.code && !['0', '200', 'OK', 'Success'].includes(String(value.code))) failed = true;
      const url = value.url || value.link;
      if (typeof url === 'string') found.push({ url, title: value.title || value.name || '' });
      for (const key of ['body', 'json', 'results', 'result', 'search_result', 'organic', 'text', 'data']) if (key in value) collect(value[key], depth + 1);
    }
  };
  collect(d.outputs);
  const sources = sanitizeWebSources(found);
  return { status: failed || !sources.length ? 'unavailable' : 'done', sources: failed ? [] : sources };
}
