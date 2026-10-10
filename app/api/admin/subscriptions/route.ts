import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { SUBSCRIPTION_PLANS, COUNTED_FEATURES, getPlan, sumCountedUsage } from '@/lib/config/plans';
import { cleanQuery, emailsByIds, searchUsers, UUID_RE } from '@/lib/admin-users';
import { extendEndDate } from '@/lib/admin-membership';

export const dynamic = 'force-dynamic';

const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS);
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

function emptyPage(offset: number, limit: number, counts: Record<string, number>) {
  return { items: [], total: 0, offset, limit, counts };
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const plan = sp.get('plan') || 'all';
  const status = sp.get('status') || 'all';
  const q = cleanQuery(sp.get('q'));
  const expiringDays = Number.parseInt(sp.get('expiringDays') || '', 10);
  const offset = Math.max(0, Number.parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get('limit') || '30', 10) || 30));

  const db = getServiceSupabase();

  let userIds: string[] | null = null;
  if (q) {
    userIds = UUID_RE.test(q) ? [q] : (await searchUsers(db, q, 0, 200)).users.map((u) => u.id);
  }

  const counts = await countPlans(db);

  if (userIds && userIds.length === 0) {
    return NextResponse.json(emptyPage(offset, limit, counts));
  }

  const build = () => {
    let query = db.from('subscriptions').select('*', { count: 'exact' });
    if (plan !== 'all' && PLAN_IDS.includes(plan)) query = query.eq('plan', plan);
    if (status !== 'all') query = query.eq('status', status);
    if (userIds) query = query.in('user_id', userIds);
    if (Number.isFinite(expiringDays) && expiringDays > 0) {
      query = query
        .neq('plan', 'free')
        .gte('end_date', new Date().toISOString())
        .lte('end_date', new Date(Date.now() + expiringDays * 86400_000).toISOString());
    }
    return query;
  };

  const { data: subs, error, count } = await build()
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[admin/subscriptions] 查询失败:', error.message);
    return NextResponse.json({ error: '读取会员列表失败' }, { status: 500 });
  }

  const list = subs ?? [];
  const ids = list.map((s) => s.user_id);
  const emails = await emailsByIds(db, ids);
  const quotas = ids.length ? ((await db.from('user_quotas').select('*').in('user_id', ids)).data ?? []) : [];

  const items = list.map((sub) => {
    const quota = quotas.find((x) => x.user_id === sub.user_id);
    const configured = getPlan(sub.plan);
    const totalLimit =
      configured.totalQuota ??
      COUNTED_FEATURES.reduce((sum, f) => sum + Math.max(0, configured.quotas[f.key] as number), 0);
    return {
      id: sub.id,
      user_id: sub.user_id,
      email: emails.get(sub.user_id) || '（用户已注销）',
      plan: sub.plan,
      status: sub.status,
      quota: { used: sumCountedUsage(quota), total: totalLimit },
      startDate: quota?.current_period_start ?? sub.start_date,
      endDate: sub.end_date,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
    };
  });

  return NextResponse.json({ items, total: count ?? items.length, offset, limit, counts });
}

/** 顶部统计：全部会员按套餐的数量，以及 7 天内到期的付费会员数 */
async function countPlans(db: ReturnType<typeof getServiceSupabase>): Promise<Record<string, number>> {
  const countOf = async (apply: (q: any) => any) => {
    const { count } = await apply(db.from('subscriptions').select('id', { count: 'exact', head: true }));
    return count ?? 0;
  };
  const [all, ...perPlan] = await Promise.all([
    countOf((q) => q),
    ...PLAN_IDS.map((p) => countOf((q) => q.eq('plan', p))),
  ]);
  const expiringSoon = await countOf((q) =>
    q
      .neq('plan', 'free')
      .gte('end_date', new Date().toISOString())
      .lte('end_date', new Date(Date.now() + EXPIRING_SOON_DAYS * 86400_000).toISOString())
  );
  const out: Record<string, number> = { all, expiringSoon };
  PLAN_IDS.forEach((p, i) => (out[p] = perPlan[i]));
  return out;
}

// PATCH - 更新会员信息
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
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

    return NextResponse.json({ success: true, message: '会员信息已更新' });
  } catch (error: any) {
    console.error('更新会员失败:', error);
    return NextResponse.json({ error: '更新会员失败，请重试' }, { status: 500 });
  }
}
