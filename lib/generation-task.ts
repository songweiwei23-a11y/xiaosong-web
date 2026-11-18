import { createHash, randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';

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
    const { error } = await query;
    return !error;
  } catch {
    return false;
  }
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
    const { data: latest, error: latestError } = await db.from('generation_result_versions')
      .select('version,result_sha256').eq('task_id', input.taskId).order('version', { ascending: false }).limit(1).maybeSingle();
    if (latestError) return null;
    const hash = createHash('sha256').update(input.result).digest('hex');
    if (latest?.result_sha256 === hash) return latest.version;
    const version = Number(latest?.version ?? 0) + 1;
    const { error } = await db.from('generation_result_versions').insert({
      task_id: input.taskId,
      version,
      kind: input.kind,
      stage: input.stage.slice(0, 80),
      result: input.result,
      result_sha256: hash,
      metadata: input.metadata ?? {},
    });
    return error ? null : version;
  } catch {
    return null;
  }
}

export async function readGenerationTask(userId: string, taskId: string): Promise<(GenerationTask & { latest?: { version: number; kind: GenerationVersionKind; stage: string; result: string; created_at: string } | null }) | null> {
  try {
    const db = getServiceSupabase();
    const { data: task, error } = await db.from('generation_tasks')
      .select('id,user_id,request_id,profile_id,feature,task_type,status,stage,error_code,error_message,retry_count,heartbeat_at,created_at,updated_at,completed_at')
      .eq('id', taskId).eq('user_id', userId).maybeSingle();
    if (error || !task) return null;
    const { data: latest } = await db.from('generation_result_versions')
      .select('version,kind,stage,result,created_at').eq('task_id', taskId).order('version', { ascending: false }).limit(1).maybeSingle();
    return { ...(task as GenerationTask), latest: latest ?? null };
  } catch {
    return null;
  }
}

export function taskIsRecoverable(status: GenerationTaskStatus): boolean {
  return RECOVERABLE.has(status);
}

export function newGenerationRunToken(): string {
  return randomUUID();
}
