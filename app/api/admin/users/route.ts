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

      case 'ban_user': {
        /*
         * 封禁此前只做一件事：把 subscriptions.status 改成 inactive。
         * 有两个问题，合起来让这个按钮基本是摆设：
         *
         * 1. 用的是 .update()。十个用户里有七个根本没有 subscriptions 行，
         *    更新影响 0 行，接口照样返回「用户已封禁」——点了等于没点，
         *    而且管理员完全看不出来。
         * 2. 就算有那行，它只挡得住走 requireUserWithQuota 的三个生成接口。
         *    被封的人照样能登录、能读自己的全部作品和历史，
         *    /api/works、/api/script-history、/api/profiles 都不查封禁状态。
         *
         * 现在改成在认证层封：Supabase 的 ban_duration 会让这个账号
         * 无法登录、无法续期令牌，getUser() 直接失败——所有接口一并挡住，
         * 不需要每个路由各加一次判断。
         */
        const { error: authBanError } = await supabase.auth.admin.updateUserById(userId, {
          // 100 年，等同于永久。Supabase 没有「无限期」的写法
          ban_duration: '876000h',
        });

        if (authBanError) {
          console.error('[用户管理] 封禁失败:', authBanError);
          return NextResponse.json(
            { error: '封禁失败：' + authBanError.message },
            { status: 500 }
          );
        }

        // 订阅状态一并置为 inactive，作为第二道判断（额度守卫会读它）。
        // 必须用 upsert：没有订阅行的用户用 update 会静默影响 0 行
        const { error: banSubError } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'free',
            status: 'inactive',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (banSubError) console.error('[用户管理] 订阅状态置 inactive 失败:', banSubError);

        await logAdminAction(admin.userId, AdminActions.BAN_USER, { targetUserId: userId });

        return NextResponse.json({
          success: true,
          // 已签发的访问令牌要等它自己过期（通常一小时内），
          // 这一点要如实告诉管理员，否则他会以为封禁没生效
          message: '用户已封禁，无法再登录（已登录的会话最多一小时内失效）',
        });
      }

      case 'unban_user': {
        // 先解认证层的封禁，这一步失败就别往下走——
        // 订阅状态改回 active 却仍然登不进来，只会更让人困惑
        const { error: authUnbanError } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        if (authUnbanError) {
          console.error('[用户管理] 解封失败:', authUnbanError);
          return NextResponse.json(
            { error: '解封失败：' + authUnbanError.message },
            { status: 500 }
          );
        }

        // 同样用 upsert：没有订阅行的用户用 update 会静默影响 0 行
        const { error: unbanSubError } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'free',
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (unbanSubError) console.error('[用户管理] 订阅状态置 active 失败:', unbanSubError);

        await logAdminAction(admin.userId, AdminActions.UNBAN_USER, { targetUserId: userId });

        return NextResponse.json({ success: true, message: '用户已解封，可以重新登录' });
      }

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
