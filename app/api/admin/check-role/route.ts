import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('=== Admin check-role API called ===');
    
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
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('User:', user?.email, user?.id);
    console.log('Auth error:', authError?.message);
    
    if (authError || !user) {
      console.log('No valid user');
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    console.log('Querying admin_roles for user:', user.id);
    const { data: adminData, error: roleError } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Admin data:', adminData);
    console.log('Role error:', roleError?.message);

    if (roleError) {
      console.error('Role query failed:', roleError);
      return NextResponse.json({ error: 'Query failed', details: roleError.message }, { status: 500 });
    }

    if (!adminData) {
      console.log('No admin role found');
      return NextResponse.json({ error: 'No admin permission' }, { status: 403 });
    }

    console.log('✅ Success! Role:', adminData.role);
    return NextResponse.json({
      role: adminData.role,
      email: user.email,
      userId: user.id
    });
  } catch (error) {
    console.error('💥 Exception:', error);
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}