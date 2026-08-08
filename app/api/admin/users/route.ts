import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: users, error, count } = await supabase
      .from('user_settings')
      .select('user_id, subscription_tier, quota_limit, quota_used, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        users: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: 0,
      });
    }

    const userIds = users.map(u => u.user_id);
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers();
    
    const emailMap = new Map<string, string>();
    authUsersData?.users?.forEach((au: any) => {
      emailMap.set(au.id, au.email || 'Unknown');
    });

    const usersWithEmail = users.map(userSetting => ({
      user_id: userSetting.user_id,
      email: emailMap.get(userSetting.user_id) || 'Unknown',
      membership_level: userSetting.subscription_tier || 'free',
      quota: userSetting.quota_limit || 0,
      quota_used: userSetting.quota_used || 0,
      created_at: userSetting.created_at,
    }));

    return NextResponse.json({
      users: usersWithEmail,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Exception:', error);
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { userId, membership_level, quota } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (membership_level !== undefined) updateData.subscription_tier = membership_level;
    if (quota !== undefined) updateData.quota_limit = quota;

    const { data, error } = await supabase
      .from('user_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('Exception:', error);
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}