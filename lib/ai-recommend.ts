/**
 * 「AI 推荐」的统一口径（2026-10-06 产品方）。
 *
 * 编导选「AI 推荐」或者什么都没选，要的是质量最好的结果，不是一个保守的默认值。
 * 原来各板块在这种时候偷偷填 60 秒、拿 60 秒的范例给模型看、按平台写死时长——模型照着压缩内容。
 * 现在：编导选了什么就按什么来；没选 / 选了 AI 推荐，就不设上限，先保证内容精彩。
 * 成片偏长没关系，编导可以自己去审稿优化里缩。
 */
export const AI_LENGTH_RULE = '内容精彩优先，时长权重低于内容：先保证内容讲透、讲精彩——该有的情节、细节、对话、情绪转折一个不少，不为了短而压缩或删减；时长只是次要参考，不凑长、不注水；讲完就收。最后偏长没关系，编导会自己去审稿优化里缩';

/** 范例只学结构，不学长度 */
export const EXAMPLE_LENGTH_NOTE = '范例有多长不代表这条要多长，时长按本条的设置和内容需要来';

/** 口播按每秒约 5 个字估算（与审稿、质检的口径一致） */
export const SPEECH_CHARS_PER_SECOND = 5;

/** 「15-30秒」取上限 30；「3分钟」取 180；取不到数字返回 null */
export function durationCeilingSeconds(duration: string): number | null {
  const m = duration.match(/(\d+(?:\.\d+)?)(?:\s*[-~至]\s*(\d+(?:\.\d+)?))?\s*(秒|分钟)/);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return m[3] === '分钟' ? n * 60 : n;
}

/**
 * 时长口径（2026-10-11 产品方：效果最佳优先；编导设了时长就按它写，没设就内容优先、时长权重更低）。
 * - 编导明确设了时长：严格按它写，给出口播字数上限；超了就删次要的铺垫和细节，不因为「讲精彩」就超时。
 * - 没设（空、「AI推荐」「AI自行推断」）：内容精彩优先，时长只是次要参考。
 */
/**
 * 脚本生成的默认时长（2026-10-17 产品方）：选「AI 推荐」或没选，默认写到 1分30秒～1分40秒。
 * 只给脚本生成用；审稿、二创还是 AI_LENGTH_RULE 的口径。
 */
export const AI_SCRIPT_TARGET_TEXT = '1分30秒～1分40秒';
export const AI_SCRIPT_LENGTH_RULE = `默认写到${AI_SCRIPT_TARGET_TEXT}（约 90～100 秒），口播约 450～500 字。内容精彩优先：该有的情节、细节、对话、情绪转折写足，内容讲到这个长度；不为了凑时长注水，也不在结尾硬加废话`;

/**
 * 脚本生成的时长规则：
 * - 选「AI 推荐」或没选：按 AI_SCRIPT_LENGTH_RULE，默认 1分30秒～1分40秒；
 * - 编导设了时长：严格按设定写（durationRule 的口径），口播字数在设定时长的 90%～100% 之间，
 *   不明显短于设定，也不超出。
 */
export function scriptLengthRule(duration: string | null | undefined): string {
  const d = (duration ?? '').trim();
  if (!d || /AI/.test(d)) return AI_SCRIPT_LENGTH_RULE;
  const sec = durationCeilingSeconds(d);
  if (!sec) return durationRule(d);
  const hi = Math.round(sec * SPEECH_CHARS_PER_SECOND);
  const lo = Math.round(hi * 0.9);
  return `${durationRule(d)}。同时不明显短于 ${d}：口播约 ${lo}～${hi} 字，内容讲到这个长度`;
}

export function durationRule(duration: string | null | undefined): string {
  const d = (duration ?? '').trim();
  if (!d || /AI/.test(d)) return AI_LENGTH_RULE;
  const sec = durationCeilingSeconds(d);
  const budget = sec ? Math.round(sec * SPEECH_CHARS_PER_SECOND) : null;
  return `严格按 ${d} 写${budget ? `：口播约每秒 ${SPEECH_CHARS_PER_SECOND} 个字，${d}的口播不超过约 ${budget} 字` : ''}。超出就删次要的铺垫、重复和细节，保住最精彩的那部分；不因为要讲精彩就超时，也不为写满而注水`;
}
