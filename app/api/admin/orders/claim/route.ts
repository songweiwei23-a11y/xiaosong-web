import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

export const dynamic = 'force-dynamic';

/** 认领的租约：15 分钟内只有认领的人能通过或驳回；过期自动释放，别人可以接手 */
const LEASE_MS = 15 * 60_000;

/**
 * 认领待审订单（后台扩展方案 P1-3）。
 *   POST { orderId, action: 'claim' | 'release' }
 * 需要数据库迁移 supabase/migrations/20261022_order_claims.sql。没有执行时返回 503，审核流程照旧可用。
 */
export async function POST(request: Request) {
  const admin = await requireAdminPermission('review_orders');
  if (!admin) return NextResponse.json({ error: '无权认领订单' }, { status: 403 });

  let body: { orderId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ error: '请求格式不对' }, { status: 400 });
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  if (!orderId) return NextResponse.json({ error: '缺少订单编号' }, { status: 400 });
  const db = getServiceSupabase();

  if (body.action === 'release') {
    const { data, error } = await db
      .from('payment_orders')
      .update({ claimed_by: null, claimed_at: null, claim_lease_until: null })
      .eq('id', orderId)
      .eq('claimed_by', admin.userId)
      .select('id');
    if (error) return claimError(error.code, error.message);
    if (!data?.length) return NextResponse.json({ error: '这笔订单不是你认领的，无法释放' }, { status: 409 });
    return NextResponse.json({ success: true, message: '已释放认领' });
  }

  const now = new Date();
  const lease = new Date(now.getTime() + LEASE_MS).toISOString();
  // 可以认领的条件：还在待审，且没人认领、或认领已过期、或就是自己
  const free = `claimed_by.is.null,claim_lease_until.lt.${now.toISOString()},claimed_by.eq.${admin.userId}`;
  const { data, error } = await db
    .from('payment_orders')
    .update({ claimed_by: admin.userId, claimed_at: now.toISOString(), claim_lease_until: lease })
    .eq('id', orderId)
    .eq('status', 'reviewing')
    .or(free)
    .select('id');
  if (error) return claimError(error.code, error.message);
  if (data?.length) {
    await logAdminAction({ admin_id: admin.userId, action: AdminActions.CLAIM_ORDER, target_type: 'order', target_id: orderId, details: { lease_until: lease } });
    return NextResponse.json({ success: true, message: '已认领，15 分钟内由你处理', data: { leaseUntil: lease } });
  }

  // 没认领成功：看看为什么（订单不在了、已处理过、或被别人占着）
  const { data: cur, error: readError } = await db
    .from('payment_orders')
    .select('status, claimed_by, claim_lease_until')
    .eq('id', orderId)
    .maybeSingle();
  if (readError) return claimError(readError.code, readError.message);
  if (!cur) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  if (cur.status !== 'reviewing') return NextResponse.json({ error: '这笔订单已经处理过了，请刷新' }, { status: 409 });
  const until = cur.claim_lease_until ? new Date(cur.claim_lease_until).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '';
  return NextResponse.json(
    { error: `这笔订单正由 ${String(cur.claimed_by ?? '').slice(0, 8)} 认领处理${until ? `，到 ${until} 为止` : ''}` },
    { status: 409 },
  );
}

function claimError(code: string | undefined, message: string) {
  if (code === '42703') {
    return NextResponse.json(
      { error: '订单认领需要先执行数据库迁移 20261022_order_claims.sql，执行后即可使用', stage: 'migration' },
      { status: 503 },
    );
  }
  console.error('[admin/orders/claim] 失败:', message);
  return NextResponse.json({ error: '认领没有成功，请稍后再试' }, { status: 500 });
}
