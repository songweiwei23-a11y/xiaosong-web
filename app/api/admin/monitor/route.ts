import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { readAllRows, readAllUsers, chinaDayStart } from '@/lib/admin-monitor-data';
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
 * 数据库变更通过管理员 SSE 通知刷新；查询按分页取全，汇总使用精确计数。
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
    const upper = new Date(now).toISOString();
    const since = new Date(Math.min(chinaDayStart(now), now - 24 * 60 * 60 * 1000)).toISOString();

    // 活跃窗口内的元数据分页取全；正文只取最近几十条，累计存档数单独精确计数。
    const [recentGenerations, detailRes, usage, orders, users, profiles, subscriptions, totalRes] = await Promise.all([
      readAllRows<RawGeneration>((from, to) => supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id')
        .gte('created_at', since).lte('created_at', upper)
        .order('created_at', { ascending: false }).order('id').range(from, to)),
      supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id, input_data, result')
        .lte('created_at', upper)
        .order('created_at', { ascending: false })
        .limit(DETAIL_ROWS),
      loadUsage(supabase, since, upper),
      readAllRows<RawOrder>((from, to) => supabase
        .from('payment_orders')
        .select('id, user_id, plan_id, plan_name, amount, status, billing_cycle, created_at, proof_uploaded_at, reviewed_at')
        .lte('created_at', upper).order('created_at', { ascending: false }).order('id').range(from, to)),
      readAllUsers(supabase),
      readAllRows<RawProfile>((from, to) => supabase.from('user_profiles').select('id, user_id, profile_name').order('id').range(from, to)),
      readAllRows<RawSubscription>((from, to) => supabase.from('subscriptions').select('user_id, plan, status, end_date').order('user_id').range(from, to)),
      supabase.from('script_history').select('id', { count: 'exact', head: true }).lte('created_at', upper),
    ]);

    // 主数据拉不到就明确报错，不能拿一片 0 冒充"没人用"
    if (detailRes.error) throw new Error(detailRes.error.message);
    if (totalRes.error || totalRes.count === null) throw new Error(totalRes.error?.message || '生成总数读取失败');

    const detailed = (detailRes.data ?? []) as RawGeneration[];
    const byId = new Map(detailed.map((g) => [String(g.id), g]));
    // 同一条记录有正文就用带正文的那份，最近活跃用户才能说出"最后做了什么"
    const generations = recentGenerations.map((g) => byId.get(String(g.id)) ?? g);

    const workIds = [...new Set(detailed.map((g) => g.work_id).filter((x): x is string => !!x))];
    const workRes = workIds.length ? await supabase.from('works').select('id, title, profile_id').in('id', workIds) : { data: [], error: null };
    if (workRes.error) throw new Error(workRes.error.message);
    const works = (workRes.data ?? []) as RawWork[];

    const dir = buildDirectory({
      users,
      profiles,
      subscriptions,
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
        revenue: effectiveRevenue(orders.filter((o) => isToday(o.reviewed_at || o.created_at, now))),
      },
      totals: {
        users: users.length,
        generations: totalRes.count,
        // 待审订单是唯一需要他立刻动手的东西，单独拎出来
        pendingReview: orders.filter((o) => o.status === 'reviewing').length,
        pendingPay: orders.filter((o) => o.status === 'pending').length,
      },
      pulse: pulseByMinute(generations, now),
      byFeature: featureBreakdown(generations, now),
      // 带正文的只有最近 DETAIL_ROWS 条，事件流也只用这些，免得后面几百条只剩一个功能名
      events: buildEvents({ generations: detailed, usage, users, orders, dir, now }).slice(0, 60),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
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
 * 只兼容 detail 缺列；表、连接或权限错误必须显式报错。
 */
async function loadUsage(supabase: ReturnType<typeof getServiceSupabase>, since: string, upper: string): Promise<RawUsage[]> {
  const rows = await readAllRows<RawUsage>((from, to) => supabase.from('usage_events').select('id, user_id, feature, task_type, created_at').gte('created_at', since).lte('created_at', upper).order('created_at', { ascending: false }).order('id').range(from, to));
  const full = await supabase.from('usage_events').select('id, detail').gte('created_at', since).lte('created_at', upper).order('created_at', { ascending: false }).order('id').limit(DETAIL_ROWS);
  if (full.error) {
    if (!['42703', 'PGRST204'].includes(full.error.code)) throw new Error(full.error.message);
    return rows;
  }
  const details = new Map((full.data ?? []).map((r) => [String(r.id), r.detail]));
  return rows.map((r) => ({ ...r, detail: details.get(String(r.id)) }));
}
