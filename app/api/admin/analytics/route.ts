import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import {
  countAuthUsers,
  countNewUsers,
  sumFeatureUsage,
  buildPlanDistribution,
} from '@/lib/admin-stats';
import { readAllRows } from '@/lib/admin-monitor-data';

export const dynamic = 'force-dynamic';

/**
 * 数据分析页的数据源。
 *
 * 与 /api/admin/stats 犯过同一批错（查不存在的 profiles 表、免费用户算成负数、
 * 八个功能手写字段名），现在共用 lib/admin-stats。
 *
 * 营收来自 payment_orders。这张表改造前并不存在，所以这里的收入恒为 0；
 * 表建好之后（supabase/migrations/20260922_payment.sql）才有真实数字。
 * 表还没建时不报错、按 0 处理——后台其余部分不该被一张表拖垮。
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const totalUsers = await countAuthUsers(supabase);
    const newUsers = await countNewUsers(supabase, startDate);

    // 全部分页读取，PostgREST 默认每次最多 1000 行（2026-10-10 巡检 M5）
    const activeRows = await readAllRows<{ user_id: string }>((from, to) =>
      supabase
        .from('user_quotas')
        .select('user_id')
        .gte('updated_at', startDate.toISOString())
        .order('user_id')
        .range(from, to)
    );
    const activeUsers = new Set(activeRows.map((q) => q.user_id)).size;

    /*
     * 营收统一按「审核通过的时间」（reviewed_at）统计，和管理概览「今日付费」用同一个口径（巡检 M6）。
     * 表不存在时按 0 处理而不是整个接口 500。
     */
    let totalRevenue = 0;
    let paidOrderCount = 0;
    try {
      const paidOrders = await readAllRows<{ amount: number | string | null }>((from, to) =>
        supabase
          .from('payment_orders')
          .select('amount')
          .eq('status', 'approved')
          .gte('reviewed_at', startDate.toISOString())
          .order('id')
          .range(from, to)
      );
      paidOrderCount = paidOrders.length;
      totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    } catch (orderError) {
      console.warn('[admin/analytics] 订单表不可用，营收按 0 计:', (orderError as Error).message);
    }

    const allQuotas = await readAllRows<Record<string, unknown>>((from, to) =>
      supabase.from('user_quotas').select('*').order('user_id').range(from, to)
    );
    const featureUsage = sumFeatureUsage(allQuotas);

    const subs = await readAllRows<{ plan: string | null; status: string | null }>((from, to) =>
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('status', 'active')
        .order('user_id')
        .range(from, to)
    );
    const { distribution, paidUsers } = buildPlanDistribution(subs, totalUsers);

    const totalUsage = featureUsage.reduce((sum, f) => sum + f.usage, 0);

    return NextResponse.json({
      timeRange,
      stats: {
        totalUsers,
        newUsers,
        activeUsers,
        totalRevenue,
        paidOrderCount,
        paidUsers,
        conversionRate: totalUsers ? Number(((paidUsers / totalUsers) * 100).toFixed(2)) : 0,
        avgUsagePerUser: totalUsers ? Math.round(totalUsage / totalUsers) : 0,
      },
      featureUsage,
      planDistribution: distribution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin/analytics] 失败:', error);
    return NextResponse.json({ error: '分析数据读取失败' }, { status: 500 });
  }
}
