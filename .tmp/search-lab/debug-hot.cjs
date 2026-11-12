/* 热榜平台搜索的逐条诊断：每条结果的内容长度、发布时间、路径，以及过滤后是否保留。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const QUERIES = ['site:s.weibo.com 热搜', 'site:zhihu.com 热榜'];
(async () => {
  const config = await b.getSearchConfig();
  const now = Date.now();
  for (const q of QUERIES) {
    const raw = await b.aliSearch(q, config, { topK: 10, way: 'pro-fetch', rewrite: false, today: '2026年10月17日', timeoutMs: 20_000 });
    if (!raw.ok) { console.log(`${q}: 失败 ${raw.reason}`); continue; }
    const kept = new Set(b.pickFreeChatSources(raw.hits, '今天有什么热搜', 2, now).map((h) => h.url));
    console.log(`=== ${q}  (${raw.hits.length} 条)`);
    for (const h of raw.hits) {
      console.log(`  ${kept.has(h.url) ? '保留' : '丢弃'} len=${String(h.content.trim().length).padStart(4)} pub=${(h.published || '-').slice(0, 10)} ${new URL(h.url).pathname.slice(0, 30).padEnd(30)} ${h.title.slice(0, 36)}`);
    }
  }
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
