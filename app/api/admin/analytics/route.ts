import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // 计算时间范围
    const now = new Date();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // 1. 用户统计
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: newUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // 2. 活跃用户
    const { data: quotasData } = await supabase
      .from('user_quotas')
      .select('user_id, updated_at')
      .gte('updated_at', startDate.toISOString());

    const activeUsers = quotasData ? new Set(quotasData.map(q => q.user_id)).size : 0;

    // 3. 收入统计（从订单表）
    const { data: paidOrders } = await supabase
      .from('payment_orders')
      .select('amount, created_at')
      .eq('status', 'approved')
      .gte('created_at', startDate.toISOString());

    const totalRevenue = (paidOrders || []).reduce((sum, order) => sum + order.amount, 0);

    // 4. 功能使用统计
    const { data: allQuotas } = await supabase
      .from('user_quotas')
      .select('*');

    const featureUsage = [
      {
        name: '脚本生成',
        key: 'script',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.script_used || 0), 0),
        icon: 'FileText',
      },
      {
        name: '选题策划',
        key: 'topic',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.topic_used || 0), 0),
        icon: 'Lightbulb',
      },
      {
        name: '账号定位',
        key: 'positioning',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.positioning_used || 0), 0),
        icon: 'Target',
      },
      {
        name: '自由对话',
        key: 'freeChat',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.free_chat_used || 0), 0),
        icon: 'MessageCircle',
      },
      {
        name: '分镜脚本',
        key: 'storyboard',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.storyboard_used || 0), 0),
        icon: 'Film',
      },
      {
        name: '审稿优化',
        key: 'review',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.review_used || 0), 0),
        icon: 'CheckCircle',
      },
      {
        name: '标题封面',
        key: 'title',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.title_used || 0), 0),
        icon: 'Tag',
      },
      {
        name: '成交理由',
        key: 'dealReason',
        usage: (allQuotas || []).reduce((sum, q) => sum + (q.deal_reason_used || 0), 0),
        icon: 'DollarSign',
      },
    ].sort((a, b) => b.usage - a.usage);

    // 5. 会员分布
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('status', 'active');

    const planDistribution = {
      free: 0,
      basic: 0,
      pro: 0,
      enterprise: 0,
    };

    (subscriptions || []).forEach((sub: any) => {
      const plan = sub.plan || 'free';
      if (plan in planDistribution) {
        planDistribution[plan as keyof typeof planDistribution]++;
      }
    });

    const paidUsers = Object.values(planDistribution).reduce((a, b) => a + b, 0) - planDistribution.free;
    planDistribution.free = (totalUsers || 0) - paidUsers;

    // 6. 转化率
    const conversionRate = totalUsers ? ((paidUsers / totalUsers) * 100).toFixed(2) : '0';

    // 7. 平均使用次数
    const totalUsage = featureUsage.reduce((sum, f) => sum + f.usage, 0);
    const avgUsagePerUser = totalUsers ? Math.round(totalUsage / totalUsers) : 0;

    return NextResponse.json({
      timeRange,
      stats: {
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        activeUsers,
        totalRevenue,
        paidUsers,
        conversionRate: parseFloat(conversionRate),
        avgUsagePerUser,
      },
      featureUsage,
      planDistribution,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('获取分析数据失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}