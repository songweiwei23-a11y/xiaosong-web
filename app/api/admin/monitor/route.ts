import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import {
  buildEvents,
  onlineUsers,
  featureBreakdown,
  pulseByMinute,
  isToday,
  effectiveRevenue,
  type RawGeneration,
  type RawOrder,
  type RawUser,
} from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/**
 * 监控大屏的数据源。
 *
 * 【为什么是轮询不是 Realtime】Supabase Realtime 要先把这几张表加进
 * publication，多一个得手动做的配置步骤；而且连接断了是静默失灵——
 * 大屏看着一切正常，其实早就不更新了。这个站现在总共十个用户，
 * 每 5 秒查一次的代价可以忽略，而「拉不到就明确报错」比「悄悄不动」强得多。
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
    // 又不至于把整张表拉下来
    const [genRes, orderRes, usersRes] = await Promise.all([
      supabase
        .from('script_history')
        .select('id, task_type, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('payment_orders')
        .select('id, plan_id, plan_name, amount, status, created_at, proof_uploaded_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const generations = (genRes.data ?? []) as RawGeneration[];
    const orders = (orderRes.data ?? []) as RawOrder[];
    const users = (usersRes.data?.users ?? []) as RawUser[];

    const todayGen = generations.filter((g) => isToday(g.created_at, now));
    const todayUsers = users.filter((u) => isToday(u.created_at, now));
    const todayOrders = orders.filter((o) => isToday(o.created_at, now));

    return NextResponse.json({
      now: new Date(now).toISOString(),
      online: onlineUsers(users, now),
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
      events: buildEvents({ generations, users, orders, now }).slice(0, 60),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/monitor] 取数失败:', msg);
    // 明确报错，不返回空壳——大屏必须能看出"现在是拉不到数据"，
    // 而不是显示一片 0 让人以为真的没人用
    return NextResponse.json({ error: '监控数据读取失败：' + msg }, { status: 500 });
  }
}
