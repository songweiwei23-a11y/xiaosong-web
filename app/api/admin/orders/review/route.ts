import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { orderId, approved, note } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: '缺少订单ID' }, { status: 400 });
    }

    // 获取订单信息
    const { data: order, error: fetchError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    if (order.status !== 'reviewing') {
      return NextResponse.json({ error: '订单状态不允许审核' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newStatus = approved ? 'approved' : 'rejected';

    // 更新订单状态
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: newStatus,
        reviewed_at: now,
        reviewer_id: admin.userId,
        review_note: note || null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('更新订单失败:', updateError);
      return NextResponse.json({ error: '审核失败' }, { status: 500 });
    }

    // 如果通过，开通会员
    if (approved) {
      const endDate = new Date();
      if (order.billing_cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: order.user_id,
          plan: order.plan_name.toLowerCase().replace('会员', '').replace('版', ''),
          status: 'active',
          current_period_start: now,
          current_period_end: endDate.toISOString(),
          updated_at: now,
        });

      if (subError) {
        console.error('开通会员失败:', subError);
      }
    }

    // 记录管理员操作日志
    await logAdminAction({
      admin_id: admin.userId,
      action: approved ? AdminActions.APPROVE_ORDER : AdminActions.REJECT_ORDER,
      target_type: 'order',
      target_id: orderId,
      details: {
        order_amount: order.amount,
        plan: order.plan_name,
        note: note,
      },
    });

    return NextResponse.json({
      success: true,
      message: approved ? '订单已通过，会员已开通' : '订单已拒绝',
      data: { orderId, status: newStatus },
    });
  } catch (error: any) {
    console.error('审核订单错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}