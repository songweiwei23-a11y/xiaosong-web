// 联网搜索真实取样（只读调用，不写库）。输出只含结果摘要和域名，不含密钥。
import { aliSearch } from '../lib/ali-search';
import { getSearchConfig } from '../lib/search-config';

const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

const QUERIES = [
  '今天国内有哪些重要新闻',
  '2026年抖音本地生活团购佣金比例',
  '短视频 广告 标识 新规 2026',
  '抖音本地生活 商家入驻 要求',
  'Dify 工作流 知识检索节点 参数',
  '抖音热榜 今日热点',
  '南乐县 今天 新闻',
  '什么是复利',
];

async function main() {
  const cfg = await getSearchConfig();
  if (!cfg) {
    console.log(JSON.stringify({ error: 'no-config' }));
    return;
  }
  console.log(JSON.stringify({ source: cfg.source, host: new URL(cfg.endpoint).host, today }));

  // 原始返回的字段名（只看结构，不看内容）
  const raw = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '今天国内有哪些重要新闻', query_rewrite: false, top_k: 5, content_type: 'mainText', way: 'pro-fetch',
      history: [{ role: 'system', content: `今天是${today}（北京时间）。` }],
    }),
  });
  const text = await raw.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* 非 JSON 只记长度 */ }
  const first = j?.result?.search_result?.[0] ?? {};
  console.log(JSON.stringify({
    rawStatus: raw.status,
    rawBytes: text.length,
    topKeys: Object.keys(j || {}),
    resultKeys: Object.keys(j?.result || {}),
    itemKeys: Object.keys(first),
    metaKeys: Object.keys(first.meta_info || {}),
    contentLenFirst: typeof first.content === 'string' ? first.content.length : null,
  }));

  for (const q of QUERIES) {
    for (const way of ['pro-fetch', 'pro'] as const) {
      const t0 = Date.now();
      const r = await aliSearch(q, cfg, { topK: 10, way, rewrite: false, today, timeoutMs: 25_000 });
      const ms = Date.now() - t0;
      if (!r.ok) {
        console.log(JSON.stringify({ q, way, ms, fail: r.reason, status: (r as any).status ?? null }));
        continue;
      }
      console.log(JSON.stringify({
        q, way, ms, n: r.hits.length,
        hits: r.hits.map((h) => ({ d: new URL(h.url).hostname, t: h.title.slice(0, 40), p: h.published || '', c: h.content.length })),
      }));
    }
  }
}

main().catch((e) => console.log(JSON.stringify({ error: String(e?.message || e).slice(0, 200) })));
