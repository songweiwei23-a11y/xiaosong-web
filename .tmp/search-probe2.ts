// 联网搜索站点探测（真实阿里云调用，只读，不写库，不扣用户额度）。只输出域名、路径前段、标题和发布时间，不含密钥。
import { aliSearch } from '../lib/ali-search';
import { getSearchConfig } from '../lib/search-config';

const QUERIES = [
  'site:douyin.com 抖音热榜',
  'site:douyin.com 热榜',
  'site:www.douyin.com 热点榜',
  '抖音热榜 今天',
  'site:news.cn 重要新闻 头条',
  'site:news.cn 今天 重要新闻',
  'site:people.com.cn 重要新闻 头条',
  'site:chinanews.com.cn 重要新闻 头条',
  'site:thepaper.cn 今日 要闻',
  'site:cctv.com 新闻联播 今天',
  'site:www.nanle.gov.cn 新闻 头条',
  'site:www.puyang.gov.cn 新闻 头条',
  '今天国内有哪些重要新闻',
];

async function main() {
  const config = await getSearchConfig();
  if (!config) {
    console.log(JSON.stringify({ error: 'no-config' }));
    return;
  }
  for (const q of QUERIES) {
    const t0 = Date.now();
    const r = await aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: false, timeoutMs: 25_000 });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(JSON.stringify({ q, ms, fail: r.reason }));
      continue;
    }
    console.log(JSON.stringify({
      q, ms, n: r.hits.length,
      hits: r.hits.map((h) => {
        let d = '?', p = '';
        try { const u = new URL(h.url); d = u.hostname; p = u.pathname.slice(0, 60); } catch { /* 地址不对 */ }
        return { d, p, t: h.title.slice(0, 36), pub: h.published.slice(0, 10) };
      }),
    }));
  }
}

main().catch((e) => console.log(JSON.stringify({ error: String(e?.message || e).slice(0, 200) })));
