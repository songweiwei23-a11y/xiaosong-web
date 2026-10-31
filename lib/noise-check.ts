/**
 * 无关信息检测（2026-11-01，整改方案阶段 0.2）：找出输出里新出现、而本次输入里没有的具体细节。
 *
 * 不靠词表。黑名单每出现一个新词就要补一条（「棚子」补了，「凌晨四点」又漏）。这里换个判断方式：
 *   1. 从输出里抽出具体细节：时段、日期、金额、百分数、年份、带单位的事实数字、经历句式；
 *   2. 到本次输入（档案、用户原话、选中的上游内容）里找；
 *   3. 找不到的，就是新出现的。
 * 中文数字和阿拉伯数字先统一再比，「下午四点」对得上档案里的「下午4点」。
 *
 * 不算的：【】里的占位、镜头时长（秒）、序号（第 N 步、第 N 周）、条数这类结构数字。
 */

export type ConcreteKind = 'time' | 'date' | 'money' | 'percent' | 'year' | 'quantity' | 'experience';

export interface ConcreteSpan {
  kind: ConcreteKind;
  /** 输出里的原文 */
  text: string;
  /** 统一数字、去掉空白后的比对键 */
  key: string;
  index: number;
}

const DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 中文数字转整数（到千位）；不是数字返回 null */
export function cnToInt(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const ch of s) {
    if (ch in DIGIT) { cur = DIGIT[ch]; seen = true; }
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; seen = true; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; seen = true; }
    else if (ch === '千') { total += (cur || 1) * 1000; cur = 0; seen = true; }
    else return null;
  }
  return seen ? total + cur : null;
}

/** 跟在数字后面、说明它是事实的单位（不含秒、条、个这类结构单位） */
const UNIT = '点|时|年|岁|元|块|万|斤|公斤|克|米|厘米|平米|平方|家|位|名|人|单|桌|串|碗|件|套|款|码|月|日|号|成|倍';
const CN_BEFORE_UNIT = new RegExp(`[零〇一二两三四五六七八九十百千]+(?=(?:${UNIT}))`, 'g');

/** 把单位前面的中文数字换成阿拉伯数字，去掉空白：「下午 四 点」→「下午4点」 */
export function normalizeDigits(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(CN_BEFORE_UNIT, (m) => {
      const n = cnToInt(m);
      return n === null ? m : String(n);
    });
}

const PERIOD = '凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|黄昏|晚上|深夜|半夜|夜里';
const CN_NUM = '[零〇一二两三四五六七八九十百千]';

const PATTERNS: { kind: ConcreteKind; re: RegExp }[] = [
  // 时段（可带几点）：凌晨、凌晨四点、下午4点半
  { kind: 'time', re: new RegExp(`(?:${PERIOD})(?:\\s*(?:\\d{1,2}|${CN_NUM}{1,3})\\s*(?:点|时)(?:半|\\d{1,2}分)?)?`, 'g') },
  // 只有几点：4点、10点半、四点（单独的「一点」是「一点点」，不算）
  { kind: 'time', re: /(?<![\d零〇一二两三四五六七八九十])(?:\d{1,2}|[二两三四五六七八九]|十[一二]?)\s*点(?:半|\d{1,2}分)?(?![钟多])/g },
  // 星期
  { kind: 'date', re: /(?:周|星期|礼拜)[一二三四五六日天]/g },
  // 几月几日
  { kind: 'date', re: new RegExp(`(?:\\d{1,2}|${CN_NUM}{1,3})月(?:(?:\\d{1,2}|${CN_NUM}{1,3})[日号])?`, 'g') },
  // 年份
  { kind: 'year', re: /(?:19|20)\d{2}\s*年/g },
  // 金额：15块、1元、3万元、¥99
  { kind: 'money', re: new RegExp(`(?:¥\\s*\\d+(?:\\.\\d+)?)|(?:(?:\\d+(?:\\.\\d+)?|${CN_NUM}+)\\s*(?:元|块钱?|万元?))`, 'g') },
  // 百分数
  { kind: 'percent', re: /\d+(?:\.\d+)?\s*%|百分之[零〇一二两三四五六七八九十百]+/g },
  // 带单位的事实数字：9年、50码、3家；「第 N」开头的是序号，不算
  { kind: 'quantity', re: new RegExp(`(?<!第)(?:\\d+(?:\\.\\d+)?|[两三四五六七八九十百千][零〇一二两三四五六七八九十百千]*)\\s*(?:年|岁|斤|公斤|克|米|厘米|平米|平方|家|位|名|单|桌|串|碗|件|套|款|码)`, 'g') },
  // 经历句式：编出来的经历最常见的开头
  { kind: 'experience', re: /我每次|我平时|我习惯|我一般|我通常|我向来|我从来|有一次|那一次|上次有|前两天|前几天|上周|上个月|昨天|那天|有位(?:顾客|客人|阿姨|大姐|老板)|有个(?:顾客|客人|老顾客|熟客)|老顾客说|客人说|顾客说/g },
];

/** 【】里的占位、镜头时长、序号不算具体细节：先把这些位置挖掉 */
function maskedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const re of [/【[^】]*】/g, /\d+\s*[-—–~～]\s*\d+\s*秒/g, /第\s*[\d零〇一二两三四五六七八九十]+\s*(?:计|步|段|条|个|镜|点|节|周|天|轮|集|期|名|位)/g]) {
    for (const m of text.matchAll(re)) ranges.push([m.index!, m.index! + m[0].length]);
  }
  return ranges;
}

const inside = (ranges: [number, number][], at: number) => ranges.some(([a, b]) => at >= a && at < b);

/** 抽出一段文字里的全部具体细节（按位置排序，同一位置只留最长的那一个） */
export function extractConcrete(text: string): ConcreteSpan[] {
  const masked = maskedRanges(text);
  const found: ConcreteSpan[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const raw = m[0].trim();
      if (!raw || inside(masked, m.index!)) continue;
      found.push({ kind, text: raw, key: normalizeDigits(raw), index: m.index! });
    }
  }
  found.sort((a, b) => a.index - b.index || b.text.length - a.text.length);
  // 去掉被更长匹配覆盖的（「下午4点」里的「4点」）
  const kept: ConcreteSpan[] = [];
  for (const s of found) {
    const covered = kept.some((k) => s.index >= k.index && s.index + s.text.length <= k.index + k.text.length);
    if (!covered) kept.push(s);
  }
  return kept;
}

export interface NoiseReport {
  /** 输出里全部具体细节 */
  spans: ConcreteSpan[];
  /** 其中输入里找不到的（按比对键去重） */
  novel: ConcreteSpan[];
  byKind: Partial<Record<ConcreteKind, number>>;
}

/**
 * 输出里新出现的具体细节。inputs 是本次输入的全部材料：档案摘要、用户原话、选中的上游内容。
 * 不要把规则文字当输入传进来——规则里的举例（「12 条里 5 条」）会把真正新出现的数字遮住。
 */
export function noiseReport(output: string, inputs: string[]): NoiseReport {
  const haystack = normalizeDigits(inputs.filter(Boolean).join('\n'));
  const spans = extractConcrete(output);
  const seen = new Set<string>();
  const novel: ConcreteSpan[] = [];
  for (const s of spans) {
    if (haystack.includes(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    novel.push(s);
  }
  const byKind: Partial<Record<ConcreteKind, number>> = {};
  for (const s of novel) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  return { spans, novel, byKind };
}
