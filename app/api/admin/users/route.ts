import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions, ACTION_LABELS } from '@/lib/admin-logger';
import { generateTempPassword } from '@/lib/password';
import { COUNTED_FEATURES, sumCountedUsage } from '@/lib/config/plans';
import { accountStatus } from '@/lib/account-status';
import { previewUserData, purgeUser } from '@/lib/admin-delete-user';
import { cleanQuery, emailsByIds, searchUsers, UUID_RE } from '@/lib/admin-users';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/*
 * GET 两种用法：
 *   ?page=&pageSize=&search=  用户列表（搜索在数据库里做，total 是搜索后的总数）
 *   ?detail=<用户编号>        单个用户的详情：档案、会员、额度、订单、最近生成、相关操作记录
 * 日志里不打印搜索词：搜索框里可能是别人的邮箱。
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('detail');
    if (detailId) {
      if (!UUID_RE.test(detailId)) return NextResponse.json({ error: '用户编号格式不对' }, { status: 400 });
      return loadUserDetail(detailId);
    }

    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20));
    const query = cleanQuery(searchParams.get('search'));

    const { users: rows, total } = await searchUsers(supabase, query, (page - 1) * pageSize, pageSize);
    const ids = rows.map((r) => r.id);

    const profiles = ids.length ? ((await supabase.from('user_profiles').select('*').in('user_id', ids)).data ?? []) : [];
    const subscriptions = ids.length ? ((await supabase.from('subscriptions').select('*').in('user_id', ids)).data ?? []) : [];
    const quotas = ids.length ? ((await supabase.from('user_quotas').select('*').in('user_id', ids)).data ?? []) : [];

    const users = rows.map((r) => {
      const profile = profiles.find((p) => p.user_id === r.id);
      const subscription = subscriptions.find((s) => s.user_id === r.id);
      const quota = quotas.find((q) => q.user_id === r.id);
      return {
        user_id: r.id,
        email: r.email || '未设置',
        full_name: profile?.profile_name || '未设置',
        avatar_url: profile?.avatar_url || null,
        membership_level: subscription?.plan || 'free',
        subscription_status: accountStatus(r.banned_until, subscription?.status),
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
        total_used: sumCountedUsage(quota),
        period_end: quota?.current_period_end || null,
        created_at: r.created_at,
        last_sign_in_at: r.last_sign_in_at,
        has_profile: !!profile,
        has_subscription: !!subscription,
        has_quota: !!quota,
      };
    });

    return NextResponse.json({ users, total, page, pageSize, search: query });
  } catch (error: any) {
    console.error('[用户管理] 查询失败:', error?.message);
    return NextResponse.json({ error: '读取用户列表失败' }, { status: 500 });
  }
}

async function loadUserDetail(userId: string) {
  try {
    const { data: au, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !au?.user) {
      return NextResponse.json({ error: '没找到这个用户，可能已经删过了' }, { status: 404 });
    }
    const u = au.user;

    const [profileR, subR, quotaR, ordersR, genR, logsByTargetR, logsByDetailR] = await Promise.all([
      supabase.from('user_profiles').select('profile_name, account_platform, updated_at').eq('user_id', userId).maybeSingle(),
      supabase.from('subscriptions').select('plan, status, start_date, end_date').eq('user_id', userId).maybeSingle(),
      supabase.from('user_quotas').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('payment_orders')
        .select('id, plan_name, amount, status, billing_cycle, created_at, reviewed_at, review_note')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('script_history')
        .select('task_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('admin_logs')
        .select('id, admin_id, action, target_type, target_id, details, created_at')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('admin_logs')
        .select('id, admin_id, action, target_type, target_id, details, created_at')
        .contains('details', { targetUserId: userId })
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const seen = new Set<string>();
    const logRows = [...(logsByTargetR.data ?? []), ...(logsByDetailR.data ?? [])]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 10);

    const adminEmails = await emailsByIds(supabase, logRows.map((r) => r.admin_id));

    return NextResponse.json({
      user: {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        status: accountStatus(u.banned_until, subR.data?.status),
      },
      profile: profileR.data ?? null,
      subscription: subR.data ?? null,
      quota: quotaR.data
        ? { used: sumCountedUsage(quotaR.data), periodEnd: quotaR.data.current_period_end ?? null }
        : null,
      orders: ordersR.data ?? [],
      generations: genR.data ?? [],
      logs: logRows.map((r) => {
        const details: Record<string, unknown> = { ...((r.details ?? {}) as Record<string, unknown>) };
        delete details.targetUserId;
        return {
          id: r.id,
          createdAt: r.created_at,
          action: r.action,
          label: ACTION_LABELS[r.action] ?? r.action,
          adminEmail: adminEmails.get(r.admin_id) ?? '（已删除的管理员）',
          details,
        };
      }),
    });
  } catch (error: any) {
    console.error('[用户管理] 详情读取失败:', error?.message);
    return NextResponse.json({ error: '读取用户详情失败' }, { status: 500 });
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

        return NextResponse.json({ success: true, message: '会员等级更新成功' });

      case 'reset_quota': {
        /*
         * 用 upsert 而不是 update：没有配额行的用户会被静默影响 0 行，
         * 接口照样返回「配额重置成功」——封禁那边就是栽在这个写法上。
         * 字段名从 COUNTED_FEATURES 派生，以后加功能不会漏掉一个。
         */
        const reset: Record<string, unknown> = {
          user_id: userId,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        for (const f of COUNTED_FEATURES) reset[f.column] = 0;

        const { data: resetRows, error: resetError } = await supabase
          .from('user_quotas')
          .upsert(reset, { onConflict: 'user_id' })
          .select('user_id');

        if (resetError) {
          console.error('[用户管理] 重置配额失败:', resetError);
          throw resetError;
        }
        if (!resetRows || resetRows.length === 0) {
          return NextResponse.json({ error: '重置失败：没有匹配到这个用户' }, { status: 404 });
        }

        await logAdminAction(admin.userId, AdminActions.RESET_USER_QUOTA, {
          targetUserId: userId
        });

        return NextResponse.json({ success: true, message: '配额重置成功' });
      }

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

      case 'reset_password': {
        /*
         * 替用户重置密码。
         *
         * 系统没有发信服务，用户忘了密码只能找客服；而注册又是邀请制，
         * 在这之前，忘了密码的人**永远进不来**，连重新注册都要再要一个邀请码。
         *
         * 临时密码只在这一次响应里返回给管理员，由他转发给用户。
         * 它**不写进操作日志**——日志是给以后查的，把可用的凭证留在里面，
         * 等于任何能看日志的人都能登进这个账号。日志里只记"重置过"。
         *
         * 身份核实靠人：发临时密码前，先在微信里对一下对方的注册邮箱和
         * 付款记录，别谁来要都给。
         */
        const tempPassword = generateTempPassword();
        const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
          password: tempPassword,
        });
        if (resetError) {
          console.error('[用户管理] 重置密码失败:', resetError.message);
          return NextResponse.json({ error: '重置密码失败：' + resetError.message }, { status: 500 });
        }

        await logAdminAction(admin.userId, AdminActions.RESET_USER_PASSWORD, { targetUserId: userId });

        return NextResponse.json({
          success: true,
          tempPassword,
          message: '已重置。把临时密码发给用户，并提醒他登录后到「我的账户」里改掉',
        });
      }

      /*
       * 删除用户（2026-10-04 产品方：清理垃圾用户）。见 lib/admin-delete-user.ts。
       * delete_preview：删之前看看这个人有多少东西；delete_user：输入对方邮箱确认后，删全部数据和登录账号。
       * 不能删自己、不能删管理员（要删管理员先在权限管理里撤掉）。
       */
      case 'delete_preview':
      case 'delete_user': {
        if (userId === admin.userId) return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
        const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
        if (targetError || !target?.user) return NextResponse.json({ error: '没找到这个用户，可能已经删过了' }, { status: 404 });
        const [{ data: role }, { data: settings }] = await Promise.all([
          supabase.from('admin_roles').select('role').eq('user_id', userId).maybeSingle(),
          supabase.from('user_settings').select('is_admin').eq('user_id', userId).maybeSingle(),
        ]);
        if (role?.role || settings?.is_admin === true) {
          return NextResponse.json({ error: '这是管理员账号，不能直接删除。先到「权限管理」撤掉管理员权限' }, { status: 400 });
        }
        const email = target.user.email || '';
        if (action === 'delete_preview') {
          const counts = await previewUserData(supabase as never, userId);
          const { count: paid } = await supabase.from('payment_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'approved');
          return NextResponse.json({ email, counts, paidOrders: paid ?? 0 });
        }
        const confirmEmail = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
        if (!email || confirmEmail !== email.toLowerCase()) {
          return NextResponse.json({ error: '输入的邮箱和这个用户对不上，没有删除' }, { status: 400 });
        }
        try {
          const result = await purgeUser(supabase as never, userId);
          await logAdminAction(admin.userId, AdminActions.DELETE_USER, {
            targetUserId: userId,
            email,
            deleted: result.deleted,
            files: result.files,
          });
          return NextResponse.json({ success: true, message: `已删除 ${email} 及其全部数据。他要再用，只能拿邀请码重新注册`, ...result });
        } catch (e) {
          console.error('[用户管理] 删除用户失败:', (e as Error).message);
          return NextResponse.json({ error: (e as Error).message || '删除失败，请重试' }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[用户管理] 操作失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
