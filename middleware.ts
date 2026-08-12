import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 【安全检查】验证账号状态 - 阻止被封禁/删除用户访问
  if (session?.user) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('account_status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    // 如果账号被封禁或删除，强制登出
    if (userProfile?.account_status === 'banned' || userProfile?.account_status === 'deleted') {
      console.warn(`[Security] Blocked access for ${session.user.id} - status: ${userProfile.account_status}`);
      
      // 清除session
      await supabase.auth.signOut();
      
      // 重定向到登录页并显示错误
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', userProfile.account_status === 'banned' ? 'account_banned' : 'account_deleted');
      loginUrl.searchParams.set('message', userProfile.account_status === 'banned' ? '您的账号已被封禁' : '您的账号已被删除');
      return NextResponse.redirect(loginUrl);
    }
  }

  // 保护 /admin 路径 - 需要登录且是管理员
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // 统一的管理员判定：admin_roles 表（优先）+ 兼容旧的 user_settings.is_admin。
    // 与服务端 requireAdmin() 保持一致，不再使用硬编码邮箱白名单。
    // 两张表并行查询，避免串行往返带来的额外延迟。
    const [roleResult, settingsResult] = await Promise.all([
      supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle(),
      supabase
        .from('user_settings')
        .select('is_admin')
        .eq('user_id', session.user.id)
        .maybeSingle(),
    ])

    const isAdmin = !!roleResult.data?.role || settingsResult.data?.is_admin === true

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // 保护 /dashboard 路径 - 需要登录
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // 保护 /history 路径 - 需要登录
  if (req.nextUrl.pathname.startsWith('/history')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // 保护 /payment 路径 - 需要登录
  if (req.nextUrl.pathname.startsWith('/payment')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/payment/:path*', '/history/:path*'],
}
