/**
 * 现实检查（2026-10-26）：生成结果里出现「收腰就能换风格」「同一件外套两种人」这类不符合现实的说法，
 * 我们自己识别出来，只让模型改写这一句，别的一字不动（精准小改），和标题后处理同一个做法。
 * 改完不合格就保留原句，不为了改而改坏别的。
 */

/**
 * 不符合现实的说法：靠一个小动作、一句话、一个技巧就让整体改变，或几天就能见效的保证。
 * 跨行业通用，与 lib/sharp-rules 的 REALITY_RULE 对应。
 */
export const UNREALISTIC_PATTERNS: RegExp[] = [
  // 一个小动作/一个细节就换掉整体：收腰就能换风格、换个头像就翻倍、换一种塞法就是两种身材
  /(收腰|换个|换一个|换种|改个|改一个|一个小|一个细节|一个动作|一招|一句话|一个技巧).{0,8}(就能|就会|就可以|就是|就变).{0,10}(换|变|穿出|翻倍|判若两人|两种|几种|三种|另一个|完全不同的)/,
  /只(需|要)(换|改|做|说)?(一个|一招|一步|一下|一个小|一句|一个细节).{0,10}(就能|就会|就可以|就是)/,
  /换(个|一个|种)?.{0,10}就(翻倍|翻番|涨粉|暴涨|成交)/,
  /(一招|一句话|一个技巧|一个动作).{0,4}(让|能让|就让|使).{0,10}(当场|立刻|马上|一下子).{0,6}(签单|下单|成交|买单|付款|涨粉|翻倍)/,
  // 一样东西穿出/变出好几个人或风格
  /同一(件|个|套|种|份).{0,12}(两种|几种|三种|不同)(人|风格|身份|性格)/,
  /一(件|套|个|种).{0,10}(穿出|变出|做出|演出)\s*(\d+|几|两|三|不同)\s*(种|个)(风格|人|性格|身份|气质|效果)/,
  // 判若两人、换了个人：一个变化不可能让人判若两人
  /判若两人|换了个人|变成另一个人|完全换了一个人/,
  // 几天就能见效的保证
  /(\d+|几)\s*(天|周|个月)(就能|就会|保证).{0,8}(涨粉|成交|出单|变瘦|月入|翻倍|破万|爆)/,
  /保证.{0,6}(涨粉|成交|出单|爆|月入|变瘦|涨粉丝|赚钱)/,
  // 太简单：一招搞定、躺着就赚、不费吹灰之力
  /一(招|句话|个动作|个技巧|步)(就)?(搞定|解决|灵|见效|搞掂)/,
  /躺着(就)?(能)?(赚|月入)|轻轻松松(就)?(月入|赚|涨粉|成交|搞定)|不费吹灰之力/,
  // 太不科学：吃喝敷涂就能瘦、治病、美白，没有依据的因果
  /(喝|吃|敷|涂|按摩|泡|贴)[^，。\n]{0,8}(就能|就会|就可以)(瘦|治|消炎|排毒|美白|祛斑|抗衰|降血压|根治)/,
  // 服装身材的具体数字效果
  /(显瘦|显高|显胖|显矮).{0,8}(\d+\s*(厘米|cm|斤|公斤)|十厘米)/,
];

/** 一句话改写后最多多少字，超过就不采用（防止改成一大段） */
export const REALITY_MAX_CHARS = 80;

export function isUnrealisticSentence(sentence: string): boolean {
  return UNREALISTIC_PATTERNS.some((re) => re.test(sentence));
}

/** 句子开头的标签（「- **出发点**：」这种）单独拿出来，只改标签后面的正文 */
export function splitLabel(sentence: string): { label: string; body: string } {
  const m = sentence.match(/^(\s*[-*]\s*\*\*[^*\n]{1,12}\*\*[：:])/);
  if (!m) return { label: '', body: sentence };
  return { label: m[1], body: sentence.slice(m[1].length) };
}

/** 全文里不符合现实的句子，去重。按句号、问号、感叹号和换行切句 */
export function findUnrealisticSentences(text: string): string[] {
  const found = new Set<string>();
  for (const piece of text.split(/(?<=[。！？\n])/)) {
    const sentence = piece.trim();
    if (sentence && isUnrealisticSentence(sentence)) found.add(sentence);
  }
  return [...found];
}

/** 只让模型改写这一句；只输出改后的一句话，不要解释 */
export function repairRealityPrompt(sentence: string, context: string): string {
  const { body } = splitLabel(sentence);
  return `只改写下面这一句，去掉不符合现实的说法。一件衣服改不了版型、身材比例和面料，只能改搭配、穿法和场景。
保留原来讲的事和画面，改成镜头里能拍出来的具体变化。只输出改后的这一句，一行，不要解释、不要序号。

原句：${body}
${context ? `\n这条内容的背景（只用来保持方向一致）：${context}` : ''}`;
}

/** 模型的回答能不能采用：一行、不超标、不再是不符合现实的说法、和原句不同 */
export function acceptRealityRepair(original: string, answer: string | null): string | null {
  if (!answer) return null;
  const clean = answer.trim().replace(/^[★\s"“「]+/, '').replace(/[\s"”」]+$/, '');
  if (!clean || clean.includes('\n')) return null;
  if (clean.length > REALITY_MAX_CHARS) return null;
  if (isUnrealisticSentence(clean)) return null;
  if (clean === splitLabel(original).body) return null;
  return clean;
}

export interface RealityPolishResult {
  text: string;
  tried: number;
  accepted: number;
}

/**
 * ask：把修改提示词发给模型，返回一行回答；失败返回 null。
 * 每句单独改，改完只替换这一句（带标签的保留标签），别的句子一字不动。
 */
export async function polishReality(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  context = '',
): Promise<RealityPolishResult> {
  let out = text;
  let tried = 0;
  let accepted = 0;
  for (const sentence of findUnrealisticSentences(text)) {
    tried++;
    const { label } = splitLabel(sentence);
    const next = acceptRealityRepair(sentence, await ask(repairRealityPrompt(sentence, context)));
    if (!next) continue;
    out = out.split(sentence).join(label + next);
    accepted++;
  }
  return { text: out, tried, accepted };
}
