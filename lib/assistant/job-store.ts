import { getServiceSupabase } from '@/lib/admin-auth';

/**
 * 助理任务、反馈的数据库读写（服务端）。任务本身仍在内存里跑，这里只记一份「存根」：
 *   - 服务重启后，界面再来取进度，能看到「服务刚重新启动，这次没有做完」，而不是一直「找不到」；
 *   - 每次的用量和改写次数，给管理员的助理概览用（升级方案 G1、J1）。
 * 表没建好（迁移没跑）或数据库出错，都只记一条日志，不影响对话本身。每个函数都带 userId 过滤。
 */

export type StoredJobStatus = 'running' | 'done' | 'error' | 'stopped' | 'interrupted';

export interface JobStats {
  /** 模型调用次数 */
  calls?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  /** 用的模型名（不含密钥） */
  model?: string;
  /** 是否走了便宜模型 */
  cheap?: boolean;
  /** 被核对改写的完成说法条数 */
  rewritten?: number;
  /** 用了知识库但没有写出资料名 */
  uncited?: boolean;
  /** 工具调用次数 */
  tools?: number;
}

export interface StoredJob {
  id: string;
  status: StoredJobStatus;
  created_at: string;
  finished_at: string | null;
}

const db = () => getServiceSupabase();
const log = (where: string, error: unknown) => console.error(`[assistant] ${where}`, error instanceof Error ? error.name : 'unknown');

/** 任务开始：记一条存根。失败只记日志 */
export async function recordJobStart(row: { id: string; userId: string; threadId: string | null; requestId: string | null }): Promise<void> {
  try {
    const { error } = await db().from('assistant_jobs').insert({
      id: row.id,
      user_id: row.userId,
      thread_id: row.threadId,
      request_id: row.requestId,
      status: 'running',
    });
    if (error) throw error;
  } catch (error) {
    log('任务存根没有写入', error);
  }
}

/** 任务结束：写入结果和统计 */
export async function recordJobFinish(id: string, userId: string, status: Exclude<StoredJobStatus, 'running' | 'interrupted'>, stats: JobStats): Promise<void> {
  try {
    const { error } = await db()
      .from('assistant_jobs')
      .update({ status, stats, finished_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    log('任务结果没有写入', error);
  }
}

/** 读一条存根（只能读自己的）。表不在或出错返回 null */
export async function readStoredJob(id: string, userId: string): Promise<StoredJob | null> {
  try {
    const { data, error } = await db()
      .from('assistant_jobs')
      .select('id, status, created_at, finished_at')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as StoredJob | null) ?? null;
  } catch (error) {
    log('任务存根读取失败', error);
    return null;
  }
}

/**
 * 进程重启后，内存里已经没有这个任务，但存根还是 running：说明它被中断了。
 * 标成 interrupted，之后再取就直接是这个状态，不再反复判断。
 */
export async function markJobInterrupted(id: string, userId: string): Promise<void> {
  try {
    await db()
      .from('assistant_jobs')
      .update({ status: 'interrupted', finished_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'running');
  } catch (error) {
    log('中断标记没有写入', error);
  }
}

/** 用户对某一条回答的反馈（有用 / 没用，可以写一句原因） */
export async function recordFeedback(userId: string, row: { jobId: string | null; helpful: boolean; reason: string }): Promise<boolean> {
  try {
    const { error } = await db().from('assistant_feedback').insert({
      user_id: userId,
      job_id: row.jobId,
      helpful: row.helpful,
      reason: row.reason.slice(0, 300),
    });
    if (error) throw error;
    return true;
  } catch (error) {
    log('反馈没有写入', error);
    return false;
  }
}

/** 管理员概览：最近一段时间的任务存根（只给统计用，不含对话内容） */
export async function jobRowsSince(sinceIso: string, limit = 5000): Promise<{ status: StoredJobStatus; stats: JobStats | null }[]> {
  const { data, error } = await db()
    .from('assistant_jobs')
    .select('status, stats')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { status: StoredJobStatus; stats: JobStats | null }[];
}

/** 管理员概览：最近一段时间的反馈（只取有用与否） */
export async function feedbackRowsSince(sinceIso: string, limit = 5000): Promise<{ helpful: boolean }[]> {
  const { data, error } = await db()
    .from('assistant_feedback')
    .select('helpful')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { helpful: boolean }[];
}
