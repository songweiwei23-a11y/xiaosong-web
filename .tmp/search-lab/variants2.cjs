/* 南乐新闻的几种写法，每种跑两次（搜索结果本身不稳定），看哪种最少混进天气页。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const WEATHER = /天气|气温|tianqi|weather|降雨/i;
const VARIANTS = [
  '本周 南乐有什么新闻',
  '南乐 本周 新闻 头条',
  '南乐 本周 新闻',
  '南乐新闻 头条 本周',
  '南乐 新闻 头条',
];
(async () => {
  const config = await b.getSearchConfig();
  const out = [];
  for (const q of VARIANTS) {
    for (let round = 1; round <= 2; round++) {
      const raw = await b.aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: true, today: '2026年10月17日', timeoutMs: 20_000 });
      if (!raw.ok) { out.push({ q, round, error: raw.reason }); console.log(`失败 ${q} #${round} ${raw.reason}`); continue; }
      const weather = raw.hits.filter((h) => WEATHER.test(`${h.title} ${new URL(h.url).hostname}`)).length;
      out.push({ q, round, hits: raw.hits.length, weather });
      console.log(`${String(raw.hits.length).padEnd(4)} 天气页${String(weather).padEnd(3)} ${q} #${round}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'variants2.json'), JSON.stringify(out, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
