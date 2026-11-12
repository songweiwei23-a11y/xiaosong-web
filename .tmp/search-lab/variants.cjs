/* 同一个问题的几种写法，看哪种搜得到（只调阿里云，不读正文）。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const VARIANTS = [
  '北京今天天气怎么样',
  '北京 2026年10月17日 天气',
  '北京天气',
  '北京 天气 本周',
  '知乎热榜今天有什么',
  '知乎热榜 2026年10月',
  '知乎热榜',
  '今天南乐有什么新闻',
  '南乐 新闻 本周',
  '2026年10月 南乐 新闻',
  '郑州地铁现在票价是多少',
  '郑州地铁票价 2026年',
];
(async () => {
  const config = await b.getSearchConfig();
  const out = [];
  for (const q of VARIANTS) {
    const raw = await b.aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: true, today: '2026年10月17日', timeoutMs: 20_000 });
    const n = raw.ok ? raw.hits.length : `失败:${raw.reason}`;
    out.push({ q, n, top: raw.ok ? raw.hits.slice(0, 2).map((h) => `${h.title.slice(0, 30)} | ${new URL(h.url).hostname}`) : [] });
    console.log(`${String(n).padEnd(6)} ${q}`);
  }
  fs.writeFileSync(path.join(__dirname, 'variants.json'), JSON.stringify(out, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
