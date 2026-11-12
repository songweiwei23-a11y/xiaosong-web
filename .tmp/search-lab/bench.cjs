/* 联网搜索基准：24 个真实口语问题，走完整链路（searchFreeChatWeb），统计自动触发、来源数、是否为空。在服务器上跑。 */
const fs = require('node:fs');
const path = require('node:path');
const envFile = process.env.ENV_FILE || path.join(__dirname, '..', '..', '.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const b = require('./bundle.cjs');
const QUESTIONS = [
  '今天北京天气怎么样',
  '今天上海有什么新闻',
  '最近国家有什么新的税收政策',
  '2026年中秋节放假安排',
  '特斯拉股价今天多少',
  '比特币现在价格多少',
  '最新的 iPhone 16 价格',
  '抖音本地生活商家入驻条件是什么',
  '小红书最近有什么新规则',
  '郑州地铁2号线今年开通了吗',
  '2026河南高考分数线',
  '现在的油价是多少',
  '微信视频号最新功能有哪些',
  '阿里云 联网搜索 计费规则 最新',
  'Dify 工作流 最新版本有什么新功能',
  '南乐县今天有什么通知',
  '濮阳最近有什么活动',
  '知乎热榜今天有什么',
  '抖音热搜今天有什么',
  '2026年上半年 GDP 增速',
  '最近有什么好看的电影',
  '今年的端午节是哪天',
  '最近的汇率 美元 人民币',
  '南乐 天气 今天',
];
(async () => {
  const config = await b.getSearchConfig();
  const rows = [];
  for (const q of QUESTIONS) {
    const auto = b.wantsWebSearch(q, 'auto');
    const t0 = Date.now();
    const r = await b.searchFreeChatWeb(q, { config, onStarted: async () => {} });
    const seconds = Math.round((Date.now() - t0) / 1000);
    const status = r ? r.status.status : 'no-config';
    const count = r ? r.status.sources.length : 0;
    rows.push({ q, auto, status, count, readCount: r ? r.readCount : 0, seconds, sources: r ? r.status.sources.map((s) => `${s.title.slice(0, 40)} | ${new URL(s.url).hostname}`) : [] });
    console.log(`${auto ? '[自动]' : '[  -  ]'} ${String(count).padStart(2)} 条 ${status.padEnd(12)} ${String(seconds).padStart(3)}s  ${q}`);
  }
  const auto = rows.filter((r) => r.auto).length;
  const empty = rows.filter((r) => r.count === 0).length;
  const withAny = rows.filter((r) => r.count > 0).length;
  console.log(`--- 汇总：${QUESTIONS.length} 题；自动触发 ${auto}；有来源 ${withAny}；没有来源 ${empty}`);
  fs.writeFileSync(path.join(__dirname, 'bench.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  console.log('DONE');
})().catch((e) => { console.error('BENCH FAILED', e); process.exitCode = 1; });
