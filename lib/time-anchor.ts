/**
 * 给模型一个「今天」：日期和季节按北京时间算，不受服务器时区影响。
 *
 * 为什么要有（2026-10-11 线上实测）：创作方向的输入里写着「秋天了」，输出却整篇写冬天——
 * 提示词里没有今天的日期，模型只能顺着档案和历史产出的时令走（档案里的冬季棚子、
 * 上一轮的冬季方向）。所以生成请求统一带上这一行，季节、节令以它为准。
 */
export function seasonOf(month: number): '春季' | '夏季' | '秋季' | '冬季' {
  if (month >= 3 && month <= 5) return '春季';
  if (month >= 6 && month <= 8) return '夏季';
  if (month >= 9 && month <= 11) return '秋季';
  return '冬季';
}

/** 北京时间的月份（1-12），与服务器时区无关 */
function beijingMonth(now: number): number {
  return new Date(now + 8 * 3600_000).getUTCMonth() + 1;
}

export function timeAnchor(now: number = Date.now()): string {
  const d = new Date(now + 8 * 3600_000); // 北京时间 = UTC+8，用 UTC 取字段，与服务器时区无关
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `【当前时间】今天是${y}年${m}月${day}日（北京时间，${seasonOf(m)}）。所有季节、节令、时间点都以今天为准：档案、定位、访谈和历史产出里写到的冬季等时令，若与今天不符，只能当作过去的事或计划，不能当成当下；本轮输入写到的季节与时间优先于其他来源。`;
}

/**
 * 时令错配（2026-10-11 企业商用检测：秋天里的脚本写「冬天在地摊吃火锅」「现在是冬天」）。
 * 只查两种：
 * 1. 现在时：「现在 / 眼下 / 目前 / 这两天…」紧挨着冬天或夏天（今天不是那个季节）。「下个冬天」「明年冬天」「等到冬天」是将来，不算。
 * 2. 客人反应：同一句里有「客人 / 顾客 / 客户」+「说 / 问 / 夸」，又带了今天不是的季节。
 * 本轮素材（known）里写过的同一说法不算错，那是用户自己的设定。
 */
const WINTER_WORD = '冬天|冬季|大冬天|寒冬|冬日';
const SUMMER_WORD = '夏天|夏季|盛夏|大夏天|酷暑|三伏';
const NOW_LEAD = '现在|眼下|目前|这两天|这几天|如今|此刻|正是|正值|当下';
// 「现在 10 月还没到冬季」「眼下还没入冬」是说还没到，不是把冬天当成当下
const FUTURE_MID = /下|明|等|快|准备|提前|期待|计划|将|会|要|入|去年|以前|过去|往年|之后|以后|上次|没|未|不到/;
/** 客人那句话里的将来说法：「会很冷」「快到冬天了」是预判，不是把事情当成已经发生 */
const FUTURE_SENT = /会|将|快|准备|明年|下个|期待|入冬|入夏|等到|去年|以前|过去|往年|上次/;

export function seasonMisstatements(text: string, now: number = Date.now(), known = ''): string[] {
  const season = seasonOf(beijingMonth(now));
  // 今天是冬天：夏天的说法是错的；今天是夏天：冬天的说法是错的；春秋两个都是错的
  const wrong = [season !== '冬季' ? WINTER_WORD : '', season !== '夏季' ? SUMMER_WORD : ''].filter(Boolean).join('|');
  if (!wrong) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (snippet: string) => {
    if (!snippet || seen.has(snippet) || (known && known.includes(snippet))) return;
    seen.add(snippet);
    out.push(`时令「${snippet}」与今天（${season}）不符，改成今天的时令或改写成过去、将来的事`);
  };

  for (const m of text.matchAll(new RegExp(`(${NOW_LEAD})([^，。！？；\\n]{0,8}?)(${wrong})`, 'g'))) {
    if (FUTURE_MID.test(m[2] ?? '')) continue;
    add(m[0]);
  }
  for (const sentence of text.split(/[。！？\n]/)) {
    if (!/客人|顾客|客户|食客/.test(sentence) || !/说|问|夸|反馈|评价/.test(sentence)) continue;
    if (FUTURE_SENT.test(sentence)) continue;
    const hit = sentence.match(new RegExp(wrong));
    if (hit) add(sentence.trim().slice(0, 40));
  }
  return out.slice(0, 4);
}
