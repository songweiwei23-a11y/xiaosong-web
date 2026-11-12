// 国家新闻站点与政府网址格式探测（真实阿里云调用，只读，不写库，不扣用户额度）。只输出域名、路径前段、标题和发布时间。
import { aliSearch } from '../lib/ali-search';
import { getSearchConfig } from '../lib/search-config';

const QUERIES = [
  'site:ifeng.com 要闻 今天',
  'site:jiemian.com 要闻 今天',
  'site:guancha.cn 要闻 今天',
  'site:163.com 新闻 要闻 今天',
  'site:sohu.com 要闻 今天',
  'site:cnr.cn 要闻 今天',
  'site:gmw.cn 要闻 今天',
  'site:xinhuanet.com 要闻 今天',
  'site:bjnews.com.cn 要闻 今天',
  'site:thepaper.cn 要闻 重要',
  'site:www.nanle.gov.cn 南乐 新闻',
  'site:www.puyang.gov.cn 南乐 新闻',
];

async function main() {
  const config = await getSearchConfig();
  if (!config) {
    console.log(JSON.stringify({ error: 'no-config' }));
    return;
  }
  for (const q of QUERIES) {
    const r = await aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: false, timeoutMs: 25_000 });
    if (!r.ok) {
      console.log(JSON.stringify({ q, fail: r.reason }));
      continue;
    }
    console.log(JSON.stringify({
      q, n: r.hits.length,
      hits: r.hits.map((h) => {
        let d = '?', p = '';
        try { const u = new URL(h.url); d = u.hostname; p = u.pathname.slice(0, 70); } catch { /* 地址不对 */ }
        return { d, p, t: h.title.slice(0, 30), pub: h.published.slice(0, 10) };
      }),
    }));
  }
}

main().catch((e) => console.log(JSON.stringify({ error: String(e?.message || e).slice(0, 200) })));
