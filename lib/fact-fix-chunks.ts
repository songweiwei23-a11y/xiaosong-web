/**
 * 长文的分段事实修正（2026-10-12）：定位类整篇 14k–19k 字，整篇交给修正模型重写，超过 7 分钟仍没返回，线上 180 秒就断了，
 * 所以定位类的修正 15/15 失败、板块一直 0/5。这里改成按二级标题切开，只修有问题的段落，段落并行修。
 * 每段的采用标准和整篇一样（lib/fact-fix 的 fixTooBig、问题数必须减少），不过就保留原段。
 */
import { buildFactFixPrompt, fixTooBig } from './fact-fix';

/** 超过这个长度才分段；短稿照旧整篇修 */
export const CHUNK_TRIGGER_CHARS = 6000;

/** 按二级标题切开，切开后用换行拼回去与原文一致 */
export function splitForFix(text: string): string[] {
  return text.split(/\n(?=## )/);
}

const NUMERIC_USAGE = ['prompt_tokens', 'completion_tokens', 'total_tokens', 'total_price'] as const;

/** 几次修正的用量加起来（计费和统计用），非数字字段保留第一次的 */
export function mergeUsage(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...b, ...a };
  for (const k of NUMERIC_USAGE) {
    const x = Number(a[k] ?? 0);
    const y = Number(b[k] ?? 0);
    if (Number.isFinite(x) && Number.isFinite(y)) out[k] = x + y;
  }
  return out;
}

export interface ChunkFixResult {
  text: string;
  tried: number;
  accepted: number;
}

/**
 * issuesOf：这一段有哪些没有出处的说法（与整篇用同一套检查）
 * ask：把修正提示词发给模型，返回清理后的修正稿；失败返回 null
 */
export async function fixInChunks(
  text: string,
  issuesOf: (t: string) => string[],
  ask: (prompt: string) => Promise<string | null>,
  context: string,
): Promise<ChunkFixResult> {
  let tried = 0;
  let accepted = 0;
  const parts = splitForFix(text);
  const done = await Promise.all(parts.map(async (chunk) => {
    const issues = issuesOf(chunk);
    if (!issues.length) return chunk;
    tried++;
    const fixed = await ask(buildFactFixPrompt({ text: chunk, issues, context }));
    if (!fixed || !fixed.trim() || fixTooBig(chunk, fixed, issues) || issuesOf(fixed).length >= issues.length) return chunk;
    accepted++;
    return fixed.trim();
  }));
  return { text: done.join('\n'), tried, accepted };
}
