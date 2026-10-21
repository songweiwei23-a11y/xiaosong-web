import { getServiceSupabase } from '@/lib/admin-auth';
import { isFunctionMissing } from '@/lib/order-approval';
import { COUNT_PACK_RULES } from '@/lib/config/count-packs';

/**
 * 次数包的服务端调用。所有读写都经过数据库函数（见 supabase/migrations/20261020_count_packs.sql），
 * 这里不直接改余额表，避免并发时余额变负。
 */

export interface CountPackReserveResult {
  allowed: boolean;
  /** duplicate / conflict / pack_empty */
  reason?: string;
  state?: string;
}

/** 当前可用的次数（未过期、扣掉了未结算的预留）。读不到时抛错，由调用方决定怎么处理。 */
export async function countPackBalance(userId: string, now: Date = new Date()): Promise<number> {
  const { data, error } = await getServiceSupabase()
    .from('count_pack_lots')
    .select('credits_remaining, expires_at')
    .eq('user_id', userId)
    .gt('credits_remaining', 0);
  if (error) throw new Error('次数包余额暂时无法读取');
  return (data ?? [])
    .filter((lot) => !lot.expires_at || new Date(lot.expires_at).getTime() > now.getTime())
    .reduce((sum, lot) => sum + (Number(lot.credits_remaining) || 0), 0);
}

/** 会员额度用完后，改从次数包预留。调用方在会员预留返回 quota 之后才调用。 */
export async function reserveCountPackCredit(
  userId: string,
  requestId: string,
  feature: string,
  fingerprint: string,
  cost: number,
): Promise<CountPackReserveResult> {
  const { data, error } = await getServiceSupabase().rpc('kaiwu_reserve_pack_credit', {
    p_user_id: userId,
    p_request_id: requestId,
    p_feature: feature,
    p_fingerprint: fingerprint,
    p_cost: cost,
  });
  // 迁移还没在数据库执行时函数不存在：按「次数包没有余额」处理，调用方照常返回额度用完（402），
  // 不能变成 503 让所有会员额度用完的用户反复重试。
  if (isFunctionMissing(error)) return { allowed: false, reason: 'pack_empty' };
  if (error || !data) throw new Error(error?.message ?? '次数包预留无结果');
  return data as CountPackReserveResult;
}

/** 结算次数包预留。找不到预留时返回 false（调用方据此判断不是次数包预留）。 */
export async function settleCountPackCredit(
  userId: string,
  requestId: string,
  success: boolean,
  taskType?: string,
  detail?: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await getServiceSupabase().rpc('kaiwu_settle_pack_credit', {
    p_user_id: userId,
    p_request_id: requestId,
    p_success: success,
    p_task_type: taskType ?? null,
    p_detail: detail ?? null,
  });
  // 函数不存在时不可能有次数包预留，直接按「不是次数包预留」返回
  if (isFunctionMissing(error)) return false;
  if (error) throw new Error(error.message);
  return Boolean(data?.settled);
}

export type ApproveCountPackResult =
  | { kind: 'ok'; status: 'approved' | 'rejected'; credits: number }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

/**
 * 审核次数包订单：订单状态和发放批次在同一个事务里完成。
 * 函数没部署时返回 missing，调用方直接拒绝（次数包没有老流程可退回，宁可不发也不能手工补）。
 */
export async function approveCountPackOrder(args: {
  orderId: string;
  adminId: string;
  approved: boolean;
  note: string | null;
  credits: number;
  validUntil: string | null;
  now: string;
}): Promise<ApproveCountPackResult> {
  const { data, error } = await getServiceSupabase().rpc('admin_approve_count_pack_order', {
    p_order_id: args.orderId,
    p_admin: args.adminId,
    p_approved: args.approved,
    p_note: args.note,
    p_credits: args.approved ? args.credits : null,
    p_valid_until: args.approved ? args.validUntil : null,
    p_now: args.now,
  });
  if (isFunctionMissing(error)) return { kind: 'missing' };
  if (error) return { kind: 'error', message: error.message };
  const r = (data ?? {}) as { status?: string; credits?: number };
  return {
    kind: 'ok',
    status: r.status === 'approved' ? 'approved' : 'rejected',
    credits: Number(r.credits) || 0,
  };
}

/** 一个用户已通过审核的某款次数包订单数（用于每账号限购） */
export async function countApprovedPackOrders(userId: string, packId: string): Promise<number> {
  const { count, error } = await getServiceSupabase()
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('plan_id', packId)
    .eq('status', 'approved');
  if (error) throw new Error('限购次数暂时无法确认');
  return count ?? 0;
}

/** 每次创作扣几次（不计次数包的功能返回 null，由调用方直接按会员额度处理） */
export function packCostPerCreation(): number {
  return COUNT_PACK_RULES.costPerCreation;
}
