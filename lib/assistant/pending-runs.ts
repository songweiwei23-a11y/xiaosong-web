import { randomUUID } from 'node:crypto';
import type { BoardInput, BoardKind } from './boards';

/**
 * 待确认的派活：管理员把板块任务列出来，用户点「确定开跑」才真的跑。
 * 板块每跑一次都会扣额度，所以这里一定要先让用户确认（升级方案：每次跑板块前先问用户）。
 * 只存在内存里，30 分钟不确认就作废；取走一次就删掉，防止重复开跑。
 */

const TTL_MS = 30 * 60_000;

export interface PendingRun {
  id: string;
  userId: string;
  board: BoardInput;
  kind: BoardKind;
  label: string;
  summary: string;
  maxRuns: number;
  profileId: string | null;
  memoryOn: boolean;
  createdAt: number;
}

const runs = new Map<string, PendingRun>();

function sweep(now: number): void {
  for (const [id, run] of runs) if (now - run.createdAt > TTL_MS) runs.delete(id);
}

export function createPendingRun(
  input: Omit<PendingRun, 'id' | 'createdAt'>,
  now = Date.now(),
): PendingRun {
  sweep(now);
  const run: PendingRun = { ...input, id: randomUUID(), createdAt: now };
  runs.set(run.id, run);
  return run;
}

/** 只能取自己的；取走就删，同一个编号只能开跑一次 */
export function takePendingRun(userId: string, id: string, now = Date.now()): PendingRun | null {
  sweep(now);
  const run = runs.get(id);
  if (!run || run.userId !== userId) return null;
  runs.delete(id);
  return run;
}
