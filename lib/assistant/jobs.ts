import { randomUUID } from 'node:crypto';
import type { AssistantEvent } from './agent';

/**
 * 助理的后台任务。助理可能要等很久（查资料、调板块），所以不让一个 HTTP 请求一直挂着：
 * 提交后立刻返回任务号，服务端在后台继续跑，界面每隔几秒取一次进度。
 * 用户关掉窗口、切换页面，任务照样跑完，回来还能看到结果。
 *
 * 任务只存在内存里：服务重启（部署）会丢失，已经占用的额度由数据库的预留过期自动释放。
 */

export type JobStatus = 'running' | 'done' | 'error' | 'stopped';

export interface AssistantJob {
  id: string;
  userId: string;
  status: JobStatus;
  events: AssistantEvent[];
  answer: string;
  stopRequested: boolean;
  createdAt: number;
  finishedAt: number | null;
  /** 界面提交时带来的请求编号：同一个编号重复提交（网络重试）时，返回已有的任务，不再跑一遍 */
  requestId: string | null;
}

const JOB_TTL_MS = 30 * 60_000;
const jobs = new Map<string, AssistantJob>();

/** 同一个用户同一时间只允许一个任务在跑，免得连续提交把额度和模型调用刷爆 */
export function hasRunningJob(userId: string): boolean {
  for (const job of jobs.values()) {
    if (job.userId === userId && job.status === 'running') return true;
  }
  return false;
}

/** 现在有多少个助理任务在跑（所有用户合计，只统计本进程内存里的） */
export function runningJobCount(): number {
  let n = 0;
  for (const job of jobs.values()) if (job.status === 'running') n++;
  return n;
}

export function createJob(userId: string, now = Date.now(), requestId: string | null = null): AssistantJob {
  sweepJobs(now);
  const job: AssistantJob = {
    id: randomUUID(),
    userId,
    status: 'running',
    events: [],
    answer: '',
    stopRequested: false,
    createdAt: now,
    finishedAt: null,
    requestId,
  };
  jobs.set(job.id, job);
  return job;
}

/** 同一个用户、同一个请求编号的任务（还在内存里的）。没有就返回 null */
export function findJobByRequest(userId: string, requestId: string): AssistantJob | null {
  for (const job of jobs.values()) {
    if (job.userId === userId && job.requestId === requestId) return job;
  }
  return null;
}

/** 只能取自己的任务；别人的或不存在的一律返回 null */
export function getJob(id: string, userId: string): AssistantJob | null {
  const job = jobs.get(id);
  return job && job.userId === userId ? job : null;
}

export function pushEvent(job: AssistantJob, event: AssistantEvent): void {
  job.events.push(event);
}

export function finishJob(job: AssistantJob, status: Exclude<JobStatus, 'running'>, answer = '', now = Date.now()): void {
  job.status = status;
  job.answer = answer;
  job.finishedAt = now;
}

/** 请求停止：正在跑的那一步结束后就停，不再调用新的工具 */
export function requestStop(id: string, userId: string): boolean {
  const job = getJob(id, userId);
  if (!job || job.status !== 'running') return false;
  job.stopRequested = true;
  return true;
}

/** 从第 since 条事件开始给出增量，界面据此只追加新的进度 */
export function eventsSince(job: AssistantJob, since: number) {
  const from = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
  return {
    status: job.status,
    events: job.events.slice(from),
    next: job.events.length,
    answer: job.status === 'running' ? '' : job.answer,
  };
}

/** 结束超过 30 分钟的任务，防止内存只增不减 */
export function sweepJobs(now = Date.now()): void {
  for (const [id, job] of jobs) {
    if (job.finishedAt !== null && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
}
