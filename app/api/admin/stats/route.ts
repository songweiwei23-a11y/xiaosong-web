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

    const { count: totalUsers } = await supabase
      .from('user_settings')
      .select('*', { count: 'exact', head: true });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: activeToday } = await supabase
      .from('generation_history')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    const { count: apiCallsToday } = await supabase
      .from('generation_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    const { data: usersData } = await supabase
      .from('user_settings')
      .select('subscription_tier');

    const subscriptionStats = { free: 0, pro: 0, premium: 0, enterprise: 0 };
    usersData?.forEach((u: any) => {
      const tier = u.subscription_tier || 'free';
      if (tier in subscriptionStats) {
        subscriptionStats[tier as keyof typeof subscriptionStats]++;
      }
    });

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeToday: activeToday || 0,
      apiCallsToday: apiCallsToday || 0,
      subscriptionStats,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
