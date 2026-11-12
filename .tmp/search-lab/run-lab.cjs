/* 联网搜索实验：用自由对话同一套函数，逐个问题看每一步剩下多少。
 * 只调阿里云搜索（不读网页正文），和线上 searchFreeChatWeb 的第一步一致。 */
const fs = require('node:fs');
const path = require('node:path');

// 环境文件可用 ENV_FILE 指定（在服务器上跑时指向线上应用的 .env.local，搜索密钥只在那里能解开）
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');

const QUESTIONS = [
  '今天南乐有什么新闻',
  '最近抖音本地生活有什么新规则',
  '2026年国庆节放假安排',
  '最新的 iPhone 发布会是什么时候',
  '北京今天天气怎么样',
  '阿里云 OpenSearch 联网搜索 Lite 的价格是多少',
  'Dify 的 LLM 节点支持哪些模型',
  '郑州地铁现在票价是多少',
  '特斯拉最近股价',
  '知乎热榜今天有什么',
  '抖音 小店 佣金 政策 2026',
  '河南 2026 年高考时间',
  '抖音短视频完播率行业平均是多少',
  '濮阳本地最近有什么大事',
];

(async () => {
  const config = await b.getSearchConfig();
  if (!config) { console.log('NO SEARCH CONFIG'); process.exit(1); }
  console.log(`config source: ${config.source}`);
  const now = Date.now();
  const rows = [];
  for (const q of QUESTIONS) {
    const auto = b.wantsWebSearch(q, 'auto');
    const w = b.freeChatWebQuery(q, now);
    const raw = await b.aliSearch(w.query, config, { topK: 10, way: 'pro-fetch', rewrite: !/site:/i.test(w.query), today: w.today, timeoutMs: 20_000 });
    const row = { question: q, autoTrigger: auto, searchQuery: w.query, recencyDays: w.recencyDays };
    if (!raw.ok) {
      row.aliYun = `失败: ${raw.reason}${raw.status ? ' ' + raw.status : ''}`;
    } else {
      const hits = raw.hits;
      row.aliYunHits = hits.length;
      row.withPublishedDate = hits.filter((h) => h.published).length;
      row.withSubstantiveContent = hits.filter((h) => h.content.trim().length >= 150).length;
      row.rawTop = hits.slice(0, 6).map((h) => `${h.title.slice(0, 40)} | ${new URL(h.url).hostname}${h.published ? ' | ' + h.published.slice(0, 10) : ''}`);
      const picked = b.pickFreeChatSources(hits, q, w.recencyDays, now);
      row.kept = picked.length;
      row.keptTop = picked.map((h) => `${h.title.slice(0, 40)} | ${new URL(h.url).hostname}`);
    }
    rows.push(row);
    const summary = raw.ok ? `阿里云${row.aliYunHits}条 → 保留${row.kept}条` : row.aliYun;
    console.log(`${auto ? '[自动联网]' : '[不联网  ]'} ${q}  →  ${summary}`);
  }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('LAB FAILED', e); process.exitCode = 1; });
