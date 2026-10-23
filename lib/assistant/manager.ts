import { evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { unsupportedFacts } from '@/lib/quality-checks';
import { BOARD_LABEL, type BoardKind } from '@/lib/assistant/board-dispatch';
import { callAssistantLlm, type LlmBlock } from '@/lib/assistant/llm';
import type { AssistantConfig } from '@/lib/assistant/config';

/**
 * 管理员的验收与修改（板块派活、监督）。
 * 两道关：先用确定性规则（长度、脚本质量、事实依据），再由管理员模型对照派活要求判断一遍。
 * 验收不过，管理员做小改：只给出「原文一句 → 改后一句」的编辑，由系统精确替换；
 * 目的、方向、方法建议这些原来的东西一律保留，改动总量有上限；改不了的交给老板判断。
 * 修改参考知识库里的方法论（《资料名》），不凭空发明做法。不再整份重跑板块（重跑要再扣额度，还可能跑出新问题）。
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

/** 一处小改：原文里的一句（或一小段）→ 改后的文字 */
export interface RevisionEdit {
  old: string;
  new: string;
}

/** 修改的结果：改好的全文、实际改了几处、跳过了几处（原文找不到或不止一处） */
export interface RevisionResult {
  text: string;
  applied: number;
  skipped: number;
}

/** 一次最多几处小改；超出的不要（大改交给老板判断） */
const MAX_EDITS = 8;
/** 修改的字数不能超过全文的这个比例：超过就是大改，整体不采用 */
const MAX_CHANGE_RATIO = 0.3;
/** 超过这个长度的产出不交给修改（修改成本高，直接交给老板判断） */
const MAX_REVISE_CHARS = 8000;

/** 从模型的回答里取出编辑列表（只认 {"edits": [{"old", "new"}]}） */
export function parseRevisionEdits(raw: string): RevisionEdit[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    // 模型常把跨行的一句原样换行写进 JSON 字符串里，这在 JSON 里不合法：只修字符串内部的换行，结构不动
    const repaired = match[0].replace(/"(?:[^"\\]|\\.)*"/g, (s) => s.replace(/\r?\n/g, '\\n'));
    const parsed = JSON.parse(repaired) as { edits?: unknown };
    if (!Array.isArray(parsed.edits)) return null;
    const edits: RevisionEdit[] = [];
    for (const e of parsed.edits.slice(0, MAX_EDITS)) {
      if (!e || typeof e !== 'object') continue;
      const item = e as { old?: unknown; new?: unknown };
      if (typeof item.old === 'string' && typeof item.new === 'string') edits.push({ old: item.old, new: item.new });
    }
    return edits.length ? edits : null;
  } catch {
    return null;
  }
}

/**
 * 按编辑精确替换：每一处的原文必须在当前稿子里只出现一次，才替换；找不到或不止一处的跳过（不猜位置）。
 * 被替换掉的原文超过全文的 MAX_CHANGE_RATIO，或者一处都没改成，返回 null（整体不采用）。
 * 新句子比原句长出一倍多，也跳过（小改不该变成大段添写）。
 */
export function applyRevisionEdits(output: string, edits: RevisionEdit[]): RevisionResult | null {
  let text = output;
  let applied = 0;
  let skipped = 0;
  // 「改动量」按被替换掉的原文算：一句话的小改不应因为新句子也算进去就超过三成
  let removed = 0;
  for (const edit of edits) {
    if (!edit.old.trim() || edit.old === edit.new) {
      skipped++;
      continue;
    }
    // 新句子不能比原句长太多，否则就是借小改塞进大段内容
    if (edit.new.length > edit.old.length * 2 + 30) {
      skipped++;
      continue;
    }
    const occurrences = text.split(edit.old).length - 1;
    if (occurrences !== 1) {
      skipped++;
      continue;
    }
    text = text.replace(edit.old, () => edit.new);
    applied++;
    removed += edit.old.length;
  }
  if (applied === 0 || removed > output.length * MAX_CHANGE_RATIO) return null;
  return { text, applied, skipped };
}

/**
 * 管理员做小改：只针对验收指出的问题，给出「原文一句 → 改后一句」的编辑。
 * 目的、方向、方法建议保留；参考知识库里的方法论来改。返回改好的稿子和修改情况；改不了返回 null（保留原稿，交给老板）。
 */
export async function reviseBoardOutput(
  cfg: AssistantConfig,
  kind: BoardKind,
  output: string,
  problems: string[],
  opts: { llm?: typeof callAssistantLlm; requirement?: string; knowledge?: string } = {},
): Promise<RevisionResult | null> {
  if (!problems.length || output.length > MAX_REVISE_CHARS) return null;
  const call = opts.llm ?? callAssistantLlm;
  const system = [
    '你是开物的管理员，负责把板块产出里验收发现的小问题改好。',
    '只做小改：只输出 JSON，格式是 {"edits": [{"old": "原文里一句原样的话", "new": "改后的话"}]}。',
    'old 必须是产出里原样存在、且全文只出现一次的一句话或一小段（不超过 200 字）；new 是替换后的文字。',
    '原来的目的、方向、核心思路、方法建议一律保留，不改变稿子的主张；只改问题所在的那几句。',
    '参考资料里的方法论可以用来改写，但要改得贴合原文，不能凭空发明做法。',
    '不许新增原文没有依据的数字、经历、客户对话、价格或效果承诺；改不了的不要硬改，直接省略。',
    `最多 ${MAX_EDITS} 处。只输出 JSON，不要任何别的文字。`,
  ].join('');
  const user = [
    `板块：${BOARD_LABEL[kind].label}`,
    opts.requirement ? `派活要求（要保留的原意）：${opts.requirement}` : '',
    '需要修改的问题：',
    ...problems.map((p, i) => `${i + 1}. ${p}`),
    opts.knowledge ? `\n参考资料（知识库）：\n${opts.knowledge}` : '',
    '\n原产出：',
    output,
  ].filter(Boolean).join('\n');
  // 第一次的回答要是引用了整段原文（超出改动上限），或者格式不对，就再要一次，并明确要求每处只写一句
  const retryNote = '上一版的修改里有几处原文引用得太长或格式不对。这次每处 old 只写一句话（不超过 80 个字），只输出 JSON。';
  try {
    for (const note of ['', retryNote]) {
      const res = await call(cfg, {
        system,
        messages: [{ role: 'user', content: note ? `${user}\n\n${note}` : user }],
        tools: [],
        maxTokens: 2000,
      });
      const raw = res.content
        .filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const edits = parseRevisionEdits(raw);
      if (!edits) continue;
      const applied = applyRevisionEdits(output, edits);
      if (applied) return applied;
    }
    return null;
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
