/**
 * 地基一键生成（2026-10-24，方案 B）。
 *
 * 一次把账号定位、创作简报、行业建议生成好。服务端在后台跑，结果直接写进账号定位表，所以关掉页面也照常保存。
 * 两条线并行：「定位 → 简报」一条（简报必须等定位写进去），「行业建议」一条（不依赖定位）。
 * 已经有的不重复生成，额度只花在缺的那几项上。
 *
 * 这里只放纯逻辑（运行顺序、状态、额度判断、任务存储）。板块怎么跑、结果怎么写库，由调用方注入（见 app/api/foundation）。
 */
import { randomUUID } from 'node:crypto';
import type { BoardAny } from './assistant/board-dispatch';
import type { BoardResult } from './assistant/boards';

export const FOUNDATION_TYPES = {
  positioning: '账号定位',
  brief: '创作简报',
  advice: '行业建议',
} as const;

export type FoundationKey = keyof typeof FOUNDATION_TYPES;
export type StepStatus = 'waiting' | 'running' | 'done' | 'skipped' | 'error';

export interface FoundationStep {
  key: FoundationKey;
  label: string;
  status: StepStatus;
  error: string | null;
}

export interface FoundationJob {
  id: string;
  userId: string;
  profileId: string;
  steps: FoundationStep[];
  status: 'running' | 'done' | 'partial' | 'error';
  createdAt: number;
  finishedAt: number | null;
}

export interface FoundationAdvice {
  purpose: string;
  stage: string;
}

export interface FoundationDeps {
  /** 这个档案下已经有的类型（例如 ['账号定位']），有的就不再生成 */
  existingTypes: string[];
  runBoard: (board: BoardAny) => Promise<BoardResult>;
  /** 把生成的内容写进账号定位表（按板块类型）。失败时抛错 */
  save: (key: FoundationKey, text: string) => Promise<void>;
}

/** 生成哪个板块：只决定板块的输入，运行顺序在 runFoundation 里 */
export function boardFor(key: FoundationKey, advice: FoundationAdvice): BoardAny {
  if (key === 'positioning') return { kind: 'positioning', input: { platform: '', notes: '' } };
  if (key === 'brief') return { kind: 'brief', input: { notes: '' } };
  return { kind: 'advice', input: { purpose: advice.purpose, stage: advice.stage, situation: '', goal: '' } };
}

/** 需要生成的板块（已有的不算） */
export function missingKeys(existingTypes: string[]): FoundationKey[] {
  return (Object.keys(FOUNDATION_TYPES) as FoundationKey[]).filter((k) => !existingTypes.includes(FOUNDATION_TYPES[k]));
}

/** 额度够不够：remaining 为 -1 表示不限量；读不到额度时不放行 */
export function quotaVerdict(needed: number, remaining: number | null): { ok: true } | { ok: false; message: string } {
  if (needed === 0) return { ok: true };
  if (remaining === null) return { ok: false, message: '额度暂时读不到，请稍后再试' };
  if (remaining === -1 || remaining >= needed) return { ok: true };
  return { ok: false, message: `定位额度不够：这次要用 ${needed} 次，只剩 ${remaining} 次。可以先只生成缺的那一项，或去开通会员` };
}

/**
 * 运行一次地基生成。两条线并行；任一步失败只影响它自己和依赖它的步骤（简报依赖定位）。
 * 结束后把任务状态定成 done / partial / error。
 */
export async function runFoundation(job: FoundationJob, deps: FoundationDeps, advice: FoundationAdvice): Promise<void> {
  const have = new Set(deps.existingTypes);
  const step = (key: FoundationKey) => job.steps.find((s) => s.key === key)!;
  for (const s of job.steps) if (have.has(FOUNDATION_TYPES[s.key])) s.status = 'skipped';

  const runOne = async (key: FoundationKey): Promise<void> => {
    const s = step(key);
    s.status = 'running';
    s.error = null;
    try {
      const res = await deps.runBoard(boardFor(key, advice));
      const text = (res.full ?? res.text ?? '').trim();
      if (!res.ok || !text) throw new Error(res.error || '没有生成出来');
      await deps.save(key, text);
      s.status = 'done';
    } catch (e) {
      s.status = 'error';
      s.error = ((e as Error).message || '生成失败').slice(0, 200);
    }
  };

  // 线一：定位 → 简报。简报要读得到定位，定位没成就不硬跑
  const lineOne = async () => {
    if (step('positioning').status !== 'skipped') await runOne('positioning');
    const positioningReady = ['done', 'skipped'].includes(step('positioning').status);
    if (step('brief').status === 'skipped') return;
    if (!positioningReady) {
      step('brief').status = 'error';
      step('brief').error = '需要先有账号定位，定位没完成';
      return;
    }
    await runOne('brief');
  };

  // 线二：行业建议（不依赖定位）
  const lineTwo = async () => {
    if (step('advice').status !== 'skipped') await runOne('advice');
  };

  await Promise.all([lineOne(), lineTwo()]);

  // 只看这次真正要生成的那些（已有的跳过，不算进成败）
  const attempted = job.steps.filter((s) => s.status !== 'skipped').map((s) => s.status);
  const failed = attempted.filter((x) => x === 'error').length;
  const succeeded = attempted.filter((x) => x === 'done').length;
  job.status = failed === 0 ? 'done' : succeeded === 0 ? 'error' : 'partial';
  job.finishedAt = Date.now();
}

/* ───────── 任务存储（内存里，服务重启会丢；结果已经写进库的不受影响） ───────── */

const JOB_TTL_MS = 60 * 60_000;
const jobs = new Map<string, FoundationJob>();

function sweep(now: number) {
  for (const [id, job] of jobs) {
    if (job.finishedAt !== null && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

/** 同一个用户、同一个档案，同一时间只允许一次地基生成在跑 */
export function runningFoundation(userId: string, profileId: string): FoundationJob | null {
  for (const job of jobs.values()) {
    if (job.userId === userId && job.profileId === profileId && job.status === 'running') return job;
  }
  return null;
}

export function createFoundation(userId: string, profileId: string, keys: FoundationKey[], now = Date.now()): FoundationJob {
  sweep(now);
  const job: FoundationJob = {
    id: randomUUID(),
    userId,
    profileId,
    steps: (Object.keys(FOUNDATION_TYPES) as FoundationKey[]).map((key) => ({
      key,
      label: FOUNDATION_TYPES[key],
      // 不在本次要生成的列表里的，一开始就标成跳过（已经有了）
      status: keys.includes(key) ? 'waiting' : 'skipped',
      error: null,
    })),
    status: 'running',
    createdAt: now,
    finishedAt: null,
  };
  jobs.set(job.id, job);
  return job;
}

/** 只能取自己的任务 */
export function getFoundation(id: string, userId: string): FoundationJob | null {
  const job = jobs.get(id);
  return job && job.userId === userId ? job : null;
}
