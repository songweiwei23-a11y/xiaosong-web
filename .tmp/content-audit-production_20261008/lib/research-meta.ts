/**
 * 深度研究在对话里的那条消息记什么（2026-10-04 产品方：别弹全屏，和「出方案」一样留在对话里）。
 * 研究本身在服务端跑（lib/research-runner），对话里只记研究编号和状态；报告写完后放进这条回答的正文，
 * 复制、画布、Word / PDF、继续创作都和普通回答一样用。
 */
export interface ResearchMeta {
  jobId: string;
  topic: string;
  depth: 'quick' | 'standard' | 'deep';
  /** 最后一次看到的状态：done 且没有没做完的部分时，刷新后不用再去问服务端 */
  status?: 'planning' | 'plan_ready' | 'running' | 'writing' | 'done' | 'failed' | 'canceled';
  /** 报告出来了，但有子问题没做完 / 结论没写成，可以补跑 */
  partial?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['planning', 'plan_ready', 'running', 'writing', 'done', 'failed', 'canceled'];

export function readResearchMeta(input: unknown): ResearchMeta | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.jobId !== 'string' || !UUID.test(o.jobId)) return null;
  const depth = o.depth === 'quick' || o.depth === 'deep' ? o.depth : 'standard';
  return {
    jobId: o.jobId,
    topic: typeof o.topic === 'string' ? o.topic.slice(0, 500) : '',
    depth,
    ...(typeof o.status === 'string' && STATUSES.includes(o.status) ? { status: o.status as ResearchMeta['status'] } : {}),
    ...(o.partial === true ? { partial: true } : {}),
  };
}

/** 对话里提问那一条显示的字 */
export const researchAsk = (topic: string, depthLabel: string) => `🔎 深度研究（${depthLabel}）：${topic}`;
