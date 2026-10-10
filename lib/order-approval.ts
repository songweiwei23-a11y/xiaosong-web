import { NextResponse } from 'next/server';
import { COUNTED_FEATURES, activationPlan } from '@/lib/config/plans';

/**
 * 订单审核的数据库事务入口（2026-10-10 巡检 P2-10）。
 *
 * 优先调用 public.admin_approve_order：订单状态、会员、额度三步在一个事务里完成，
 * 中途失败整体回滚。到期日、续费、额度是否清零仍由 activationPlan() 算好再传进去。
 *
 * 函数还没在线上执行时（PGRST202 / 42883），返回 null，由调用方退回原来的分步流程，
 * 所以先发布代码、后执行 SQL 也不会中断审核。
 */

export const APPROVE_RPC = 'admin_approve_order';

export interface ApproveInput {
  orderId: string;
  order: { user_id: string; billing_cycle?: string | null; amount?: number | null; plan_name?: string | null; plan_id?: string | null };
  approved: boolean;
  note: string | null | undefined;
  planId: string | null | undefined;
  adminId: string;
  now: string;
}

// 只需要 rpc 和读订阅这两个能力，方便测试时替换
type Db = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any -- 查询构造器泛型过深，见 lib/admin-delete-user.ts 的同类说明
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

/**
 * 函数不存在（还没部署）时返回 true，调用方应退回老流程。
 * 只认「函数」这一类报错：PostgREST 的 PGRST202，或 Postgres 的 42883（undefined_function）。
 * 不能用宽泛的 "does not exist" 去匹配——那会把「某一列不存在」（42703）也当成函数缺失，
 * 从而悄悄退回老流程（测试 admin-async-and-transaction 抓到过这个问题）。
 */
export function isFunctionMissing(error: { code?: string; message: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /Could not find the function/i.test(error.message) || /function\s+\S+\s+does not exist/i.test(error.message);
}

/**
 * 能走事务函数时返回 NextResponse（成功或业务错误）；函数不存在时返回 null（调用方走老流程）。
 * 数据库内部的其它错误也返回 500，并且因为事务已回滚，订单和会员都没有被半改。
 */
export async function approveViaRpc(db: Db, input: ApproveInput): Promise<NextResponse | null> {
  const cycle = input.order.billing_cycle === 'yearly' ? 'yearly' : 'monthly';

  // 套餐的到期日、续费、额度清零，沿用 activationPlan 的规则（和老流程完全一致）
  let plan: { endDate: string | null; isRenewal: boolean; resetQuota: boolean; quotaPeriodEnd: string | null } = {
    endDate: null, isRenewal: false, resetQuota: false, quotaPeriodEnd: null,
  };
  if (input.approved) {
    const { data: currentSub, error: readError } = await db
      .from('subscriptions')
      .select('plan, status, end_date')
      .eq('user_id', input.order.user_id)
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ error: `读取现有会员失败：${readError.message}` }, { status: 500 });
    }
    plan = activationPlan(currentSub, String(input.planId ?? ''), cycle) as typeof plan;
  }

  const quotaColumns = Object.fromEntries(COUNTED_FEATURES.map((f) => [f.column, 0]));

  const { data, error } = await db.rpc(APPROVE_RPC, {
    p_order_id: input.orderId,
    p_admin: input.adminId,
    p_approved: input.approved,
    p_note: input.note ? String(input.note).trim() || null : null,
    p_plan_id: input.approved ? input.planId : null,
    p_end_date: input.approved ? plan.endDate : null,
    p_is_renewal: input.approved ? plan.isRenewal : false,
    p_reset_quota: input.approved ? plan.resetQuota : false,
    p_quota_period_end: input.approved ? plan.quotaPeriodEnd : null,
    p_quota_columns: input.approved && plan.resetQuota ? quotaColumns : {},
    p_now: input.now,
  });

  if (isFunctionMissing(error)) return null;

  if (error) {
    if (/order_not_reviewing/.test(error.message)) {
      return NextResponse.json({ error: '这个订单刚被处理过（可能是重复点击或另一位管理员），请刷新看最新状态' }, { status: 409 });
    }
    if (/order_not_found/.test(error.message)) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }
    console.error('[admin/orders/review] 事务审核失败，已整体回滚:', error.message);
    return NextResponse.json({ error: `审核失败，订单和会员都没有改动，请重试：${error.message}` }, { status: 500 });
  }

  const result = (data ?? {}) as { orderId?: string; status?: string };
  return NextResponse.json({
    success: true,
    message: input.approved ? '订单已通过，会员已开通' : '订单已拒绝',
    data: { orderId: result.orderId ?? input.orderId, status: result.status ?? (input.approved ? 'approved' : 'rejected') },
    viaTransaction: true,
  });
}
