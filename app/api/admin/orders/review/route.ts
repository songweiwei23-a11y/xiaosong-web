import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS, COUNTED_FEATURES } from '@/lib/config/plans';

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

    // 只有传了凭证（reviewing）的订单才谈得上审核。
    // pending 是下了单还没传凭证，approved/rejected 是审过了，都不该再审一次。
    if (order.status !== 'reviewing') {
      const why =
        order.status === 'pending'
          ? '用户还没上传转账凭证'
          : order.status === 'approved'
            ? '该订单已通过审核'
            : '该订单已被拒绝';
      return NextResponse.json({ error: why }, { status: 400 });
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

    // 通过则开通会员
    if (approved) {
      const endDate = new Date();
      if (order.billing_cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      /*
       * 套餐 id 直接取订单上的 plan_id。
       *
       * 原先是 order.plan_name.toLowerCase().replace('会员','').replace('版','')
       * ——拿中文显示名去凑英文 id。「基础会员」凑出来是「基础」，
       * 不是任何一个合法套餐，写进 subscriptions 之后 getPlan() 会兜底成
       * 免费版：用户付了钱，权益一点没涨，而且没有任何报错。
       */
      const planId = order.plan_id;
      if (!planId || !(planId in SUBSCRIPTION_PLANS)) {
        console.error('[admin/orders/review] 订单上的套餐 id 非法:', planId);
        return NextResponse.json(
          { error: `订单的套餐标识非法（${planId}），无法开通，请联系技术处理` },
          { status: 400 }
        );
      }

      /*
       * 列名必须是 start_date / end_date。
       * 原先写的是 current_period_start / current_period_end——subscriptions
       * 表上没有这两列，整条 upsert 会失败，而失败只是 console.error 了一下：
       * 订单显示「已通过」，会员其实没开通。
       */
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: order.user_id,
            plan: planId,
            status: 'active',
            start_date: now,
            end_date: endDate.toISOString(),
            updated_at: now,
          },
          { onConflict: 'user_id' }
        );

      if (subError) {
        // 开通失败必须让管理员知道。默默记日志的话，他会以为审核成功了
        console.error('[admin/orders/review] 开通会员失败:', subError);
        return NextResponse.json(
          { error: '订单状态已更新，但开通会员失败：' + subError.message },
          { status: 500 }
        );
      }

      /*
       * 新周期开始，额度重置。
       * 不重置的话，用户升级后带着上个周期用满的数字进来，
       * 交了钱却立刻显示额度已用完。
       */
      const resetColumns: Record<string, unknown> = {
        current_period_start: now,
        current_period_end: endDate.toISOString(),
        updated_at: now,
      };
      for (const f of COUNTED_FEATURES) resetColumns[f.column] = 0;
      resetColumns.knowledge_used = 0;

      const { error: quotaError } = await supabase
        .from('user_quotas')
        .upsert({ user_id: order.user_id, ...resetColumns }, { onConflict: 'user_id' });

      if (quotaError) {
        console.error('[admin/orders/review] 额度重置失败:', quotaError);
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
        plan: order.plan_id,
        plan_name: order.plan_name,
        billing_cycle: order.billing_cycle,
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