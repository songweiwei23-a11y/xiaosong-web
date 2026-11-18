import { getServiceSupabase } from '@/lib/admin-auth';
import { taskIsRecoverable, updateGenerationTask, type GenerationTask, type GenerationTaskStatus } from '@/lib/generation-task';

/**
 * 不重跑上游模型：服务器重启后先把没有租约的旧任务显式标为可恢复，
 * 让页面取回已保存版本并由用户决定重试。这样不会重复扣费或重放旧提示词。
 * 后续真正的阶段执行器在每个可幂等后处理已迁出主流后接管这些任务。
 */
export const GENERATION_STALE_MS = 3 * 60_000;
let recoveryTimer: ReturnType<typeof setInterval> | undefined;

export async function recoverGenerationTasks() {
  const db = getServiceSupabase();
  const stale = new Date(Date.now() - GENERATION_STALE_MS).toISOString();
  const { data, error } = await db.from('generation_tasks')
    .select('id,status,stage,heartbeat_at,updated_at')
    .in('status', ['queued', 'generating', 'post_processing', 'partial_saved', 'recoverable_failed'])
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${stale}`)
    .order('updated_at')
    .limit(50);
  if (error) return; // 迁移未执行时不影响现有生产链路
  for (const row of (data ?? []) as Pick<GenerationTask, 'id' | 'status' | 'stage' | 'heartbeat_at' | 'updated_at'>[]) {
    const status = row.status as GenerationTaskStatus;
    if (!taskIsRecoverable(status)) continue;
    await updateGenerationTask({
      taskId: row.id,
      status: 'recoverable_failed',
      stage: row.stage || 'recovery',
      errorCode: 'SERVER_RECOVERY_REQUIRED',
      errorMessage: '服务重启或连接中断后未完成；已保留最近版本，可恢复查看或重新执行后续处理。',
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
