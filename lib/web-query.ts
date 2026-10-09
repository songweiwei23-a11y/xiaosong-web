/**
 * 联网搜索专用的搜索词（2026-10-02）。
 *
 * 原来联网搜的是 start.search_query——那是给编导知识库准备的检索词，
 * 自由对话里则是用户原话整句。线上实测：
 *   问「根据濮阳最近一周的热点新闻 帮我创作几个爆款选题」→ 原句照搬去搜 →
 *   只回来 3 条：「濮阳」「社会科学」「要闻-濮阳教育」，全是门户首页。
 * 搜索引擎不懂「帮我创作」，也不知道今天几号，「最近一周」等于没说。
 *
 * 这里做两件事：
 *   1. 去掉指令部分，只留"要查的事"（濮阳 热点新闻）
 *   2. 相对时间换成具体日期（最近一周 → 2026年9月 10月），并给出时效窗口，
 *      Dify 整理结果时按它丢掉明显过期的网页（阿里云接口本身没有时间筛选参数）
 * 阿里云那边另开了 query_rewrite（8 月 31 日起不单独收费），today 也一并交给它。
 */

export interface WebQuery {
  /** 交给阿里云的搜索词 */
  query: string;
  /** 今天（北京时间），给阿里云改写搜索词时参考 */
  today: string;
  /** 问的是"最近 N 天"的事：整理结果时丢掉明显过期的；0 表示不限 */
  recencyDays: number;
}

// Dify搜索请求最多接受前300字符；保留长问题的比较对象与限定条件，避免100字符截断关键维度。
const MAX_LEN = 280;

/** 北京时间的年月日（服务器时区不一定是东八区） */
function cnDate(ms: number) {
  const d = new Date(ms + 8 * 3600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
const fmtDay = (ms: number) => { const x = cnDate(ms); return `${x.y}年${x.m}月${x.d}日`; };

/**
 * 今天（北京时间），给模型看的。
 * 模型自己不知道今天几号：线上实测它把 2026 年的搜索结果当成"未来日期的异常数据"全扔了，
 * 再自己编了一批旧来源。
 */
export const todayCN = (now: number = Date.now()) => fmtDay(now);

/** 从 days 天前到今天跨过的月份：「2026年9月 10月」 */
function monthsSpan(now: number, days: number): string {
  const a = cnDate(now - days * 86400_000);
  const b = cnDate(now);
  if (a.y === b.y && a.m === b.m) return `${b.y}年${b.m}月`;
  if (a.y === b.y) return `${a.y}年${a.m}月 ${b.m}月`;
  return `${a.y}年${a.m}月 ${b.y}年${b.m}月`;
}

/** 相对时间 → 具体日期。顺序有讲究：长的说法放前面，免得「最近」先把「最近一周」吃掉 */
const TIME_RULES: [RegExp, (now: number) => [string, number]][] = [
  [/今天|今日/g, (n) => [fmtDay(n), 2]],
  [/昨天|昨日/g, (n) => [fmtDay(n - 86400_000), 3]],
  [/(?:最近|近)(?:一|1)?(?:周|星期|7\s*天|七天)|这周|本周|这个星期|这几天|最近几天|近几天/g, (n) => [monthsSpan(n, 7), 10]],
  [/(?:最近|近)(?:半个?月|15\s*天)/g, (n) => [monthsSpan(n, 15), 20]],
  [/(?:最近|近)(?:一个?月|30\s*天)|这个月|本月/g, (n) => [monthsSpan(n, 30), 40]],
  [/(?:最近|近)(?:三个?月|一个?季度)|本季度/g, (n) => [monthsSpan(n, 90), 100]],
  [/今年|本年度?/g, (n) => [`${cnDate(n).y}年`, 370]],
  [/最近|最新|近期|眼下|当下|目前|现在/g, (n) => [monthsSpan(n, 30), 40]],
];

/**
 * 句首的指令词：说给 AI 听的，不是要搜的东西。
 * 只剥句首——句中的「联网搜索」可能是产品名（「阿里云 OpenSearch 联网搜索 Lite」）
 */
const LEAD_COMMAND_RE = /^(?:请|麻烦|帮我|帮忙|给我|你|能不能|可以)*\s*(?:联网|上网|在线)?\s*(?:搜索|搜一下|搜一搜|查一下|查一查|查询|查查|搜|查|看看|了解)?(?:一下)?\s*/;
/** 句中也不会是产品名的指令短语 */
const INNER_COMMAND_RE = /(?:帮我|给我|麻烦)(?:联网)?(?:查一下|搜一下|查查|查询|搜索)/g;

/** 任务部分从这里开始：「……，帮我创作几个爆款选题」只留逗号前 */
// 只移除创作交付或引用格式要求；“解释Memory与Vision的区别”也包含检索对象，不能整段丢掉。
const TASK_TAIL_RE = /[，,。；;！!？?\s]+(?:然后|再|并且?|顺便|最后)?(?:帮我|给我|请你?|你)?(?:写|创作|生成|做|出|策划|想|改写|编|控制在|(?:给出|附上|附带|标注)(?:官方)?(?:来源)?链接)[^，,。；;]*$/;
/** 「根据/结合/参考 X，……」只留 X */
const BASED_ON_RE = /^(?:根据|结合|参考|基于|围绕|就)\s*(.+?)(?:[，,。；;]|(?:帮我|给我|写|创作|生成|做|出|策划)).*$/;

export function buildWebQuery(question: string, now: number = Date.now()): WebQuery {
  let q = String(question ?? '').replace(/\s+/g, ' ').trim().replace(/[。！!？?；;，,\s]+$/, '');
  let recencyDays = 0;

  const based = q.match(BASED_ON_RE);
  if (based?.[1] && based[1].length >= 2) q = based[1];
  // 任务尾巴可能连着好几段，剥到剥不动为止
  for (let i = 0; i < 3 && TASK_TAIL_RE.test(q); i++) {
    const cut = q.replace(TASK_TAIL_RE, '');
    if (cut.trim().length < 2) break;
    q = cut;
  }

  q = q.replace(INNER_COMMAND_RE, ' ');
  for (let i = 0; i < 2; i++) q = q.replace(LEAD_COMMAND_RE, '');

  for (const [re, fn] of TIME_RULES) {
    if (re.test(q)) {
      re.lastIndex = 0;
      const [text, days] = fn(now);
      q = q.replace(re, ` ${text} `);
      recencyDays = recencyDays ? Math.min(recencyDays, days) : days;
    }
    re.lastIndex = 0;
  }

  q = q
    .replace(/(?:的|了|吗|呢|吧|啊)(?=\s|$)/g, ' ')
    // 日期替换后留下的「 的热点新闻」
    .replace(/(^|\s)的/g, '$1')
    .replace(/^[\s，,。；;：:]+|[\s，,。；;：:？?！!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN);

  // 剥完什么都不剩（比如只说了「联网查一下」），宁可用原话
  if (q.length < 2) q = String(question ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  return { query: q, today: fmtDay(now), recencyDays };
}
