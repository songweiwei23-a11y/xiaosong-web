import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { countAuthUsers, sumFeatureUsage, buildPlanDistribution } from '@/lib/admin-stats';
import { effectivePlanId } from '@/lib/config/plans';
import { readAllRows } from '@/lib/admin-monitor-data';

export const dynamic = 'force-dynamic';

/**
 * 管理概览的数字。
 *
 * 改造前这里有三个错叠在一起，让首页的数字完全没有参考价值：
 *   1. 查 `profiles` 表统计用户数——数据库里没这张表，totalUsers 恒为 0；
 *   2. 于是「免费用户 = 总用户 - 付费用户」算出负数，页面上写着「免费用户 -1」；
 *   3. 用 getServerSupabase()（带管理员 cookie、走 anon key、受 RLS 约束），
 *      就算表名改对，跨用户的统计也只能看到管理员自己那一行。
 *
 * 现在：身份用 requireAdmin() 验过之后，统计一律走 service_role；
 * 算法与 /api/admin/analytics 共用 lib/admin-stats，不再各写一份。
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    const totalUsers = await countAuthUsers(supabase);

    // 近 7 天有过用量变动的算活跃
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // 全部用分页读取：PostgREST 默认每次最多 1000 行，用户过千后不分页会悄悄少算（2026-10-10 巡检 M5）
    const activeRows = await readAllRows<{ user_id: string }>((from, to) =>
      supabase
        .from('user_quotas')
        .select('user_id')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('user_id')
        .range(from, to)
    );
    const activeToday = new Set(activeRows.map((u) => u.user_id)).size;

    /*
     * 按"此刻实际享有的套餐"统计。原来只看 status = active，
     * 到期日过了的订阅照样算付费会员——概览上的付费人数会虚高，
     * 和服务端实际放行的口径对不上。
     */
    const subs = await readAllRows<{ plan: string | null; status: string | null; end_date: string | null }>((from, to) =>
      supabase
        .from('subscriptions')
        .select('plan, status, end_date')
        .eq('status', 'active')
        .order('user_id')
        .range(from, to)
    );
    const effective = subs.map((s) => ({ plan: effectivePlanId(s), status: 'active' }));
    const { distribution } = buildPlanDistribution(effective, totalUsers);

    const quotas = await readAllRows<Record<string, unknown>>((from, to) =>
      supabase.from('user_quotas').select('*').order('user_id').range(from, to)
    );
    const totalGenerations = sumFeatureUsage(quotas).reduce((sum, f) => sum + f.usage, 0);

    return NextResponse.json({
      totalUsers,
      activeToday,
      totalGenerations,
      subscriptionStats: distribution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin/stats] 失败:', error);
    return NextResponse.json({ error: '统计数据读取失败' }, { status: 500 });
  }
}
