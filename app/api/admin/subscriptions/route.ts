import { NextResponse } from 'next/server';
import { requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';
import { adminWriteLimited } from '@/lib/admin-rate';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS, COUNTED_FEATURES, getPlan, sumCountedUsage } from '@/lib/config/plans';
import { cleanQuery, scanAllUsers, UUID_RE } from '@/lib/admin-users';
import { extendEndDate } from '@/lib/admin-membership';
import { parseEndDateInput } from '@/lib/admin-dates';
import { readAllRows } from '@/lib/admin-monitor-data';
import { buildMembers, countMembers, filterMembers, type SubRow } from '@/lib/admin-subscription-view';

export const dynamic = 'force-dynamic';

const EXPIRING_SOON_DAYS = 7;

/*
 * 会员列表与操作。
 *
 * GET 参数：plan、status、q（邮箱或用户编号）、expiringDays（只看 N 天内到期的付费会员）、offset、limit。
 * PATCH 动作：
 *   - 不带 action：改套餐和到期日（upsert，没有会员行也能建）
 *   - action=extend  在原到期日上加 days 天（永久会员不延期，要先改成具体日期）
 *   - action=reset_quota  清零本期额度
 */

export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_users');
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const plan = sp.get('plan') || 'all';
  const status = sp.get('status') || 'all';
  const q = cleanQuery(sp.get('q'));
  const expiringDays = Number.parseInt(sp.get('expiringDays') || '', 10);
  const offset = Math.max(0, Number.parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get('limit') || '30', 10) || 30));

  const db = getServiceSupabase();
  const now = Date.now();

  /*
   * 以认证系统的全部用户为准，再和订阅记录合起来看。注册时只给付费用户写订阅记录，
   * 免费用户没有记录，只数订阅表会让免费版人数严重偏少（2026-10-23 发现）。
   * 没有记录的按免费版算，和概览、数据分析的口径一致（见 lib/admin-subscription-view.ts）。
   */
  const [users, subs] = await Promise.all([
    scanAllUsers(db),
    readAllRows<SubRow>((from, to) => db.from('subscriptions').select('*').order('user_id').range(from, to)),
  ]);
  const members = buildMembers(users, subs, now);
  const counts = countMembers(members, subs, now, EXPIRING_SOON_DAYS);
  const listed = filterMembers(members, {
    plan,
    status,
    expiringDays: Number.isFinite(expiringDays) ? expiringDays : 0,
    q,
    now,
  });

  const page = listed.slice(offset, offset + limit);
  const ids = page.map((m) => m.user.id);
  const quotaRows = ids.length ? ((await db.from('user_quotas').select('*').in('user_id', ids)).data ?? []) : [];
  const quotaByUser = new Map(quotaRows.map((row) => [row.user_id as string, row]));

  const items = page.map(({ user, sub }) => {
    const quota = quotaByUser.get(user.id);
    const configured = getPlan(sub?.plan ?? 'free');
    const totalLimit =
      configured.totalQuota ??
      COUNTED_FEATURES.reduce((sum, f) => sum + Math.max(0, configured.quotas[f.key] as number), 0);
    return {
      id: sub?.id ?? null,
      user_id: user.id,
      email: user.email || '（无邮箱）',
      plan: sub?.plan ?? 'free',
      status: sub?.status ?? 'active',
      quota: { used: sumCountedUsage(quota), total: totalLimit },
      startDate: quota?.current_period_start ?? sub?.start_date ?? null,
      endDate: sub?.end_date ?? null,
      created_at: sub?.created_at ?? user.created_at,
      updated_at: sub?.updated_at ?? null,
    };
  });

  return NextResponse.json({ items, total: listed.length, offset, limit, counts });
}

// PATCH - 更新会员信息
export async function PATCH(request: Request) {
  try {
    // 改套餐、到期日、延期、清额度都属于会员管理（见 lib/admin-permissions）
    const admin = await requireAdminPermission('manage_membership');
    if (!admin) {
      return NextResponse.json({ error: '无权修改会员：这项操作需要更高的管理员权限' }, { status: 403 });
    }
    if (adminWriteLimited(admin.userId)) {
      return NextResponse.json({ error: '操作太频繁，请稍后再试' }, { status: 429 });
    }

    const { userId, plan, endDate, action, days } = await request.json();

    if (!userId || !UUID_RE.test(String(userId))) {
      return NextResponse.json({ error: '缺少或不对的用户编号' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

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

      return NextResponse.json({ success: true, message: '额度已重置' });
    }

    // 延长会员天数：在原到期日上加，不改套餐，不动额度
    if (action === 'extend') {
      const { data: sub, error: readError } = await supabase
        .from('subscriptions')
        .select('plan, status, end_date')
        .eq('user_id', userId)
        .maybeSingle();
      if (readError) throw readError;
      if (!sub) {
        return NextResponse.json({ error: '这个用户还不是会员，先到上面改成具体套餐再延期' }, { status: 400 });
      }
      if (sub.plan === 'free') {
        return NextResponse.json({ error: '免费版不需要延期，要开通会员请先改套餐' }, { status: 400 });
      }
      const next = extendEndDate(sub.end_date, Number(days));
      if ('error' in next) return NextResponse.json({ error: next.error }, { status: 400 });

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ end_date: next.endDate, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updateError) throw updateError;

      await logAdminAction({
        admin_id: admin.userId,
        action: AdminActions.EXTEND_MEMBERSHIP,
        target_type: 'subscription',
        target_id: userId,
        details: { days: Number(days), previousEnd: sub.end_date, newEnd: next.endDate },
      });

      return NextResponse.json({ success: true, message: `已延长 ${Number(days)} 天，新的到期日是 ${next.endDate.slice(0, 10)}` });
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

    // 空值表示不改到期日；填了就按北京时间当天 23:59:59 算，格式不对直接拒绝
    if (endDate) {
      const parsed = parseEndDateInput(endDate);
      if (!parsed.ok || !parsed.endIso) {
        return NextResponse.json({ error: '到期日格式不对，请重新选择' }, { status: 400 });
      }
      payload.end_date = parsed.endIso;
    }

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

    return NextResponse.json({ success: true, message: '会员信息已更新' });
  } catch (error: unknown) {
    console.error('更新会员失败:', error);
    return NextResponse.json({ error: '更新会员失败，请重试' }, { status: 500 });
  }
}
