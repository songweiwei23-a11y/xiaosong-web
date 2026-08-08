import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminData } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminData) {
      return NextResponse.json({ error: 'No admin permission' }, { status: 403 });
    }

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

    const subscriptionStats = {
      free: 0,
      pro: 0,
      premium: 0,
      enterprise: 0,
    };

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
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}