/**
 * 年限修复（2026-10-28，和现实修复同一个做法）：
 * 结果里「干这行 N 年」「在本地 N 年」「店龄 N 年」对不上事实卡，只让模型改写那一句，别的一字不动。
 * 整句由 lib/quality-checks 的 yearConflictSentences 从稿子里取出（原文真实存在的句子）；
 * 改写要过同一套年限检查才采用，否则保留原句。修复只在生成后的交付前做一次，和现实修复、事实修正并排。
 */
import { readPersonaFacts } from './persona-facts';
import { yearConflictSentences, yearConflicts } from './quality-checks';
import { replaceEachSentence, type RealityPolishResult } from './reality-check';

/** 事实卡里的经历，逐条列给模型：只认这些年数 */
export function yearsFactLines(persona: unknown): string {
  const f = readPersonaFacts(persona);
  return [
    f.yearsInTrade && `干这行：${f.yearsInTrade}`,
    f.yearsLocal && `在本地：${f.yearsLocal}`,
    f.story && `一句话经历：${f.story}`,
    f.others && `其他硬事实：${f.others.replace(/\n/g, '；')}`,
  ].filter(Boolean).join('\n');
}

/** 改写的提示词：只改这一句的年数，让它和事实卡一致 */
export function yearsRepairPrompt(sentence: string, facts: string, context: string): string {
  return `只改写下面这一句里的年数，让它和事实卡一致。事实卡（只认这里的年数，别的年数不写）：
${facts}
干这行、在本地居住、店龄是三件不同的事，不能互换：开店几年不等于来本地几年，从业几年也不等于店龄。
这句讲的事、画面和语气保持不变，只改年数和它的说法。只输出改后的这一句，一行，不要解释、不要序号。

原句：${sentence}
${context ? `\n这条内容的背景（只用来保持方向一致）：${context}` : ''}`;
}

/** 改写能不能采用：一行、不比原句长出一大截、年限不再打架。不合格返回 null，保留原句 */
export function acceptYearsRepair(sentence: string, answer: string | null, persona: unknown): string | null {
  if (!answer) return null;
  const clean = answer.trim().replace(/^[★\s"“「]+/, '').replace(/[\s"”」]+$/, '');
  if (!clean || clean.includes('\n')) return null;
  if (clean.length > sentence.length * 1.5 + 10) return null;
  if (yearConflicts(clean, persona).length) return null;
  return clean;
}

/**
 * 年限修复：只改年限打架的那几句。ask 返回模型的一行回答（失败为 null）。
 * allowRepair：真的要改之前再问一次（限流计数只在这里发生，正常稿子不占额度）。
 */
export async function repairYears(
  text: string,
  ask: (prompt: string) => Promise<string | null>,
  persona: unknown,
  context = '',
  allowRepair: () => boolean = () => true,
): Promise<RealityPolishResult> {
  const sentences = yearConflictSentences(text, persona);
  if (!sentences.length || !allowRepair()) return { text, tried: 0, accepted: 0 };
  const facts = yearsFactLines(persona);
  return replaceEachSentence(text, sentences, async (body) => acceptYearsRepair(body, await ask(yearsRepairPrompt(body, facts, context)), persona));
}
