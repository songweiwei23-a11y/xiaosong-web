import { createHash, randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { ACTIVE_GENERATION_STATUSES } from '@/lib/generation-scope';

export const GENERATION_TASK_STATES = [
  'accepted', 'queued', 'generating', 'draft_saved', 'post_processing', 'completed',
  'partial_saved', 'recoverable_failed', 'permanent_failed', 'canceled',
] as const;
export type GenerationTaskStatus = typeof GENERATION_TASK_STATES[number];
export type GenerationVersionKind = 'draft' | 'processed' | 'final';

export type GenerationTask = {
  id: string;
  user_id: string;
  request_id: string;
  profile_id: string | null;
  feature: string;
  task_type: string;
  status: GenerationTaskStatus;
  stage: string;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type GenerationTaskEvent =
  | { event: 'task_accepted'; taskId: string; requestId: string; status: GenerationTaskStatus; stage: string }
  | { event: 'stage'; taskId: string; stage: string; status: GenerationTaskStatus; message?: string }
  | { event: 'draft_saved' | 'version_saved' | 'final_saved'; taskId: string; version: number; saved: boolean; stage: string }
  | { event: 'partial_saved' | 'recoverable_failed'; taskId: string; message: string; code?: string }
  | { event: 'error'; taskId?: string; message: string; code?: string };

const RECOVERABLE = new Set<GenerationTaskStatus>(['queued', 'generating', 'post_processing', 'partial_saved', 'recoverable_failed']);
const MAX_RESULT_BYTES = 1_600_000;

export function generationInputHash(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** A best-effort task record never blocks the existing paid generation path until its migration is available. */
export async function ensureGenerationTask(input: {
  userId: string;
  requestId: string;
  profileId: string | null;
  feature: string;
  taskType: string;
  payload: unknown;
}): Promise<{ id: string; existing: boolean; status: GenerationTaskStatus; stage: string } | null> {
  try {
    const { data, error } = await getServiceSupabase().rpc('kaiwu_create_generation_task', {
      p_user_id: input.userId,
      p_request_id: input.requestId,
      p_profile_id: input.profileId,
      p_feature: input.feature,
      p_task_type: input.taskType,
      p_input_hash: generationInputHash(input.payload),
      p_payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    });
    if (error || !data?.id || typeof data.id !== 'string') return null;
    return {
      id: data.id,
      existing: data.existing === true,
      status: GENERATION_TASK_STATES.includes(data.status) ? data.status : 'accepted',
      stage: typeof data.stage === 'string' ? data.stage : 'accepted',
    };
  } catch {
    return null;
  }
}

export async function updateGenerationTask(input: {
  taskId: string;
  status: GenerationTaskStatus;
  stage: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  completed?: boolean;
  token?: string;
  expectedStatus?: GenerationTaskStatus;
  staleBefore?: string;
}): Promise<boolean> {
  try {
    const db = getServiceSupabase();
    const patch = {
      status: input.status,
      stage: input.stage.slice(0, 80),
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage?.slice(0, 500) ?? null,
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(input.completed ? { completed_at: new Date().toISOString(), run_token: null } : {}),
    };
    let query = db.from('generation_tasks').update(patch).eq('id', input.taskId);
    if (input.token) query = query.eq('run_token', input.token);
    if (input.expectedStatus) query = query.eq('status', input.expectedStatus);
    if (input.staleBefore) query = query.is('run_token', null).neq('stage', 'worker_ready').or(`heartbeat_at.is.null,heartbeat_at.lt.${input.staleBefore}`);
    const { data, error } = await query.select('id').maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

export async function refreshGenerationHeartbeat(taskId: string): Promise<void> {
  const time = new Date().toISOString();
  try {
    await getServiceSupabase().from('generation_tasks').update({ heartbeat_at: time, updated_at: time })
      .eq('id', taskId).in('status', ['accepted', 'queued', 'generating']).is('run_token', null);
  } catch { /* The next task heartbeat can retry. */ }
}

export async function saveGenerationVersion(input: {
  taskId: string;
  kind: GenerationVersionKind;
  stage: string;
  result: string;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  if (!input.result.trim() || Buffer.byteLength(input.result, 'utf8') > MAX_RESULT_BYTES) return null;
  try {
    const db = getServiceSupabase();
    const hash = createHash('sha256').update(input.result).digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: latest, error } = await db.from('generation_result_versions')
        .select('version,result_sha256,kind,stage').eq('task_id', input.taskId)
        .order('version', { ascending: false }).limit(1).maybeSingle();
      if (error) return null;
      if (latest?.result_sha256 === hash && latest.kind === input.kind && latest.stage === input.stage) return latest.version;
      // A concurrent or retried draft must never become newer than a final version.
      if (latest?.kind === 'final' || (input.kind === 'draft' && latest)) return null;
      const version = Number(latest?.version ?? 0) + 1;
      const { error: insertError } = await db.from('generation_result_versions').insert({
        task_id: input.taskId, version, kind: input.kind, stage: input.stage.slice(0, 80),
        result: input.result, result_sha256: hash,
        metadata: { ...input.metadata, basedOnVersion: latest?.version ?? null },
      });
      if (!insertError) return version;
      if (insertError.code !== '23505') return null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function readGenerationTask(userId: string, selector: string | { taskType: string; profileId: string | null; preferredId?: string; requestId?: string }): Promise<(GenerationTask & { latest?: { version: number; kind: GenerationVersionKind; stage: string; result: string; created_at: string } | null }) | null> {
  const db = getServiceSupabase();
  const query = db.from('generation_tasks')
    .select('id,user_id,request_id,profile_id,feature,task_type,status,stage,error_code,error_message,retry_count,heartbeat_at,created_at,updated_at,completed_at,generation_result_versions(version,kind,stage,result,created_at,metadata)')
    .order('version', { referencedTable: 'generation_result_versions', ascending: false })
    .limit(1, { referencedTable: 'generation_result_versions' })
    .eq('user_id', userId);
  if (typeof selector === 'string') {
    query.eq('id', selector);
  } else {
    query.eq('task_type', selector.taskType);
    if (selector.profileId === null) query.is('profile_id', null);
    else query.eq('profile_id', selector.profileId);
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const pending = [...ACTIVE_GENERATION_STATUSES, 'partial_saved', 'recoverable_failed'];
    if (selector.requestId) query.eq('request_id', selector.requestId);
    else if (selector.preferredId) query.or(`id.eq.${selector.preferredId},and(status.in.(${pending.join(',')}),created_at.gte.${since})`);
    else query.in('status', pending).gte('created_at', since);
    query.order('created_at', { ascending: false }).limit(1);
  }
  const { data: task, error } = await query.maybeSingle();
  if (error) throw new Error('任务查询暂时不可用');
  if (!task) return null;
  const { generation_result_versions: versions, ...summary } = task;
  return { ...(summary as GenerationTask), latest: versions[0] ?? null };
}

export function taskIsRecoverable(status: GenerationTaskStatus): boolean {
  return RECOVERABLE.has(status);
}

export function newGenerationRunToken(): string {
  return randomUUID();
}
