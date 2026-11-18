import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { processGeneration, type ProcessingInput, type ProcessingState } from '@/lib/generation-processing';
import { saveGenerationVersion } from '@/lib/generation-task';
import { persistCreativeHistory, type CreativeHistoryInput } from '@/lib/creative-history';
import { recordCreationCompletion, releaseCreation, settleCreation, type CreationReservation } from '@/lib/creation-quota';
import { saveDifyConversationId } from '@/lib/dify-conversation';
import { recordGenerationSignal } from '@/lib/learning-signals';
import { acquireCreationWindow } from '@/lib/creation-window-lock';
import { acquireSlot, slotOptionsFromEnv } from '@/lib/generation-slots';
import type { TopicBatchStatus } from '@/lib/sse-stream';

export interface GenerationWork {
  input: ProcessingInput;
  state: ProcessingState;
  reservation: CreationReservation;
  history?: Omit<CreativeHistoryInput, 'result' | 'status'>;
  conversationScope?: 'creation' | 'shared';
  telemetry: Record<string, unknown>;
  timings: Array<{ stage: string; ms: number; ok: boolean }>;
  batch?: TopicBatchStatus;
}

const staleMs = 4 * 60_000;
const active = new Set<string>();
const locks = new Map<string, () => void>();

export async function queueGenerationWork(taskId: string, work: GenerationWork, release: () => void) {
  const db = getServiceSupabase();
  const now = new Date().toISOString();
  // The draft already exists. This single write transfers responsibility for completion and billing.
  locks.set(taskId, release);
  try {
    const { data, error } = await db.from('generation_tasks').update({
      payload: { work }, status: 'post_processing', stage: 'worker_ready',
      updated_at: now, heartbeat_at: now,
    }).eq('id', taskId).eq('user_id', work.reservation.userId).eq('status', 'draft_saved').select('id').maybeSingle();
    if (error || !data) throw new Error('后台任务交接未确认，草稿可在原页面恢复');
  } catch (error) {
    locks.delete(taskId);
    throw error;
  }
  void runGenerationWork(taskId).catch(() => console.warn('[generation-task] 等待下一轮后台扫描'));
}

export async function runGenerationWork(taskId: string) {
  if (active.has(taskId)) return;
  active.add(taskId);
  const token = randomUUID();
  let timer: ReturnType<typeof setInterval> | undefined;
  let release = locks.get(taskId);
  const now = () => new Date().toISOString();
  try {
    const db = getServiceSupabase();
    const { data: row, error } = await db.from('generation_tasks').update({
      run_token: token, heartbeat_at: now(), updated_at: now(),
    }).eq('id', taskId).eq('status', 'post_processing').eq('stage', 'worker_ready')
      .is('run_token', null).select('user_id,request_id,feature,payload,retry_count').maybeSingle();
    if (error || !row) return;
    const work = row.payload?.work as GenerationWork | undefined;
    if (!work || work.input.userId !== row.user_id || work.reservation.userId !== row.user_id ||
      work.reservation.requestId !== row.request_id || work.reservation.feature !== row.feature) throw new Error('后台任务归属不一致');
    const write = async (patch: Record<string, unknown>) => {
      const r = await db.from('generation_tasks').update({ ...patch, updated_at: now(), heartbeat_at: now() })
        .eq('id', taskId).eq('run_token', token).select('id').maybeSingle();
      if (r.error || !r.data) throw new Error('后台任务租约或写入失败');
    };
    timer = setInterval(() => { void db.from('generation_tasks').update({ heartbeat_at: now() })
      .eq('id', taskId).eq('run_token', token).then(() => {}, () => {}); }, 15_000);
    timer.unref();
    if (!release) {
      // After a restart the original in-process locks are gone.
      const freeWindow = work.input.creativeWindow ? await acquireCreationWindow(row.user_id, work.input.profileId, AbortSignal.timeout(60_000)) : () => {};
      release = freeWindow;
      const freeSlot = await acquireSlot(row.user_id, slotOptionsFromEnv());
      release = () => { freeSlot(); freeWindow(); };
    }
    const trace = async <T>(stage: string, fn: () => Promise<T>) => {
      const start = Date.now();
      try {
        const value = await fn();
        work.timings.push({ stage, ms: Date.now() - start, ok: !!(value as { ok?: boolean } | null)?.ok });
        return value;
      } catch (error) {
        work.timings.push({ stage, ms: Date.now() - start, ok: false });
        throw error;
      }
    };
    const send = (event: Record<string, unknown>) => {
      if (event.event === 'topic_batch') work.batch = {
        requested: Number(event.requested), count: Number(event.count), checked: event.checked === true,
        removed: Number(event.removed), replaced: Number(event.replaced),
      };
    };
    work.state = await processGeneration(work.input, work.state, trace, send, async (step, state, entering) => {
      const changed = state.fullResponse !== work.state.fullResponse;
      if (!entering && changed && state.fullResponse.trim()) {
        const saved = await saveGenerationVersion({ taskId, kind: 'processed', stage: step, result: state.fullResponse,
          metadata: { changed: true, reason: step } });
        if (saved === null) throw new Error('中间版本保存失败');
      }
      work.state = state;
      await write({ stage: entering ? 'running_' + step : 'worker_checkpoint', payload: { work } });
    });
    if (work.state.outcome.kind === 'error') {
      await releaseCreation(work.reservation);
      await write({ status: 'partial_saved', stage: 'post_processing', error_code: 'POST_PROCESSING_INCOMPLETE',
        error_message: work.state.outcome.message, run_token: null, payload: {} });
      return;
    }
    await write({ stage: 'worker_finalize', payload: { work } });
    const { fullResponse, capturedConversationId, capturedMessageId, completionTerminal, usageMetadata } = work.state;
    if (!fullResponse.trim() || !completionTerminal) throw new Error('生成结果缺少完成标记');
    const { userId, profileId, body, generationConversationId, topicContext } = work.input;
    if (work.history && !await persistCreativeHistory(db, userId, { ...work.history, result: fullResponse, status: 'completed' })) throw new Error('历史保存失败');
    const version = await saveGenerationVersion({ taskId, kind: 'final', stage: 'final_save', result: fullResponse,
      metadata: { topicBatch: work.batch, postChanged: fullResponse !== work.input.rawResponse } });
    if (version === null) throw new Error('最终稿保存失败');
    const usage = { ...usageMetadata, ...work.telemetry, stages: work.timings,
      extra_calls: work.timings.filter(s => s.stage !== 'generate').length,
      post_changed: fullResponse !== work.input.rawResponse, ...(topicContext ? { direction_topic: topicContext } : {}) };
    await recordCreationCompletion(work.reservation, { result: fullResponse, terminal: completionTerminal,
      conversationId: capturedConversationId, messageId: capturedMessageId, usage }, body.taskType);
    await settleCreation(work.reservation, true, body.taskType);
    const conversationId = work.conversationScope === 'creation' ? generationConversationId : capturedConversationId;
    if (conversationId && work.conversationScope) {
      await saveDifyConversationId(userId, conversationId, profileId, body.taskType, ...(work.conversationScope === 'creation' ? ['creation'] as const : []));
    }
    await write({ status: 'completed', stage: 'final_save', completed_at: now(), run_token: null,
      error_code: null, error_message: null, payload: {} });
    void recordGenerationSignal({ userId, profileId, board: work.reservation.feature, result: fullResponse }).catch(() => {});
  } finally {
    if (timer) clearInterval(timer);
    release?.();
    locks.delete(taskId);
    active.delete(taskId);
  }
}

// Recover between completed steps, or retry idempotent final writes. An upstream call interrupted
// before its checkpoint has an unknown outcome, so it must never be automatically billed twice.
export async function scanGenerationWork() {
  const db = getServiceSupabase();
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const { data: stale } = await db.from('generation_tasks').select('id,stage,run_token,heartbeat_at,retry_count')
    .eq('status', 'post_processing').not('run_token', 'is', null).lt('heartbeat_at', cutoff).limit(50);
  for (const row of stale ?? []) {
    const safe = ['worker_checkpoint', 'worker_finalize', 'worker_ready'].includes(row.stage) && row.retry_count < 3;
    await db.from('generation_tasks').update(safe
      ? { stage: 'worker_ready', run_token: null, retry_count: row.retry_count + 1 }
      : { status: 'recoverable_failed', run_token: null, error_code: 'STAGE_INTERRUPTED',
        error_message: '后处理被中断，已保留最近版本。' })
      .eq('id', row.id).eq('status', 'post_processing').eq('run_token', row.run_token).eq('heartbeat_at', row.heartbeat_at);
  }
  const { data } = await db.from('generation_tasks').select('id').eq('stage', 'worker_ready')
    .eq('status', 'post_processing').is('run_token', null).order('updated_at').limit(5);
  for (const row of data ?? []) await runGenerationWork(row.id).catch(() => {});
}
