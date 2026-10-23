import { finishJob, pushEvent, type AssistantJob } from './jobs';
import type { BoardContext, BoardResult } from './boards';
import { saveBoardResult, type SavedResult } from '@/lib/assistant/carry';
import { applyCarry } from '@/lib/assistant/carry-shape';
import type { HandoffPayload } from '@/lib/handoff';
import {
  BOARD_LABEL,
  factContextOf,
  requirementOf,
  revisionCapOf,
  runAnyBoard,
  withUpstream,
  type BoardAny,
  type PlanSpec,
} from '@/lib/assistant/board-dispatch';
import { checkBoardOutput, judgeBoardOutput, managerAnswer, MAX_REVISIONS, reviseBoardOutput, type BoardCheck } from '@/lib/assistant/manager';
import type { AssistantConfig } from '@/lib/assistant/config';
import type { callAssistantLlm } from '@/lib/assistant/llm';

/**
 * 管理员派活的执行（2026-10-23 老板定：不整份返工，管理员直接改）。
 * 板块只跑一次；每一版先过规则，再过管理员模型。验收不过，管理员只改有问题的地方，改完复核；
 * 最多修改 MAX_REVISIONS 次，还不合格就交给老板判断。整份重跑要再扣一次板块额度，还可能跑出新的问题，所以不用。
 * 多步计划：按顺序派给几个板块，前一步的产出交给后一步。进度和结果走助理同一套任务通道。
 */

export interface BoardRunResult {
  /** 有没有拿到产出（拿到了就交给老板，验收结论写在产出后面） */
  ok: boolean;
  text: string;
  /** 第一次交出的那版算 1 次，之后每直接修改一次加 1 */
  attempts: number;
  problems: string[];
  error?: string;
  /** 交付的那份创作（已存成创作会话）：下一步按它接续，和页面「带去下一步」一样 */
  carry?: HandoffPayload;
}

export interface BoardRunOptions {
  ctx: BoardContext;
  board: BoardAny;
  /** 最多直接修改几次（深度研究不改，见 revisionCapOf） */
  maxRuns: number;
  cfg?: AssistantConfig;
  /** 多步计划里显示在进度前面的「第几步」 */
  stepTag?: string;
  /** 管理员模型（测试时替换；默认用助理的模型） */
  llm?: typeof callAssistantLlm;
}

/** 派一个板块：只跑一次；验收不过就由管理员直接修改，改完复核，最多改 maxRuns 次 */
export async function runBoardWithReview(job: AssistantJob, opts: BoardRunOptions): Promise<BoardRunResult> {
  const label = BOARD_LABEL[opts.board.kind].label;
  const tag = opts.stepTag ?? '';
  const context = factContextOf(opts.board);
  const requirement = requirementOf(opts.board);
  const kind = opts.board.kind;
  // 板块能看到老板有没有停下（深度研究这类长任务靠它停掉后台的研究）
  const ctx: BoardContext = { ...opts.ctx, isStopped: () => job.stopRequested };
  const revisionCap = revisionCapOf(opts.board, opts.maxRuns);

  if (job.stopRequested) return { ok: false, text: '', attempts: 0, problems: [], error: '已经停下来了' };
  pushEvent(job, { type: 'step', text: `${tag}管理员：派给「${label}」板块` });
  const res: BoardResult = await runAnyBoard(ctx, opts.board).catch(() => ({ ok: false, text: '', error: '板块调用出错，请稍后再试' }));
  if (!res.ok) return { ok: false, text: '', attempts: 1, problems: [], error: res.error ?? '板块没有完成' };

  // 完整的产出（对话里的版本可能截断）：修改、存下来给下一个板块接着用的都是它
  let full = res.full ?? res.text;

  // 第一道：规则（长度、脚本质量、事实依据）；第二道：管理员模型对照派活要求（规则不过就不再花模型的钱）
  const verify = async (text: string): Promise<BoardCheck> => {
    const rules = checkBoardOutput(kind, text, context);
    if (!rules.ok || !opts.cfg) return rules;
    return (await judgeBoardOutput(opts.cfg, kind, requirement, text, { llm: opts.llm })) ?? rules;
  };

  let check = await verify(full);
  let revisions = 0;
  // 验收不过：管理员直接改有问题的地方，改完复核；改不动就停，保留原稿交给老板判断
  while (!check.ok && revisions < revisionCap && opts.cfg && !job.stopRequested) {
    revisions++;
    pushEvent(job, { type: 'step', text: `${tag}管理员：验收发现 ${check.problems.length} 处问题，我直接修改（第 ${revisions} 次）` });
    const revised = await reviseBoardOutput(opts.cfg, kind, full, check.problems, { llm: opts.llm });
    if (!revised) {
      pushEvent(job, { type: 'step', text: `${tag}管理员：这几处没能改好，保留原稿，交给你判断` });
      revisions--;
      break;
    }
    full = revised;
    check = await verify(full);
  }

  if (check.ok) {
    pushEvent(job, { type: 'step', text: `${tag}管理员：验收通过${revisions ? `（已直接修改 ${revisions} 次）` : ''}` });
  } else {
    pushEvent(job, { type: 'step', text: `${tag}管理员：仍有 ${check.problems.length} 处问题，交给你判断` });
  }

  const saved = await keepResult(opts.ctx, opts.board, full);
  return {
    ok: true,
    // 对话里显示的版本：有修改就用修改后的完整稿，没有就用板块原样的输出
    text: revisions ? full : res.text,
    attempts: revisions + 1,
    problems: check.ok ? [] : check.problems,
    carry: saved?.payload,
  };
}

/** 存成可以按编号带去下一步的创作（失败不影响交付；见 lib/assistant/carry） */
async function keepResult(ctx: BoardContext, board: BoardAny, full: string): Promise<SavedResult | null> {
  if (!full.trim()) return null;
  return saveBoardResult(ctx, board, full).catch(() => null);
}

export interface BoardJobInput {
  ctx: BoardContext;
  board: BoardAny;
  maxRuns?: number;
  cfg?: AssistantConfig;
  llm?: typeof callAssistantLlm;
}

/** 单个板块的派活 */
export async function runBoardJob(job: AssistantJob, input: BoardJobInput): Promise<void> {
  const r = await runBoardWithReview(job, { ctx: input.ctx, board: input.board, maxRuns: input.maxRuns ?? MAX_REVISIONS, cfg: input.cfg, llm: input.llm });
  if (r.error) pushEvent(job, { type: 'error', text: `「${BOARD_LABEL[input.board.kind].label}」没有完成：${r.error}` });
  finishJob(job, r.text ? 'done' : 'error', r.text ? managerAnswer(r.text, r.attempts, r.problems) : '');
}

export interface PlanJobInput {
  ctx: BoardContext;
  plan: PlanSpec;
  maxRuns?: number;
  cfg?: AssistantConfig;
  llm?: typeof callAssistantLlm;
}

/** 多步计划：按顺序派活，前一步的产出交给后一步；某一步没有完成就停下，已经做完的照常交付 */
export async function runPlanJob(job: AssistantJob, input: PlanJobInput): Promise<void> {
  const total = input.plan.steps.length;
  const sections: string[] = [];
  // 上一步交付的那份创作：优先按页面「带去下一步」的规则接续（原方向、目的、设置、当前稿子都跟着走）；
  // 没存成功的，退回用文字传（和以前一样）
  let previous: HandoffPayload | null = null;
  let previousText: string | null = null;
  for (let i = 0; i < total; i++) {
    const original = input.plan.steps[i];
    const board = previous ? applyCarry(original, previous) : previousText ? withUpstream(original, previousText) : original;
    const tag = `第 ${i + 1}/${total} 步 · `;
    const r = await runBoardWithReview(job, {
      ctx: input.ctx,
      board,
      maxRuns: input.maxRuns ?? MAX_REVISIONS,
      cfg: input.cfg,
      stepTag: tag,
      llm: input.llm,
    });
    if (!r.ok || !r.text) {
      pushEvent(job, { type: 'error', text: `${tag}「${BOARD_LABEL[original.kind].label}」没有完成：${r.error ?? '请稍后再试'}，后面的步骤先不做` });
      break;
    }
    previous = r.carry ?? null;
    previousText = r.carry ? null : r.text;
    sections.push(`## ${i + 1}. ${BOARD_LABEL[original.kind].label}\n\n${managerAnswer(r.text, r.attempts, r.problems)}`);
  }
  finishJob(job, sections.length ? 'done' : 'error', sections.join('\n\n'));
}
