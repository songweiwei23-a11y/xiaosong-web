/**
 * 生成任务的并发控制（2026-10-22，后台扩展方案 P1-2 的第一步）。
 *
 * 目的：同一时间真正去调上游（Dify、中转模型）的生成任务不超过 N 个，超过的排队等。
 * 上游一限流或变慢，所有用户一起变慢；有了这层，排队长度可见，等太久的会明确失败，而不是无限挂着。
 *
 * 默认关闭：GENERATION_CONCURRENCY 没设（或为 0）时不做任何限制，行为和之前一样。
 * N 应当按上游的真实限额来设（方案第 10 节第 6 个问题，待供应商确认），不要凭感觉。
 *
 * 只在本进程内存里统计。现在是单进程部署，够用；多进程要换成数据库队列（方案 P1-2 完整版）。
 */

export class SlotTimeoutError extends Error {
  readonly code = 'queue_timeout';
  constructor() {
    super('生成任务排队太久，请稍后再试');
  }
}

export class SlotFullError extends Error {
  readonly code = 'queue_full';
  constructor() {
    super('现在生成的人太多，请稍后再试');
  }
}

export interface SlotOptions {
  /** 全局同时执行的上限；0 表示不限制（关闭） */
  global: number;
  /** 单个用户同时执行的上限 */
  perUser: number;
  /** 排队最多等多久，超过就失败 */
  maxWaitMs: number;
  /** 队列最长多少，超过直接拒绝 */
  maxQueue: number;
}

export function slotOptionsFromEnv(env: Record<string, string | undefined> = process.env): SlotOptions {
  const int = (v: string | undefined, d: number) => {
    const n = Number.parseInt(v ?? '', 10);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    global: int(env.GENERATION_CONCURRENCY, 0),
    perUser: Math.max(1, int(env.GENERATION_PER_USER, 1)),
    maxWaitMs: int(env.GENERATION_MAX_WAIT_MS, 120_000),
    maxQueue: int(env.GENERATION_MAX_QUEUE, 500),
  };
}

interface Waiter {
  userId: string;
  priority: number;
  enqueuedAt: number;
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let running = 0;
const perUserRunning = new Map<string, number>();
const queue: Waiter[] = [];

function canStart(userId: string, opts: SlotOptions): boolean {
  return running < opts.global && (perUserRunning.get(userId) ?? 0) < opts.perUser;
}

/**
 * 名额最长能占多久。超过就视为某条路径忘了归还（泄漏），强制收回，免得整个队列卡死。
 * 正常的生成（包括长对话）远远到不了这个时间。
 */
export const MAX_HOLD_MS = 15 * 60_000;

interface Holder {
  userId: string;
  since: number;
  free: () => void;
}
const holders = new Set<Holder>();

function start(userId: string, opts: SlotOptions): () => void {
  running++;
  perUserRunning.set(userId, (perUserRunning.get(userId) ?? 0) + 1);
  const holder: Holder = { userId, since: Date.now(), free: () => {} };
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    holders.delete(holder);
    running--;
    const left = (perUserRunning.get(userId) ?? 1) - 1;
    if (left <= 0) perUserRunning.delete(userId);
    else perUserRunning.set(userId, left);
    dispatch(opts);
  };
  holder.free = release;
  holders.add(holder);
  return release;
}

/** 收回占用过久的名额（见 MAX_HOLD_MS） */
function reapStale(now: number) {
  for (const h of [...holders]) if (now - h.since > MAX_HOLD_MS) h.free();
}

/** 从队列里挑下一个能开跑的：优先级高的先；等得久的也会慢慢升上来（每等 1 分钟加 1 分），不会饿死 */
function dispatch(opts: SlotOptions, now = Date.now()) {
  reapStale(now);
  for (;;) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      const w = queue[i];
      if (!canStart(w.userId, opts)) continue;
      const score = w.priority + (now - w.enqueuedAt) / 60_000;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best < 0) return;
    const [w] = queue.splice(best, 1);
    clearTimeout(w.timer);
    w.resolve(start(w.userId, opts));
  }
}

/**
 * 申请一个执行名额。拿到后调用返回的 release 归还（执行结束、出错、停止都要归还）。
 * 没开启（global 为 0）时立即返回一个空的 release。
 */
export function acquireSlot(userId: string, opts: SlotOptions, priority = 0): Promise<() => void> {
  if (opts.global <= 0) return Promise.resolve(() => {});
  reapStale(Date.now());
  if (canStart(userId, opts)) return Promise.resolve(start(userId, opts));
  if (queue.length >= opts.maxQueue) return Promise.reject(new SlotFullError());
  return new Promise<() => void>((resolve, reject) => {
    const w: Waiter = {
      userId,
      priority,
      enqueuedAt: Date.now(),
      resolve,
      reject,
      timer: setTimeout(() => {
        const i = queue.indexOf(w);
        if (i >= 0) queue.splice(i, 1);
        reject(new SlotTimeoutError());
      }, opts.maxWaitMs),
    };
    queue.push(w);
  });
}

/** 现在的情况，给监控大屏和告警用 */
export function slotStats(now = Date.now()): { running: number; queued: number; oldestWaitMs: number } {
  const oldest = queue.reduce((m, w) => Math.max(m, now - w.enqueuedAt), 0);
  return { running, queued: queue.length, oldestWaitMs: oldest };
}

/** 测试用：清空全部状态 */
export function resetSlots() {
  running = 0;
  perUserRunning.clear();
  holders.clear();
  for (const w of queue.splice(0)) clearTimeout(w.timer);
}
