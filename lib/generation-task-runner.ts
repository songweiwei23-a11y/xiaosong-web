import { scanGenerationWork } from '@/lib/generation-worker';
import { getServiceSupabase } from '@/lib/admin-auth';
import { taskIsRecoverable, updateGenerationTask, type GenerationTask, type GenerationTaskStatus } from '@/lib/generation-task';

/**
 * 后台工作从已保存的阶段继续。普通流式任务没有可续跑的阶段，
 * 过期后标记为可查看草稿，避免重放上游请求。
 */
export const GENERATION_STALE_MS = 3 * 60_000;
let recoveryTimer: ReturnType<typeof setInterval> | undefined;

export async function recoverGenerationTasks() {
  await scanGenerationWork();
  const db = getServiceSupabase();
  const stale = new Date(Date.now() - GENERATION_STALE_MS).toISOString();
  const { data, error } = await db.from('generation_tasks')
    .select('id,status,stage,heartbeat_at,updated_at')
    .in('status', ['accepted', 'queued', 'generating', 'draft_saved', 'post_processing'])
    .is('run_token', null).neq('stage', 'worker_ready')
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${stale}`)
    .order('updated_at')
    .limit(50);
  if (error) return; // 迁移未执行时不影响现有生产链路
  for (const row of (data ?? []) as Pick<GenerationTask, 'id' | 'status' | 'stage' | 'heartbeat_at' | 'updated_at'>[]) {
    const status = row.status as GenerationTaskStatus;
    if (!taskIsRecoverable(status) && status !== 'draft_saved' && status !== 'accepted') continue;
    await updateGenerationTask({
      taskId: row.id, expectedStatus: status, staleBefore: stale,
      status: 'recoverable_failed',
      stage: row.stage || 'recovery',
      errorCode: 'SERVER_RECOVERY_REQUIRED',
      errorMessage: '任务中断，尚未完成。若已有保存版本，可在本页重新查看。',
    });
  }
}

export function startGenerationTaskRecovery() {
  if (recoveryTimer) return;
  const tick = () => { void recoverGenerationTasks().catch(() => console.warn('[generation-task] 恢复扫描暂时不可用')); };
  recoveryTimer = setInterval(tick, 60_000);
  recoveryTimer.unref();
  tick();
}
