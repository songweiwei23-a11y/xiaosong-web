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
/** 不带几点也算具体场景的时段：少见、一出现就是在描述某个具体时刻。早上、晚上这类太常见，单独出现不算 */
const RARE_PERIOD = '凌晨|深夜|半夜';
const CN_NUM = '[零〇一二两三四五六七八九十百千]';

const PATTERNS: { kind: ConcreteKind; re: RegExp }[] = [
  // 时段加几点：凌晨四点、下午4点半
  { kind: 'time', re: new RegExp(`(?:${PERIOD})\\s*(?:\\d{1,2}|${CN_NUM}{1,3})\\s*(?:点|时)(?:半|\\d{1,2}分)?`, 'g') },
  // 只有少见的时段：凌晨、深夜、半夜
  { kind: 'time', re: new RegExp(`(?:${RARE_PERIOD})`, 'g') },
  // 阿拉伯数字的几点：4点、16点、10点半（不要求后面跟什么）
  { kind: 'time', re: /(?<![\d零〇一二两三四五六七八九十])\d{1,2}\s*点(?:半|\d{1,2}分)?(?![钟多])/g },
  // 中文数字的几点：后面要跟出摊、开门这类动作，或「钟、半、整」。「原因有三点」不是时间
  { kind: 'time', re: /(?<![\d零〇一二两三四五六七八九十几])(?:[二两三四五六七八九]|十[一二]?)点(?=钟|半|整|多|左右|出|开|收|关|到|起|前|后)/g },
  // 星期（「上周一个上班族」不是周一）
  { kind: 'date', re: /(?:周|星期|礼拜)[一二三四五六日天](?![个位次些下点])/g },
  // 几月几日
  { kind: 'date', re: new RegExp(`(?:\\d{1,2}|${CN_NUM}{1,3})月(?:(?:\\d{1,2}|${CN_NUM}{1,3})[日号])?`, 'g') },
  // 年份
  { kind: 'year', re: /(?:19|20)\d{2}\s*年/g },
  // 金额：15块、1元、3万元、¥99。中文数字后面单独一个「块」多半是量词（一块木料），要带「钱」才算
  { kind: 'money', re: new RegExp(`(?:¥\\s*\\d+(?:\\.\\d+)?)|(?:\\d+(?:\\.\\d+)?\\s*(?:元|块钱?|万元?))|(?:${CN_NUM}+\\s*(?:元|块钱|万元))`, 'g') },
  // 百分数
  { kind: 'percent', re: /\d+(?:\.\d+)?\s*%|百分之[零〇一二两三四五六七八九十百]+/g },
  // 带单位的事实数字：9年、50码、3家；「第 N」开头的是序号，「几十年」是约数，不算。
  // 中文数字只认度量和年限（两件事、五件套、三点原因是计数，不是事实）
  // 件、套、款在方案里几乎都是计数（3件事、3件日常小事、10件以上事件），不算；「镜头9单独拍」里的「9单」是切错了
  { kind: 'quantity', re: /(?<![第几\d])\d+(?:\.\d+)?\s*(?:年|岁|斤|公斤|克|米|厘米|平米|平方|家|位|名|单(?!独)|桌|串|碗|码)/g },
  { kind: 'quantity', re: new RegExp(`(?<![第几零〇一二两三四五六七八九十百千])[两三四五六七八九十百千][零〇一二两三四五六七八九十百千]*\\s*(?:年|岁|斤|公斤|克|米|厘米|平米|平方)`, 'g') },
  // 经历句式：编出来的经历最常见的开头（「上个月」「上周」在规划里是正常用语，不算）
  { kind: 'experience', re: /我每次|我平时|我习惯|我一般|我通常|我向来|我从来|有一次|那一次|上次有|前两天|前几天|昨天|有位(?:顾客|客人|阿姨|大姐|老板)|有个(?:顾客|客人|老顾客|熟客)|老顾客说|客人说|顾客说(?!过)/g },
];

/** 24 小时制的几点，换成 12 小时制再比一次：「16点」对得上「下午4点」 */
function altKeys(s: { kind: ConcreteKind; key: string }): string[] {
  const m = s.kind === 'time' ? s.key.match(/^(\d{1,2})点/) : null;
  if (!m) return [];
  const n = Number(m[1]);
  return n >= 13 && n <= 23 ? [`${n - 12}点`] : [];
}

/**
 * 【】里的占位、镜头时长、序号不算具体细节：先把这些位置挖掉。
 * 分镜自己算的统计（「特写占比：0%」「近景 7 个」）也挖掉：那是对自己镜头表的统计，不是事实。
 */
function maskedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const re of [/【[^】]*】/g, /\d+\s*[-—–~～]\s*\d+\s*秒(?:\s*[（(]\s*\d+(?:\.\d+)?\s*%\s*[)）])?/g,/第\s*[\d零〇一二两三四五六七八九十]+\s*(?:计|步|段|条|个|镜|点|节|周|天|轮|集|期|名|位)/g, /镜头\s*\d+/g, /[^\n]*(?:特写|近景|中景|全景|远景|景别|运镜|镜头)[^\n]*占比[^\n]*/g]) {
    for (const m of text.matchAll(re)) ranges.push([m.index!, m.index! + m[0].length]);
  }
  return ranges;
}

const inside = (ranges: [number, number][], at: number) => ranges.some(([a, b]) => at >= a && at < b);

/** 一个位置所在的那一句（按句号、问号、叹号、分号、换行切） */
function sentenceAt(text: string, at: number): string {
  const stop = /[。！？!?；;\n]/;
  let a = at;
  while (a > 0 && !stop.test(text[a - 1])) a--;
  let b = at;
  while (b < text.length && !stop.test(text[b])) b++;
  return text.slice(a, Math.min(text.length, b + 1));
}

/**
 * 句子在说「不要这样写」：模型在引用禁令（「不能写成『前两天有个客户』」），里面的细节不是它编的。
 * 自查清单也是（「未使用"100%"等违规词」「未编造『有位顾客说』」）。
 * 经历句式另外排除问句和条件句：「如果有一次……」「当时顾客说了什么？」「我平时能不能打理」（这是教观众怎么问）。
 */
const NEGATED = /不能|不要|不写|不得|别把|别写|避免|禁止|擅自|不许|不准|不编|不把|没说过|没提过|不拍[“"「『]|未使用|未编|未承诺|未出现|没有编|不应|违规词|绝对化/;
const HYPOTHETICAL = /如果|假如|若|是否|有没有|能不能|会不会|吗|？|\?/;
/**
 * 拍摄和发布建议里的时间、距离（「场景设置：上午 10 点」「收声：距离 1 米内」「发布时间 19-21 点」）
 * 是给拍摄者的参数，不是在讲这家店的事实：不算。经历句式不受影响。
 */
const ADVICE = /场景设置|发布时间|拍摄时间|拍摄要点|收音|收声|机位|距离|时段/;
/**
 * 规划里的比例（「题材比例：主赛道约 70%」、形式占比表里的「故事 | 20%」、「流量型45%」）是模板要它填的配比，不是在讲事实：百分数不算。
 * 看这一句、它上面三行（小标题常在上面一行）和所在表格的表头；紧跟在「X型」后面的百分数也算配比。
 */
const PLANNING = /比例|配比|占比|分配|题材|主赛道|总计/;

function planningContext(text: string, at: number): string {
  const lines = text.slice(0, at).split('\n');
  const current = (lines.pop() ?? '') + text.slice(at).split('\n')[0];
  const above = lines.filter((l) => l.trim()).slice(-3);
  let header = '';
  if (current.trim().startsWith('|')) {
    for (let i = lines.length - 1; i >= 0 && lines[i].trim().startsWith('|'); i--) header = lines[i];
  }
  return [...above, header].join('\n');
}

const isPlanningPercent = (text: string, at: number, sentence: string) =>
  /型\s*约?\s*$/.test(text.slice(Math.max(0, at - 3), at)) || PLANNING.test(sentence) || PLANNING.test(planningContext(text, at));

/**
 * 禁令写成列表时，否定词在列表上面那一行（「不能擅自添加：」），列表项本身没有。
 * 所以一行是列表项时，往上找到这组列表的引导行（以冒号结尾的那一行），看它是不是禁令。
 */
function listLeadNegated(text: string, at: number): boolean {
  const lines = text.slice(0, at).split('\n');
  const current = (lines.pop() ?? '') + text.slice(at).split('\n')[0];
  if (!/^\s*(?:[-*•·]|\d+[.、)）])\s*/.test(current)) return false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(?:[-*•·]|\d+[.、)）])\s*/.test(line)) continue;
    return /[：:]\s*$/.test(line) && NEGATED.test(line);
  }
  return false;
}

/** 抽出一段文字里的全部具体细节（按位置排序，同一位置只留最长的那一个） */
export function extractConcrete(text: string): ConcreteSpan[] {
  const masked = maskedRanges(text);
  const found: ConcreteSpan[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const raw = m[0].trim();
      if (!raw || inside(masked, m.index!)) continue;
      const sentence = sentenceAt(text, m.index!);
      if (NEGATED.test(sentence) || listLeadNegated(text, m.index!)) continue;
      if (kind === 'experience' && HYPOTHETICAL.test(sentence)) continue;
      if (kind !== 'experience' && ADVICE.test(sentence)) continue;
      if (kind === 'percent' && isPlanningPercent(text, m.index!, sentence)) continue;
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
    if (haystack.includes(s.key) || altKeys(s).some((k) => haystack.includes(k)) || seen.has(s.key)) continue;
    seen.add(s.key);
    novel.push(s);
  }
  const byKind: Partial<Record<ConcreteKind, number>> = {};
  for (const s of novel) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  return { spans, novel, byKind };
}
