import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import {
  buildEvents,
  buildDirectory,
  activeUsers,
  featureBreakdown,
  pulseByMinute,
  isToday,
  effectiveRevenue,
  ONLINE_WINDOW_MIN,
  type RawGeneration,
  type RawOrder,
  type RawUser,
  type RawUsage,
  type RawProfile,
  type RawSubscription,
  type RawWork,
} from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/** 事件流里带输入和结果的记录条数。只取这么多是因为 result 一条就有几千字 */
const DETAIL_ROWS = 40;

/**
 * 监控大屏的数据源。
 *
 * 【为什么是轮询不是 Realtime】Supabase Realtime 要先把这几张表加进
 * publication，多一个得手动做的配置步骤；而且连接断了是静默失灵——
 * 大屏看着一切正常，其实早就不更新了。这个站现在总共十个用户，
 * 每 5 秒查一次的代价可以忽略，而「拉不到就明确报错」比「悄悄不动」强得多。
 *
 * 【不打码】返回完整邮箱、档案名、输入内容和结果开头——管理员要知道
 * 具体是谁、在做什么内容，才能判断产品往哪走。接口本身只对管理员开放。
 *
 * 所有算法都在 lib/monitor.ts 里，这里只负责取数。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    const now = Date.now();

    // 最近的生成记录。取 500 条足够覆盖「今天」和「最近一小时」两个口径，
    // 又不至于把整张表拉下来；带正文的只取最近几十条，给事件流用
    const [genRes, detailRes, usage, orderRes, usersRes, profileRes, subRes] = await Promise.all([
      supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id, input_data, result')
        .order('created_at', { ascending: false })
        .limit(DETAIL_ROWS),
      loadUsage(supabase),
      supabase
        .from('payment_orders')
        .select('id, user_id, plan_id, plan_name, amount, status, billing_cycle, created_at, proof_uploaded_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from('user_profiles').select('id, user_id, profile_name'),
      supabase.from('subscriptions').select('user_id, plan, status, end_date'),
    ]);

    // 主数据拉不到就明确报错，不能拿一片 0 冒充"没人用"
    if (genRes.error) throw new Error(genRes.error.message);

    const detailed = (detailRes.data ?? []) as RawGeneration[];
    const byId = new Map(detailed.map((g) => [String(g.id), g]));
    // 同一条记录有正文就用带正文的那份，最近活跃用户才能说出"最后做了什么"
    const generations = ((genRes.data ?? []) as RawGeneration[]).map((g) => byId.get(String(g.id)) ?? g);
    const orders = (orderRes.data ?? []) as RawOrder[];
    const users = (usersRes.data?.users ?? []) as RawUser[];

    const workIds = [...new Set(detailed.map((g) => g.work_id).filter((x): x is string => !!x))];
    const works = workIds.length
      ? (((await supabase.from('works').select('id, title, profile_id').in('id', workIds)).data ?? []) as RawWork[])
      : [];

    const dir = buildDirectory({
      users,
      profiles: (profileRes.data ?? []) as RawProfile[],
      subscriptions: (subRes.data ?? []) as RawSubscription[],
      works,
    });

    const todayGen = generations.filter((g) => isToday(g.created_at, now));
    const todayUsers = users.filter((u) => isToday(u.created_at, now));
    const todayOrders = orders.filter((o) => isToday(o.created_at, now));
    const active = activeUsers({ users, generations, usage, dir, now });

    return NextResponse.json({
      now: new Date(now).toISOString(),
      active,
      onlineCount: active.filter((u) => u.minutesAgo <= ONLINE_WINDOW_MIN).length,
      today: {
        generations: todayGen.length,
        newUsers: todayUsers.length,
        orders: todayOrders.length,
        revenue: effectiveRevenue(todayOrders),
      },
      totals: {
        users: users.length,
        generations: generations.length,
        // 待审订单是唯一需要他立刻动手的东西，单独拎出来
        pendingReview: orders.filter((o) => o.status === 'reviewing').length,
        pendingPay: orders.filter((o) => o.status === 'pending').length,
      },
      pulse: pulseByMinute(generations, now),
      byFeature: featureBreakdown(generations, now),
      // 带正文的只有最近 DETAIL_ROWS 条，事件流也只用这些，免得后面几百条只剩一个功能名
      events: buildEvents({ generations: detailed, usage, users, orders, dir, now }).slice(0, 60),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/monitor] 取数失败:', msg);
    // 明确报错，不返回空壳——大屏必须能看出"现在是拉不到数据"，
    // 而不是显示一片 0 让人以为真的没人用
    return NextResponse.json({ error: '监控数据读取失败：' + msg }, { status: 500 });
  }
}

/**
 * 使用记录。detail 列是后加的（自由对话的提问和回答），
 * 迁移还没跑时退回不带它的查询——不能因为少一列整块大屏报错。
 * 表本身不存在就当没有，活跃用户会退回按生成记录算。
 */
async function loadUsage(supabase: ReturnType<typeof getServiceSupabase>): Promise<RawUsage[]> {
  const q = (cols: string) =>
    supabase.from('usage_events').select(cols).order('created_at', { ascending: false }).limit(500);
  const full = await q('id, user_id, feature, task_type, created_at, detail');
  if (!full.error) return (full.data ?? []) as unknown as RawUsage[];
  const lite = await q('id, user_id, feature, task_type, created_at');
  if (lite.error) console.error('[admin/monitor] 使用记录读取失败:', lite.error.message);
  return (lite.data ?? []) as unknown as RawUsage[];
}
