import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS, COUNTED_FEATURES } from '@/lib/config/plans';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

// GET - 获取会员列表
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const plan = searchParams.get('plan'); // 筛选套餐
    const status = searchParams.get('status'); // 筛选状态

    // 构建查询
    let query = supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (plan && plan !== 'all') {
      query = query.eq('plan', plan);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;

    // 获取用户信息和额度
    const subscriptionsWithDetails = await Promise.all(
      (subscriptions || []).map(async (sub) => {
        // 获取用户信息
        const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id);

        // 获取额度使用情况
        const { data: quota } = await supabase
          .from('user_quotas')
          .select('*')
          .eq('user_id', sub.user_id)
          .single();

        const totalUsed = quota ? (
          (quota.script_used || 0) +
          (quota.topic_used || 0) +
          (quota.positioning_used || 0) +
          (quota.free_chat_used || 0) +
          (quota.storyboard_used || 0) +
          (quota.review_used || 0) +
          (quota.title_used || 0) +
          (quota.deal_reason_used || 0)
        ) : 0;

        // 获取套餐限额
        const quotaLimits: Record<string, number> = {
          free: 50,
          basic: 150,
          pro: 500,
          enterprise: -1, // 无限
        };

        const totalLimit = quotaLimits[sub.plan] || 0;

        return {
          id: sub.id,
          user_id: sub.user_id,
          email: user?.email || '未知',
          plan: sub.plan,
          status: sub.status,
          quota: {
            used: totalUsed,
            total: totalLimit,
          },
          startDate: sub.current_period_start,
          endDate: sub.current_period_end,
          created_at: sub.created_at,
          updated_at: sub.updated_at,
        };
      })
    );

    return NextResponse.json({
      subscriptions: subscriptionsWithDetails,
      total: subscriptionsWithDetails.length,
    });
  } catch (error: any) {
    console.error('获取会员列表失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - 更新会员信息
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { userId, plan, endDate, action } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    // 重置额度
    if (action === 'reset_quota') {
      /*
       * 必须 upsert。用 .update() 时，没有配额行的用户会被静默影响 0 行，
       * 接口照样返回「额度已重置」——管理员点了等于没点，且看不出来。
       * 封禁那边就是栽在这上面：十个用户里七个没有订阅行。
       *
       * 各功能的列名从 COUNTED_FEATURES 取，不再手写八个字段名，
       * 以后加功能不会漏掉一个。
       */
      const reset: Record<string, unknown> = {
        user_id: userId,
        knowledge_used: 0,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      for (const f of COUNTED_FEATURES) reset[f.column] = 0;

      const { data: resetRows, error } = await supabase
        .from('user_quotas')
        .upsert(reset, { onConflict: 'user_id' })
        .select('user_id');

      if (error) throw error;
      if (!resetRows || resetRows.length === 0) {
        return NextResponse.json({ error: '重置失败：没有匹配到这个用户' }, { status: 404 });
      }

      await logAdminAction({
        admin_id: admin.userId,
        action: AdminActions.RESET_SUBSCRIPTION_QUOTA,
        target_type: 'subscription',
        target_id: userId,
        details: {},
      });

      return NextResponse.json({
        success: true,
        message: '额度已重置',
      });
    }

    /*
     * 更新套餐或到期时间。
     *
     * 两处修正：
     * 1. 到期时间写的是 current_period_end，而 subscriptions 表上根本没有
     *    这一列（是 end_date）。设到期时间会直接报列不存在，
     *    也就是说这个功能从来没成功过。订单审核那边犯过同一个错。
     * 2. 改用 upsert。.update() 对没有订阅行的用户影响 0 行却返回成功——
     *    而十个用户里有七个没有这一行，等于改套餐对他们完全无效。
     */
    const payload: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (plan) {
      if (!(plan in SUBSCRIPTION_PLANS)) {
        return NextResponse.json({ error: `不认识的套餐：${plan}` }, { status: 400 });
      }
      payload.plan = plan;
      // 新建行时必须给 status，否则默认值可能让这个订阅不生效
      payload.status = 'active';
    }

    if (endDate) payload.end_date = new Date(endDate).toISOString();

    const { data: subRows, error } = await supabase
      .from('subscriptions')
      .upsert(payload, { onConflict: 'user_id' })
      .select('user_id');

    if (error) throw error;
    if (!subRows || subRows.length === 0) {
      return NextResponse.json({ error: '更新失败：没有匹配到这个用户' }, { status: 404 });
    }

    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.CHANGE_USER_PLAN,
      target_type: 'subscription',
      target_id: userId,
      details: { plan, endDate },
    });

    return NextResponse.json({
      success: true,
      message: '会员信息已更新',
    });
  } catch (error: any) {
    console.error('更新会员失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}