import { createHash, randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { COUNTED_FEATURES, SUBSCRIPTION_PLANS, usedColumnOf } from '@/lib/config/plans';

export interface CreationReservation { userId: string; requestId: string; feature: string }
export interface CreationCompletion {
  result: string;
  terminal: 'message_end' | 'workflow_finished' | 'recovered_message' | 'structured_result';
  conversationId?: string;
  messageId?: string;
  usage?: Record<string, unknown>;
}
type ReservationResult = { ok: true; reservation: CreationReservation } | { ok: false; response: Response };

export function quotaUnavailable(): Response {
  return Response.json({ error: '暂时无法确认创作额度，请稍后重试', code: 'QUOTA_UNAVAILABLE', retryable: true }, {
    status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' },
  });
}

/** Quota-only endpoints need rollover too, but must not reserve or deduct a generation. */
export async function refreshCreationPeriod(userId: string): Promise<void> {
  const { data, error } = await getServiceSupabase().rpc('kaiwu_reserve_creation', {
    p_user_id: userId, p_request_id: null, p_feature: 'freeChat', p_fingerprint: '',
    p_plans: SUBSCRIPTION_PLANS, p_features: COUNTED_FEATURES,
  });
  if (error || !data?.allowed) throw new Error('Quota period refresh unavailable');
}

/** Must run after input validation and before any paid generation. No RPC fallback: missing migration fails closed. */
export async function reserveCreation(userId: string, feature: string, request: Request, payload: unknown): Promise<ReservationResult> {
  if (!usedColumnOf(feature)) return { ok: false, response: Response.json({ error: '不支持的创作类型' }, { status: 400 }) };
  const explicitId = request.headers.get('X-Generation-Id') || (payload && typeof payload === 'object' ? (payload as Record<string, unknown>).requestId : undefined);
  if (explicitId !== undefined && (typeof explicitId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(explicitId))) {
    return { ok: false, response: Response.json({ error: '生成请求编号格式不正确' }, { status: 400 }) };
  }
  const requestId = explicitId as string || randomUUID();
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  try {
    const { data, error } = await getServiceSupabase().rpc('kaiwu_reserve_creation', {
      p_user_id: userId, p_request_id: requestId, p_feature: feature, p_fingerprint: fingerprint,
      p_plans: SUBSCRIPTION_PLANS, p_features: COUNTED_FEATURES,
    });
    if (error || !data) {
      console.error('[creation-quota] reserve unavailable', error?.code ?? 'empty result');
      return { ok: false, response: quotaUnavailable() };
    }
    if (!data.allowed) {
      const duplicate = data.reason === 'duplicate' || data.reason === 'conflict';
      const status = duplicate ? 409 : data.reason === 'banned' ? 403 : 402;
      return { ok: false, response: Response.json({
        error: duplicate ? '这次生成已提交，请查看原来的结果；重新生成请发起新的操作' : data.reason === 'banned' ? '您的账户已被封禁，请联系管理员' : '本期创作额度已用完或正在生成中，请稍后查看结果或升级会员',
        code: duplicate ? 'GENERATION_ALREADY_SUBMITTED' : 'QUOTA_EXHAUSTED', feature,
        requestId, state: data.state, used: data.used, limit: data.limit,
      }, { status, headers: { 'Cache-Control': 'no-store' } }) };
    }
    return { ok: true, reservation: { userId, requestId, feature } };
  } catch {
    return { ok: false, response: quotaUnavailable() };
  }
}

/** Idempotent settlement; a failed commit stays reserved and can safely be retried. Never release it on ambiguous failure. */
export async function settleCreation(reservation: CreationReservation, success: boolean, taskType?: string, detail?: Record<string, unknown>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await getServiceSupabase().rpc('kaiwu_settle_creation', {
        p_user_id: reservation.userId, p_request_id: reservation.requestId,
        p_success: success, p_task_type: taskType ?? null, p_detail: detail ?? null,
      });
      if (!error && data?.settled) return;
      lastError = error?.code ?? 'reservation not settled';
    } catch (error) { lastError = error; }
  }
  console.error('[creation-quota] settlement unavailable', lastError instanceof Error ? lastError.name : lastError);
  throw new Error('暂时无法确认创作额度状态，请保留结果，稍后检查用量');
}

export async function releaseCreation(reservation: CreationReservation | undefined): Promise<void> {
  if (!reservation) return;
  try { await settleCreation(reservation, false); }
  catch { console.error('[creation-quota] release pending; reservation expires after two hours'); }
}

/** Persist trusted server-read full result BEFORE confirming usage, so admin reconciliation has proof. */
export async function recordCreationCompletion(reservation: CreationReservation, completion: CreationCompletion, taskType?: string): Promise<void> {
  if (!completion.result.trim()) throw new Error('Cannot record an empty completion');
  const args = {
    p_user_id: reservation.userId, p_request_id: reservation.requestId,
    p_result: completion.result, p_result_sha256: createHash('sha256').update(completion.result).digest('hex'),
    p_terminal: completion.terminal, p_task_type: taskType ?? null,
    p_conversation_id: completion.conversationId ?? null, p_message_id: completion.messageId ?? null,
    p_usage: completion.usage ?? {},
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await getServiceSupabase().rpc('kaiwu_record_creation_completion', args);
      if (!error && data?.recorded) return;
    } catch { /* Retry same hash/id, never invent success evidence. */ }
  }
  throw new Error('创作完成证据暂未同步，请保留结果');
}

/** Only retain numeric telemetry actually reported by upstream; absence is unknown, not zero cost. */
export function completionUsage(event: unknown): Record<string, unknown> {
  if (!event || typeof event !== 'object') return {};
  const e = event as Record<string, any>;
  const usage = e.metadata?.usage || e.data?.usage || {};
  const out: Record<string, unknown> = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'latency', 'total_price']) {
    const raw = usage[key];
    if ((typeof raw==='number' || (typeof raw==='string' && raw.trim()!=='')) && Number.isFinite(Number(raw)) && Number(raw) >= 0) out[key] = Number(raw);
  }
  if (typeof usage.currency === 'string' && /^[A-Za-z]{3}$/.test(usage.currency)) out.currency = usage.currency;
  for (const key of ['total_tokens','elapsed_time']) {
    const value = e.data?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value;
  }
  return out;
}
