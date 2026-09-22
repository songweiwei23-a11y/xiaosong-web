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

  // 保护 /admin 路径 - 需要登录且是管理员
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    /*
     * 管理员这条路径改用 getUser()。
     *
     * getSession() 只解开 Cookie 里的 JWT 看一眼，不向 Supabase 验签，
     * 伪造一个格式正确的 Cookie 就能骗过它。数据层面并不危险——
     * 每个 /api/admin/* 都走 requireAdmin()，那里用的是会验签的 getUser()，
     * 所以拿不到任何数据——但不该让人打开管理后台的壳子。
     *
     * 代价是一次到 Supabase 的往返。只在 /admin 上付这个代价：
     * 后台是低频路径，而 /dashboard 每次跳转都验一遍会明显变慢，
     * 且那里的数据同样由各接口独立校验。
     */
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // 统一的管理员判定：admin_roles 表（优先）+ 兼容旧的 user_settings.is_admin。
    // 与服务端 requireAdmin() 保持一致，不再使用硬编码邮箱白名单。
    // 两张表并行查询，避免串行往返带来的额外延迟。
    const [roleResult, settingsResult] = await Promise.all([
      supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_settings')
        .select('is_admin')
        .eq('user_id', user.id)
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
