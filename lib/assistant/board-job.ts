import { finishJob, pushEvent, type AssistantJob } from './jobs';
import type { BoardContext } from './boards';
import {
  BOARD_LABEL,
  factContextOf,
  maxRunsOf,
  requirementOf,
  runAnyBoard,
  withNote,
  withUpstream,
  type BoardAny,
  type PlanSpec,
} from '@/lib/assistant/board-dispatch';
import { checkBoardOutput, judgeBoardOutput, managerAnswer, MAX_BOARD_RUNS, reworkNote } from '@/lib/assistant/manager';
import type { AssistantConfig } from '@/lib/assistant/config';

/**
 * 管理员派活的执行：用户确认后，把板块任务交给对应的板块去跑（板块用 Dify 生成），
 * 每一版都由管理员验收（规则 + 管理员模型）；不合格就把问题写成返工意见交回板块，最多返工到上限。
 * 多步计划：按顺序派给几个板块，前一步的产出交给后一步。进度和结果走助理同一套任务通道。
 */

export interface BoardRunResult {
  /** 有没有拿到产出（拿到了就交给老板，验收结论写在产出后面） */
  ok: boolean;
  text: string;
  attempts: number;
  problems: string[];
  error?: string;
}

export interface BoardRunOptions {
  ctx: BoardContext;
  board: BoardAny;
  maxRuns: number;
  cfg?: AssistantConfig;
  /** 多步计划里显示在进度前面的「第几步」 */
  stepTag?: string;
}

/** 派一个板块，最多返工 maxRuns 次。每次产出先过规则，再过管理员模型 */
export async function runBoardWithReview(job: AssistantJob, opts: BoardRunOptions): Promise<BoardRunResult> {
  const label = BOARD_LABEL[opts.board.kind].label;
  const tag = opts.stepTag ?? '';
  const context = factContextOf(opts.board);
  const requirement = requirementOf(opts.board);
  // 板块能看到老板有没有停下（深度研究这类长任务靠它停掉后台的研究）
  const ctx: BoardContext = { ...opts.ctx, isStopped: () => job.stopRequested };
  let current = opts.board;
  let best = '';
  let problems: string[] = [];
  let attempts = 0;
  const maxRuns = maxRunsOf(opts.board, opts.maxRuns);

  for (let attempt = 1; attempt <= maxRuns; attempt++) {
    if (job.stopRequested) return { ok: false, text: best, attempts, problems, error: '已经停下来了' };
    attempts = attempt;
    pushEvent(job, {
      type: 'step',
      text: `${tag}管理员：${attempt === 1 ? `派给「${label}」板块` : `第 ${attempt} 次返工，「${label}」重新生成`}`,
    });
    const res = await runAnyBoard(ctx, current).catch(() => ({ ok: false, text: '', error: '板块调用出错，请稍后再试' }));
    if (!res.ok) return { ok: false, text: best, attempts, problems, error: res.error ?? '板块没有完成' };
    best = res.text;

    // 第一道：规则（长度、脚本质量、事实依据）；第二道：管理员模型对照派活要求
    let check = checkBoardOutput(current.kind, res.text, context);
    if (check.ok && opts.cfg) {
      const judged = await judgeBoardOutput(opts.cfg, current.kind, requirement, res.text);
      if (judged) check = judged;
    }
    if (check.ok) {
      pushEvent(job, { type: 'step', text: `${tag}管理员：验收通过（第 ${attempt} 次）` });
      return { ok: true, text: best, attempts, problems: [] };
    }
    problems = check.problems;
    if (attempt < maxRuns) {
      pushEvent(job, { type: 'step', text: `${tag}管理员：验收没通过（${problems.length} 处），交回「${label}」返工` });
      current = withNote(current, reworkNote(problems));
    } else {
      const cap = opts.board.kind === 'research' ? '深度研究不返工' : '已到返工上限';
      pushEvent(job, { type: 'step', text: `${tag}管理员：${cap}，仍有 ${problems.length} 处问题，交给你判断` });
    }
  }
  return { ok: true, text: best, attempts, problems };
}

export interface BoardJobInput {
  ctx: BoardContext;
  board: BoardAny;
  maxRuns?: number;
  cfg?: AssistantConfig;
}

/** 单个板块的派活 */
export async function runBoardJob(job: AssistantJob, input: BoardJobInput): Promise<void> {
  const r = await runBoardWithReview(job, { ctx: input.ctx, board: input.board, maxRuns: input.maxRuns ?? MAX_BOARD_RUNS, cfg: input.cfg });
  if (r.error) pushEvent(job, { type: 'error', text: `「${BOARD_LABEL[input.board.kind].label}」没有完成：${r.error}` });
  finishJob(job, r.text ? 'done' : 'error', r.text ? managerAnswer(r.text, r.attempts, r.problems) : '');
}

export interface PlanJobInput {
  ctx: BoardContext;
  plan: PlanSpec;
  maxRuns?: number;
  cfg?: AssistantConfig;
}

/** 多步计划：按顺序派活，前一步的产出交给后一步；某一步没有完成就停下，已经做完的照常交付 */
export async function runPlanJob(job: AssistantJob, input: PlanJobInput): Promise<void> {
  const total = input.plan.steps.length;
  const sections: string[] = [];
  let carry: string | null = null;
  for (let i = 0; i < total; i++) {
    const original = input.plan.steps[i];
    const board = carry ? withUpstream(original, carry) : original;
    const tag = `第 ${i + 1}/${total} 步 · `;
    const r = await runBoardWithReview(job, {
      ctx: input.ctx,
      board,
      maxRuns: input.maxRuns ?? MAX_BOARD_RUNS,
      cfg: input.cfg,
      stepTag: tag,
    });
    if (!r.ok || !r.text) {
      pushEvent(job, { type: 'error', text: `${tag}「${BOARD_LABEL[original.kind].label}」没有完成：${r.error ?? '请稍后再试'}，后面的步骤先不做` });
      break;
    }
    carry = r.text;
    sections.push(`## ${i + 1}. ${BOARD_LABEL[original.kind].label}\n\n${managerAnswer(r.text, r.attempts, r.problems)}`);
  }
  finishJob(job, sections.length ? 'done' : 'error', sections.join('\n\n'));
}
