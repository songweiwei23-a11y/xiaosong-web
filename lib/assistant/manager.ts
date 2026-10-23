import { evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { unsupportedFacts } from '@/lib/quality-checks';
import type { BoardKind } from './boards';

/**
 * 管理员的验收（升级方案：管理员派活、监督、返工）。
 * 只看板块的产出是不是合格，不替板块写内容。验收不过，就把问题写成返工意见交回板块。
 * 规则都是确定性的（不再调用模型），所以结果稳定，也不额外花钱。
 */

/** 一次派活最多跑几次：第一次 + 返工 2 次（2026-10-23 用户定的） */
export const MAX_BOARD_RUNS = 3;

/** 每类产出的最低长度：短到不成样子的，直接算没完成 */
const MIN_LENGTH: Record<BoardKind, number> = { topic: 200, script: 300, review: 120 };

export interface BoardCheck {
  ok: boolean;
  problems: string[];
}

export function checkBoardOutput(kind: BoardKind, text: string, context: string): BoardCheck {
  const problems: string[] = [];
  const body = text.trim();
  if (body.length < MIN_LENGTH[kind]) problems.push(`产出太短（${body.length} 字），没有达到这一类的基本要求`);
  if (kind === 'script' && body) {
    const quality = evaluateScriptQualityStrict(body);
    if (!quality.passCheck) problems.push(...quality.issues.slice(0, 3));
  }
  // 只有脚本查「有没有凭空编的事实」：选题和审稿本来就会引用、评论原文，拿去和需求比对会误报
  if (kind === 'script' && body && context) {
    const facts = unsupportedFacts(body, context);
    if (facts.length) problems.push(`有资料里没有依据的说法：${facts.slice(0, 2).join('；')}`);
  }
  return { ok: problems.length === 0, problems };
}

/** 交回板块的返工意见：逐条写清楚要改什么 */
export function reworkNote(problems: string[]): string {
  return `上一版存在以下问题，请逐条修正后重新生成：\n${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}

/** 交给用户的最终回答：板块的产出，加上管理员的验收结论 */
export function managerAnswer(text: string, attempts: number, problems: string[]): string {
  if (!text) return '';
  if (problems.length === 0) {
    return `${text}\n\n——管理员验收：通过${attempts > 1 ? `（返工 ${attempts - 1} 次后合格）` : ''}。`;
  }
  return `${text}\n\n——管理员验收：返工 ${attempts - 1} 次后仍有问题，请你判断是否采用：\n${problems.map((p) => `- ${p}`).join('\n')}`;
}
