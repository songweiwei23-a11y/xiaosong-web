/* 热榜、热搜的几种写法（指定站点 vs 不指定），每种跑一次，看结果来自哪些站。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const VARIANTS = [
  '知乎热榜',
  '知乎热榜 2026年10月',
  'site:zhihu.com 热榜',
  'site:www.zhihu.com/hot 热榜',
  '微博热搜 2026年10月',
  'site:s.weibo.com 热搜',
  '今日头条 热榜 2026年10月',
  'site:toutiao.com 热榜 2026年10月',
];
(async () => {
  const config = await b.getSearchConfig();
  for (const q of VARIANTS) {
    const raw = await b.aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: !/site:/i.test(q), today: '2026年10月17日', timeoutMs: 20_000 });
    if (!raw.ok) { console.log(`失败 ${raw.reason}  ${q}`); continue; }
    const hosts = raw.hits.slice(0, 5).map((h) => new URL(h.url).hostname).join(', ');
    console.log(`${String(raw.hits.length).padEnd(3)} ${q}  →  ${hosts}`);
  }
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
