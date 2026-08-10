import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

// GET - 获取用户列表
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';

    console.log(`[用户管理] 查询参数: page=${page}, pageSize=${pageSize}, search=${search}`);

    // 从 auth.users 获取所有用户
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: page,
      perPage: pageSize
    });

    if (authError) {
      console.error('[用户管理] 获取auth用户失败:', authError);
      throw authError;
    }

    const authUsers = authData?.users || [];
    console.log(`[用户管理] 获取到 ${authUsers.length} 个auth用户`);

    // 获取所有用户ID
    const userIds = authUsers.map(u => u.id);

    // 批量获取 profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', userIds);

    // 批量获取 subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .in('user_id', userIds);

    // 批量获取 quotas
    const { data: quotas } = await supabase
      .from('user_quotas')
      .select('*')
      .in('user_id', userIds);

    console.log(`[用户管理] profiles: ${profiles?.length || 0}, subscriptions: ${subscriptions?.length || 0}, quotas: ${quotas?.length || 0}`);

    // 合并数据
    const users = authUsers.map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id);
      const subscription = subscriptions?.find(s => s.user_id === authUser.id);
      const quota = quotas?.find(q => q.user_id === authUser.id);

      // 计算总使用量
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

      return {
        user_id: authUser.id,
        email: authUser.email || '未设置',
        full_name: profile?.profile_name || '未设置',
        avatar_url: profile?.avatar_url || null,
        membership_level: subscription?.plan || 'free',
        subscription_status: subscription?.status || 'inactive',
        subscription_end: subscription?.end_date || null,
        quota_details: {
          script: { used: quota?.script_used || 0 },
          topic: { used: quota?.topic_used || 0 },
          positioning: { used: quota?.positioning_used || 0 },
          freeChat: { used: quota?.free_chat_used || 0 },
          storyboard: { used: quota?.storyboard_used || 0 },
          review: { used: quota?.review_used || 0 },
          title: { used: quota?.title_used || 0 },
          dealReason: { used: quota?.deal_reason_used || 0 },
        },
        total_used: totalUsed,
        period_end: quota?.current_period_end || null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        has_profile: !!profile,
        has_subscription: !!subscription,
        has_quota: !!quota
      };
    });

    console.log(`[用户管理] 返回 ${users.length} 个用户，总数: ${authData.total || users.length}`);

    return NextResponse.json({
      users,
      total: authData.total || users.length,
      page,
      pageSize
    });

  } catch (error: any) {
    console.error('[用户管理] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - 更新用户会员等级和配额
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, plan, endDate } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    console.log(`[用户管理] 执行操作: ${action}, 用户: ${userId}`);

    switch (action) {
      case 'update_membership':
        // 更新会员等级
        if (!plan) {
          return NextResponse.json({ error: '缺少会员套餐参数' }, { status: 400 });
        }

        // 更新或创建subscription
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan: plan,
            status: 'active',
            end_date: endDate || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (subError) {
          console.error('[用户管理] 更新会员失败:', subError);
          throw subError;
        }

        // 记录管理员操作
        await logAdminAction(admin.userId, AdminActions.UPDATE_USER_MEMBERSHIP, {
          targetUserId: userId,
          plan,
          endDate
        });

        console.log(`[用户管理] 会员更新成功: ${userId} -> ${plan}`);
        return NextResponse.json({ success: true, message: '会员等级更新成功' });

      case 'reset_quota':
        // 重置配额
        const { error: resetError } = await supabase
          .from('user_quotas')
          .update({
            script_used: 0,
            topic_used: 0,
            positioning_used: 0,
            free_chat_used: 0,
            storyboard_used: 0,
            review_used: 0,
            title_used: 0,
            deal_reason_used: 0,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (resetError) {
          console.error('[用户管理] 重置配额失败:', resetError);
          throw resetError;
        }

        await logAdminAction(admin.userId, AdminActions.RESET_USER_QUOTA, {
          targetUserId: userId
        });

        console.log(`[用户管理] 配额重置成功: ${userId}`);
        return NextResponse.json({ success: true, message: '配额重置成功' });

      case 'ban_user':
        // 封禁用户（设置为inactive）
        const { error: banError } = await supabase
          .from('subscriptions')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (banError) {
          console.error('[用户管理] 封禁用户失败:', banError);
          throw banError;
        }

        await logAdminAction(admin.userId, AdminActions.BAN_USER, {
          targetUserId: userId
        });

        console.log(`[用户管理] 用户封禁成功: ${userId}`);
        return NextResponse.json({ success: true, message: '用户已封禁' });

      case 'unban_user':
        // 解封用户
        const { error: unbanError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (unbanError) {
          console.error('[用户管理] 解封用户失败:', unbanError);
          throw unbanError;
        }

        await logAdminAction(admin.userId, AdminActions.UNBAN_USER, {
          targetUserId: userId
        });

        console.log(`[用户管理] 用户解封成功: ${userId}`);
        return NextResponse.json({ success: true, message: '用户已解封' });

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[用户管理] 操作失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - 更新单个用户的配额（兼容旧代码）
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, quota } = body;

    if (!userId || quota === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_quotas')
      .update({ 
        max_quota: quota, 
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', userId);

    if (error) throw error;

    await logAdminAction(admin.userId, AdminActions.UPDATE_USER_QUOTA, {
      targetUserId: userId,
      quota
    });

    return NextResponse.json({ success: true, message: '配额更新成功' });

  } catch (error: any) {
    console.error('[用户管理] 更新配额失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
