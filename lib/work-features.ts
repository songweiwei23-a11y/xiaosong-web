/**
 * 作品的写法特征（二期 B 阶段，见 docs/越用越懂你_二期方案_20261017.md 4.3）：
 * 把一条作品的口播按程序能稳定判断的几个特征归类，用来和它录下的数据（完播）对照。
 *
 * 只看两样：开头第一句的写法、口播字数。判不准的宁可归「其他」，不硬归类，
 * 所以不会因为模型乱猜而学出假规律。
 */

export type OpeningKind = 'question' | 'number' | 'conclusion' | 'scene' | 'other';
export type LengthKind = 'short' | 'mid' | 'long';

/** 口播字数分档（中文字数，约 5 字 / 秒）：约 40 秒内 / 40～75 秒 / 75 秒以上 */
export const SHORT_MAX = 200;
export const LONG_MIN = 380;

/** 口播里的中文字数（去掉标点、数字、英文），用来估长度 */
export function spokenChars(text: string): number {
  return (text.match(/[一-龥]/g) ?? []).length;
}

export function lengthKind(chars: number): LengthKind {
  if (chars <= SHORT_MAX) return 'short';
  if (chars >= LONG_MIN) return 'long';
  return 'mid';
}

/**
 * 第一句：跳过标题行（以 # 开头的），去掉标题符号、引号和空白，到句末标点为止，最多 40 字。
 * 先按行找，再切句：不能先把换行删掉，否则标题和正文会粘成一句。
 */
export function firstSentence(spoken: string): string {
  const line = spoken
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.replace(/[*>【】「」“”"'\-]/g, '').trim())
    .find((l) => l) ?? '';
  return line.replace(/\s+/g, '').split(/[。！？!?]/)[0].slice(0, 40);
}

/** 开头的写法：问句、带数字或价格、直接给结论、从现场或经过切入，其余归「其他」 */
export function openingKind(spoken: string): OpeningKind {
  const first = firstSentence(spoken);
  if (!first) return 'other';
  if (/[？?]/.test(first) || /^(你|为什么|怎么|是不是|有没有|要不要|你知道)/.test(first)) return 'question';
  if (/\d/.test(first.slice(0, 30)) || /[元块%]/.test(first.slice(0, 30))) return 'number';
  if (/^(其实|真相|结论|答案|记住|说白了|一句话|先说结论|直接说)/.test(first)) return 'conclusion';
  if (/^(今天|昨天|前天|上周|昨晚|凌晨|早上|中午|晚上|刚刚|前两天|有一天|这天|那天)/.test(first)) return 'scene';
  return 'other';
}

export interface WorkFeatures { opening: OpeningKind; length: LengthKind; chars: number }

export function featuresOf(spoken: string): WorkFeatures {
  const chars = spokenChars(spoken);
  return { opening: openingKind(spoken), length: lengthKind(chars), chars };
}
