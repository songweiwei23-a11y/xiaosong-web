/* 完整链路：用线上同一个 searchFreeChatWeb（含地方官网站点搜索、正文读取）跑本地新闻问题。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const QUESTIONS = ['知乎热榜今天有什么', '微博热搜今天有什么', '今天有什么热搜', '今天南乐有什么新闻', '濮阳本地最近有什么大事'];
(async () => {
  const config = await b.getSearchConfig();
  const out = [];
  for (const q of QUESTIONS) {
    const t0 = Date.now();
    const r = await b.searchFreeChatWeb(q, { config, onStarted: async () => {} });
    const seconds = Math.round((Date.now() - t0) / 1000);
    if (!r) { console.log(`${q}: 没有联网（无配置）`); continue; }
    console.log(`${q}  →  状态 ${r.status.status}，来源 ${r.status.sources.length} 条，读正文 ${r.readCount} 处，${seconds} 秒`);
    for (const s of r.status.sources) console.log(`    · ${s.title.slice(0, 50)} | ${new URL(s.url).hostname}`);
    out.push({ q, status: r.status.status, sources: r.status.sources, readCount: r.readCount, seconds });
  }
  fs.writeFileSync(path.join(__dirname, 'final.json'), JSON.stringify(out, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('FINAL FAILED', e); process.exitCode = 1; });
