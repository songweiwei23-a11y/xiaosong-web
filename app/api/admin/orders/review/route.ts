import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS, COUNTED_FEATURES, activationPlan } from '@/lib/config/plans';
import { approveViaRpc } from '@/lib/order-approval';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 验证管理员权限（审核订单需要 review_orders，见 lib/admin-permissions）
    const admin = await requireAdminPermission('review_orders');
    if (!admin) {
      return NextResponse.json({ error: '无权审核订单' }, { status: 403 });
    }

    const { orderId, approved, note } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: '缺少订单ID' }, { status: 400 });
    }
    // 驳回的原因会显示给用户（「我的账户」里的订单栏），必须写清楚
    if (!approved && !String(note ?? '').trim()) {
      return NextResponse.json({ error: '驳回订单请写明原因，用户会在「我的账户」里看到这句话' }, { status: 400 });
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

    /*
     * 套餐 id 直接取订单上的 plan_id，**改订单状态之前**就校验（2026-10-07 体检 A02）：
     * 原来先把订单改成「已通过」再校验、再开通——开通一失败，订单停在「已通过」，
     * 管理员重试被「该订单已通过审核」挡回去，用户付了钱拿不到权益。
     *
     * 原先还是 order.plan_name.toLowerCase().replace('会员','').replace('版','')
     * ——拿中文显示名去凑英文 id。「基础会员」凑出来是「基础」，
     * 不是任何一个合法套餐，写进 subscriptions 之后 getPlan() 会兜底成
     * 免费版：用户付了钱，权益一点没涨，而且没有任何报错。
     */
    const planId = order.plan_id;
    if (approved && (!planId || !(planId in SUBSCRIPTION_PLANS))) {
      console.error('[admin/orders/review] 订单上的套餐 id 非法:', planId);
      return NextResponse.json(
        { error: `订单的套餐标识非法（${planId}），无法开通，请联系技术处理` },
        { status: 400 }
      );
    }

    /*
     * 优先走数据库事务函数（2026-10-10 巡检 P2-10）：订单、会员、额度一次提交，中途失败整体回滚。
     * 函数还没在线上执行时返回 null，下面照常走老流程。
     */
    const viaTransaction = await approveViaRpc(supabase as never, {
      orderId,
      order,
      approved: !!approved,
      note,
      planId,
      adminId: admin.userId,
      now,
    });
    if (viaTransaction) return viaTransaction;

    /*
     * 抢占订单：只有仍是「审核中」的才改得动（条件更新是原子的）。
     * 两个管理员同时点、或者网络超时又点了一次，只有一个能抢到，会员只开通一次
     */
    const { data: claimed, error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: newStatus,
        reviewed_at: now,
        reviewer_id: admin.userId,
        review_note: note || null,
      })
      .eq('id', orderId)
      .eq('status', 'reviewing')
      .select('id');

    if (updateError) {
      console.error('更新订单失败:', updateError);
      return NextResponse.json({ error: '审核失败' }, { status: 500 });
    }
    if (!claimed?.length) {
      return NextResponse.json({ error: '这个订单刚被处理过（可能是重复点击或另一位管理员），请刷新看最新状态' }, { status: 409 });
    }

    /** 开通没成功：订单退回「审核中」，管理员可以直接重试，不会卡在「已通过但没权益」 */
    const rollback = async (stage: string, message: string) => {
      const { error } = await supabase
        .from('payment_orders')
        .update({ status: 'reviewing', reviewed_at: null, reviewer_id: null })
        .eq('id', orderId)
        .eq('status', newStatus)
        .eq('reviewer_id', admin.userId);
      if (error) console.error('[admin/orders/review] 退回审核中失败:', error);
      return NextResponse.json(
        { error: `${stage}失败，订单已退回「审核中」，可以直接重试：${message}`, stage },
        { status: 500 }
      );
    };

    // 通过则开通会员
    if (approved) {

      /*
       * 到期日怎么算、额度要不要清零，交给 activationPlan()。
       * 原来这里是"从现在起加一个月"，而且把额度周期设成和订阅一样长——
       * 提前续费会吞掉剩余天数，年付用户一整年只有一个月额度。详见那个函数的注释。
       */
      const { data: currentSub, error: readSubError } = await supabase
        .from('subscriptions')
        .select('plan, status, end_date')
        .eq('user_id', order.user_id)
        .maybeSingle();
      // 读不到现有订阅就不开通：不然会把「续费」当成「新开」，吞掉用户剩余的天数
      if (readSubError) return rollback('读取现有会员', readSubError.message);
      const plan = activationPlan(
        currentSub,
        planId,
        order.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
      );

      /*
       * 列名必须是 start_date / end_date。
       * 原先写的是额度表的 current_period_* 两列——subscriptions
       * 表上没有这两列，整条 upsert 会失败，而失败只是 console.error 了一下：
       * 订单显示「已通过」，会员其实没开通。
       *
       * 续费时不改 start_date：它记的是这一段会员从哪天开始的，顺延不算重新开始。
       */
      const subRow: Record<string, unknown> = {
        user_id: order.user_id,
        plan: planId,
        status: 'active',
        end_date: plan.endDate,
        updated_at: now,
      };
      if (!plan.isRenewal) subRow.start_date = now;

      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert(subRow, { onConflict: 'user_id' });

      if (subError) {
        // 开通失败必须让管理员知道，并且订单退回审核中可重试（会员还没写进去，重试不会重复开通）
        console.error('[admin/orders/review] 开通会员失败:', subError);
        return rollback('开通会员', subError.message);
      }

      /*
       * 新开 / 升级 / 过期后重新买：额度清零，开新一轮。
       * 不重置的话，用户升级后带着上个周期用满的数字进来，
       * 交了钱却立刻显示额度已用完。
       *
       * 同款续费不动额度：他还在当前这一轮里，额度按原来的月度节奏走，
       * 到点由 api-guard 自动重置。
       *
       * 额度周期结束时间用 plan.quotaPeriodEnd（永远 30 天），
       * **不能**用订阅到期日——那是年付用户一年只有一个月额度的根源。
       */
      if (plan.resetQuota) {
        // 下面这几列是额度表的周期（不是会员表的 start_date / end_date）
        const quotaTable = 'user_quotas';
        const resetColumns: Record<string, unknown> = {
          current_period_start: now,
          current_period_end: plan.quotaPeriodEnd,
          updated_at: now,
        };
        for (const f of COUNTED_FEATURES) resetColumns[f.column] = 0;

        // 额度清零是幂等的（清两次结果一样），失败先原地再试一次
        let quotaError = (await supabase.from(quotaTable).upsert({ user_id: order.user_id, ...resetColumns }, { onConflict: 'user_id' })).error;
        if (quotaError) quotaError = (await supabase.from(quotaTable).upsert({ user_id: order.user_id, ...resetColumns }, { onConflict: 'user_id' })).error;

        if (quotaError) {
          /*
           * 会员已经写进去了，这时不能把订单退回审核中——再审一次会把续费天数加两遍。
           * 原来这里只记日志、照样返回成功：用户升级后带着旧周期用满的额度，一进来就显示用完了。
           * 现在明确告诉管理员去用户管理里「重置额度」
           */
          console.error('[admin/orders/review] 额度重置失败:', quotaError);
          await logAdminAction({ admin_id: admin.userId, action: AdminActions.APPROVE_ORDER, target_type: 'order', target_id: orderId, details: { plan: order.plan_id, quota_reset_failed: quotaError.message } });
          return NextResponse.json(
            { error: `会员已开通，但额度重置失败：请到「用户管理」找到这个用户，点「重置额度」。（${quotaError.message}）`, stage: '重置额度', membershipActivated: true },
            { status: 500 }
          );
        }
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
  } catch (error: unknown) {
    console.error('审核订单错误:', error);
    return NextResponse.json({ error: (error as Error).message || '服务器错误' }, { status: 500 });
  }
}