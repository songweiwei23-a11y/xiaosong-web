import { evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { unsupportedFacts } from '@/lib/quality-checks';
import { BOARD_LABEL, type BoardKind } from '@/lib/assistant/board-dispatch';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import type { AssistantConfig } from '@/lib/assistant/config';

/**
 * 管理员的验收（板块派活、监督、返工）。
 * 两道关：先用确定性规则（长度、脚本质量、事实依据），再由管理员模型对照派活要求判断一遍。
 * 验收不过，问题写成返工意见交回板块；返工到上限，交给老板判断。
 */

/** 一次派活最多跑几次：第一次 + 返工 2 次（2026-10-23 老板定的） */
export const MAX_BOARD_RUNS = 3;

/** 每类产出的最低长度：短到不成样子的，直接算没完成 */
const MIN_LENGTH: Record<BoardKind, number> = {
  topic: 200,
  script: 300,
  review: 120,
  title: 60,
  storyboard: 200,
  direction: 150,
  'content-plan': 150,
  'deal-reason': 200,
  positioning: 400,
  brief: 300,
  advice: 300,
  growth: 300,
  opening: 120,
  remix: 300,
  breakdown: 200,
};

export interface BoardCheck {
  ok: boolean;
  problems: string[];
}

/** 规则验收：长度、脚本质量、脚本的事实依据 */
export function checkBoardOutput(kind: BoardKind, text: string, context: string): BoardCheck {
  const problems: string[] = [];
  const body = text.trim();
  if (body.length < MIN_LENGTH[kind]) problems.push(`产出太短（${body.length} 字），没有达到「${BOARD_LABEL[kind].label}」的基本要求`);
  if (kind === 'script' && body) {
    const quality = evaluateScriptQualityStrict(body);
    if (!quality.passCheck) problems.push(...quality.issues.slice(0, 3));
  }
  // 只有脚本查「有没有凭空编的事实」：其它板块本来就会引用、评论原文，拿去和需求比对会误报
  if (kind === 'script' && body && context) {
    const facts = unsupportedFacts(body, context);
    if (facts.length) problems.push(`有资料里没有依据的说法：${facts.slice(0, 2).join('；')}`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * 模型验收：管理员模型对照派活要求读一遍产出，判断有没有跑题、缺条数、空泛或明显编造。
 * 模型出错或读不懂它的回答时返回 null（这时只用规则结果，不因为验收员出错而卡住流程）。
 */
export async function judgeBoardOutput(
  cfg: AssistantConfig,
  kind: BoardKind,
  requirement: string,
  output: string,
  opts: { llm?: typeof callAssistantLlm } = {},
): Promise<BoardCheck | null> {
  const call = opts.llm ?? callAssistantLlm;
  const system = '你是开物的验收员。只判断板块的产出是否满足这次派活的要求，不改写内容。只输出一个 JSON 对象：{"pass": true 或 false, "problems": ["问题"]}，不要输出别的文字。能用就算通过，只为真正不合格的写问题。';
  const user = [
    `板块：${BOARD_LABEL[kind].label}`,
    `派活要求：${requirement}`,
    '',
    '产出：',
    output.slice(0, 6000),
    '',
    '判断：有没有回应派活要求；要求写了条数的，数量够不够；有没有空泛、重复、跑题或明显编造的内容。',
  ].join('\n');
  try {
    const res = await call(cfg, { system, messages: [{ role: 'user', content: user }], tools: [], maxTokens: 500 });
    const text = res.content
      .filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { pass?: unknown; problems?: unknown };
    if (parsed.pass === true) return { ok: true, problems: [] };
    const problems = Array.isArray(parsed.problems)
      ? parsed.problems.filter((p): p is string => typeof p === 'string' && p.trim() !== '').slice(0, 5)
      : [];
    return { ok: false, problems: problems.length ? problems : ['验收员认为产出不符合派活要求'] };
  } catch {
    return null;
  }
}

/** 交回板块的返工意见：逐条写清楚要改什么 */
export function reworkNote(problems: string[]): string {
  return `上一版存在以下问题，请逐条修正后重新生成：\n${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}

/** 交给老板的最终回答：板块的产出，加上管理员的验收结论 */
export function managerAnswer(text: string, attempts: number, problems: string[]): string {
  if (!text) return '';
  if (problems.length === 0) {
    return `${text}\n\n——管理员验收：通过${attempts > 1 ? `（返工 ${attempts - 1} 次后合格）` : ''}。`;
  }
  return `${text}\n\n——管理员验收：返工 ${attempts - 1} 次后仍有问题，请你判断是否采用：\n${problems.map((p) => `- ${p}`).join('\n')}`;
}
