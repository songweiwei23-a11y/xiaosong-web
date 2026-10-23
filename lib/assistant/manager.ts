import { evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { unsupportedFacts } from '@/lib/quality-checks';
import { BOARD_LABEL, type BoardKind } from '@/lib/assistant/board-dispatch';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import type { AssistantConfig } from '@/lib/assistant/config';

/**
 * 管理员的验收与修改（板块派活、监督）。
 * 两道关：先用确定性规则（长度、脚本质量、事实依据），再由管理员模型对照派活要求判断一遍。
 * 验收不过，管理员直接把问题改好（只改有问题的地方），改完复核再交给老板。
 * 不再整份重跑板块：重跑要再扣一次板块额度，还可能跑出新的问题，修改几处成本低得多。
 */

/** 验收不过时，管理员最多直接修改几次（2026-10-23 老板定：不整份重跑，直接改） */
export const MAX_REVISIONS = 2;

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
  research: 600,
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

/** 修改后的产出不能比原稿短太多（短了多半是模型删掉了内容而不是改了问题） */
const MIN_KEEP_RATIO = 0.7;
/** 超过这个长度的产出不交给修改（修改会截断，且成本高），直接交给老板判断 */
const MAX_REVISE_CHARS = 8000;

/**
 * 管理员直接修改：只改验收指出的问题，其余原样保留。
 * 返回修改后的完整产出；模型出错、长度不对、或者超出能修改的范围时返回 null（这时保留原稿，交给老板判断）。
 */
export async function reviseBoardOutput(
  cfg: AssistantConfig,
  kind: BoardKind,
  output: string,
  problems: string[],
  opts: { llm?: typeof callAssistantLlm } = {},
): Promise<string | null> {
  if (!problems.length || output.length > MAX_REVISE_CHARS) return null;
  const call = opts.llm ?? callAssistantLlm;
  const system = [
    '你是开物的管理员。板块刚交出的产出，验收发现了下面这些问题。',
    '你只修改这些问题所在的句子或段落，其余的字一个不动，结构和顺序保持原样。',
    '不许新增原文里没有依据的数字、经历、客户对话、价格或效果承诺；改不了的地方保留原句，并标上「待核实」。',
    '只输出修改后的完整产出，不要解释，不要加前言。',
  ].join('');
  const user = [
    `板块：${BOARD_LABEL[kind].label}`,
    '需要修改的问题：',
    ...problems.map((p, i) => `${i + 1}. ${p}`),
    '',
    '原产出：',
    output,
  ].join('\n');
  try {
    const res = await call(cfg, { system, messages: [{ role: 'user', content: user }], tools: [], maxTokens: 6000 });
    const revised = res.content
      .filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!revised || revised.length < output.length * MIN_KEEP_RATIO) return null;
    return revised;
  } catch {
    return null;
  }
}

/**
 * 交给老板的最终回答：板块的产出，加上管理员的验收结论。
 * attempts 是「管理员直接修改」的次数加 1（第一次交出的那版算一次）。
 */
export function managerAnswer(text: string, attempts: number, problems: string[]): string {
  if (!text) return '';
  const revisions = Math.max(0, attempts - 1);
  if (problems.length === 0) {
    return `${text}\n\n——管理员验收：通过${revisions ? `（已直接修改 ${revisions} 次）` : ''}。`;
  }
  return `${text}\n\n——管理员验收：直接修改 ${revisions} 次后仍有问题，请你判断是否采用：\n${problems.map((p) => `- ${p}`).join('\n')}`;
}
