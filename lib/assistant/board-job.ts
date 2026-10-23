import { finishJob, pushEvent, type AssistantJob } from './jobs';
import { BOARD_LABEL, runBoard, type BoardContext, type BoardInput, type BoardKind } from './boards';
import { checkBoardOutput, managerAnswer, reworkNote } from './manager';

/**
 * 管理员派活的执行：用户确认后，把板块任务交给对应的板块去跑（板块用 Dify 生成），
 * 每一版都由管理员验收；不合格就把问题写成返工意见交回板块，最多返工到上限。
 * 进度和结果走助理同一套任务通道，界面按步骤显示「派给谁、验收结果、第几次返工」。
 */

/** 把返工意见塞进板块的输入（替换上一次的意见，不累加） */
function withNote(board: BoardInput, note: string): BoardInput {
  if (board.kind === 'topic') return { kind: 'topic', input: { ...board.input, extraNote: note } };
  if (board.kind === 'script') return { kind: 'script', input: { ...board.input, extraNote: note } };
  return { kind: 'review', input: { ...board.input, extraNote: note } };
}

/** 验收用的原始需求：脚本对照需求查事实，其它类不对照 */
function requirementOf(board: BoardInput): string {
  return board.kind === 'script' ? board.input.request : '';
}

function kindOf(board: BoardInput): BoardKind {
  return board.kind;
}

export interface BoardJobInput {
  ctx: BoardContext;
  board: BoardInput;
  /** 最多跑几次（第一次 + 返工次数），由用户确认时看到 */
  maxRuns: number;
}

export async function runBoardJob(job: AssistantJob, input: BoardJobInput): Promise<void> {
  const label = BOARD_LABEL[kindOf(input.board)].label;
  const context = requirementOf(input.board);
  let current = input.board;
  let best = '';
  let problems: string[] = [];
  let attempts = 0;

  for (let attempt = 1; attempt <= input.maxRuns; attempt++) {
    if (job.stopRequested) {
      finishJob(job, 'stopped', best ? managerAnswer(best, attempts, problems) : '');
      return;
    }
    attempts = attempt;
    pushEvent(job, {
      type: 'step',
      text: attempt === 1 ? `管理员：派给「${label}」板块` : `管理员：第 ${attempt} 次返工，「${label}」重新生成`,
    });
    const res = await runBoard(input.ctx, current).catch(() => ({ ok: false, text: '', error: '板块调用出错，请稍后再试' }));
    if (!res.ok) {
      pushEvent(job, { type: 'error', text: `「${label}」没有完成：${res.error ?? '请稍后再试'}` });
      finishJob(job, best ? 'done' : 'error', best ? managerAnswer(best, attempts, problems) : '');
      return;
    }
    best = res.text;
    const check = checkBoardOutput(kindOf(current), res.text, context);
    if (check.ok) {
      pushEvent(job, { type: 'step', text: `管理员：验收通过（第 ${attempt} 次）` });
      finishJob(job, 'done', managerAnswer(best, attempt, []));
      return;
    }
    problems = check.problems;
    if (attempt < input.maxRuns) {
      pushEvent(job, { type: 'step', text: `管理员：验收没通过（${check.problems.length} 处），交回「${label}」返工` });
      current = withNote(current, reworkNote(check.problems));
    } else {
      pushEvent(job, { type: 'step', text: `管理员：已到返工上限，仍有 ${check.problems.length} 处问题，交给你判断` });
    }
  }
  finishJob(job, 'done', managerAnswer(best, attempts, problems));
}
