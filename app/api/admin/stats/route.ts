import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { countAuthUsers, sumFeatureUsage, buildPlanDistribution } from '@/lib/admin-stats';

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
    const { data: activeRows } = await supabase
      .from('user_quotas')
      .select('user_id')
      .gte('updated_at', sevenDaysAgo.toISOString());
    const activeToday = activeRows ? new Set(activeRows.map((u) => u.user_id)).size : 0;

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('status', 'active');
    const { distribution } = buildPlanDistribution(subs, totalUsers);

    const { data: quotas } = await supabase.from('user_quotas').select('*');
    const totalGenerations = sumFeatureUsage(quotas).reduce((sum, f) => sum + f.usage, 0);

    return NextResponse.json({
      totalUsers,
      activeToday,
      // 字段名沿用 apiCallsToday，管理概览页还在读它；语义是「累计生成次数」
      apiCallsToday: totalGenerations,
      totalGenerations,
      subscriptionStats: distribution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin/stats] 失败:', error);
    return NextResponse.json({ error: '统计数据读取失败' }, { status: 500 });
  }
}
