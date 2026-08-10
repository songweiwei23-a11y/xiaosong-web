import { NextResponse } from 'next/server';
import { requireAdmin, getServerSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '无管理员权限' }, { status: 403 });
    }

    const supabase = await getServerSupabase();

    // 1. 获取总用户数
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 2. 获取活跃用户数（最近7天有使用记录）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsersData } = await supabase
      .from('user_quotas')
      .select('user_id')
      .gte('updated_at', sevenDaysAgo.toISOString());

    const activeToday = activeUsersData ? new Set(activeUsersData.map(u => u.user_id)).size : 0;

    // 3. 获取会员分布
    const { data: subscriptionsData } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('status', 'active');

    const subscriptionStats = {
      free: 0,
      basic: 0,
      pro: 0,
      enterprise: 0,
    };

    // 统计各套餐人数
    if (subscriptionsData) {
      subscriptionsData.forEach((sub: any) => {
        const plan = sub.plan || 'free';
        if (plan in subscriptionStats) {
          subscriptionStats[plan as keyof typeof subscriptionStats]++;
        }
      });
    }

    // 免费用户 = 总用户 - 付费用户
    const paidUsers = Object.values(subscriptionStats).reduce((a, b) => a + b, 0) - subscriptionStats.free;
    subscriptionStats.free = (totalUsers || 0) - paidUsers;

    // 4. 获取API调用次数（从user_quotas统计）
    const { data: quotasData } = await supabase
      .from('user_quotas')
      .select('*');

    let apiCallsToday = 0;
    if (quotasData) {
      quotasData.forEach((quota: any) => {
        apiCallsToday += (quota.script_used || 0) +
          (quota.topic_used || 0) +
          (quota.positioning_used || 0) +
          (quota.free_chat_used || 0) +
          (quota.storyboard_used || 0) +
          (quota.review_used || 0) +
          (quota.title_used || 0) +
          (quota.deal_reason_used || 0);
      });
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeToday,
      apiCallsToday,
      subscriptionStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}