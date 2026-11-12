/* 正文读取探测：对每个问题，搜索 → 过滤 → 逐个读保留下来的来源正文，统计失败原因。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const QUESTIONS = [
  '今天南乐有什么新闻',
  '濮阳本地最近有什么大事',
  '特斯拉最近股价',
  '郑州地铁现在票价是多少',
  '河南 2026 年高考时间',
  '抖音 小店 佣金 政策 2026',
  '2026年国庆节放假安排',
  '阿里云 OpenSearch 联网搜索 Lite 的价格是多少',
];
(async () => {
  const config = await b.getSearchConfig();
  const now = Date.now();
  const tally = {};
  const detail = [];
  for (const q of QUESTIONS) {
    const w = b.freeChatWebQuery(q, now);
    const raw = await b.aliSearch(w.query, config, { topK: 10, way: 'pro-fetch', rewrite: !/site:/i.test(w.query), today: w.today, timeoutMs: 20_000 });
    if (!raw.ok) { console.log(`${q}: 搜索失败 ${raw.reason}`); continue; }
    const kept = b.pickFreeChatSources(raw.hits, q, w.recencyDays, now);
    for (const h of kept) {
      let res;
      try { res = await b.fetchPage(h.url, { timeoutMs: 5000, maxBytes: 800_000 }); } catch (e) { res = { ok: false, reason: 'exception' }; }
      const key = res.ok ? 'ok' : `${res.reason}${res.status ? ' ' + res.status : ''}`;
      tally[key] = (tally[key] || 0) + 1;
      detail.push({ q, host: new URL(h.url).hostname, result: key });
    }
    console.log(`${q}: 保留 ${kept.length} 条来源`);
  }
  console.log('--- 读取结果统计 ---');
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(3)}  ${k}`);
  console.log('--- 按站点 ---');
  const byHost = {};
  for (const d of detail) (byHost[d.host] = byHost[d.host] || []).push(d.result);
  for (const [h, rs] of Object.entries(byHost)) console.log(`${h}: ${rs.join(', ')}`);
  console.log('DONE');
})().catch((e) => { console.error('PROBE FAILED', e); process.exitCode = 1; });
