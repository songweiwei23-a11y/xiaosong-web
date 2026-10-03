import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseFetch } from '@/lib/supabase/fetch'

const SESSION_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

// 只把明确的会话失效当作退出。验证服务超时/限流/5xx 不表示用户退出。
function isInvalidSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, code, status } = error as { name?: string; code?: string; status?: number }
  return name === 'AuthSessionMissingError' || name === 'AuthInvalidJwtError' ||
    status === 401 || status === 403 || [
      'bad_jwt', 'invalid_jwt', 'no_authorization', 'user_not_found', 'user_banned',
      'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used',
    ].includes(code ?? '')
}

function isTemporaryQueryFailure(result: { error?: unknown; status?: number }): boolean {
  if (!result.error) return false
  if (result.status === 0 || result.status === 408 || result.status === 429 || (result.status ?? 0) >= 500) return true
  const error = result.error as { name?: string; message?: string }
  return /AbortError|TimeoutError|AuthRetryableFetchError/.test(error.name ?? '') ||
    /fetch|network|timeout|timed out|socket|connection/i.test(error.message ?? '')
}

export async function middleware(req: NextRequest) {
  const cookieUpdates: { name: string; value: string; options: CookieOptions }[] = []
  const sessionHeaders: Record<string, string> = { ...SESSION_HEADERS }

  // 正常放行、登录跳转、权限跳转和临时故障都必须带回完整刷新结果。
  const withSession = (response: NextResponse) => {
    cookieUpdates.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    Object.entries(sessionHeaders).forEach(([name, value]) => response.headers.set(name, value))
    return response
  }
  const redirect = (path: string) => withSession(NextResponse.redirect(new URL(path, req.url)))
  const unavailable = () => withSession(new NextResponse('登录服务暂时连接不稳定，请稍后刷新重试。', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '5' },
  }))

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: supabaseFetch },
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => {
              if (value) req.cookies.set(name, value)
              else req.cookies.delete(name)
            })
            cookieUpdates.push(...cookiesToSet)
            Object.assign(sessionHeaders, headers)
          },
        },
      }
    )

    if (req.nextUrl.pathname.startsWith('/admin')) {
      // 管理员每次向认证服务校验当前用户，保留账号停用与撤销检查。
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) return isInvalidSession(error) ? redirect('/login') : unavailable()
      if (!user) return redirect('/login')

      // 保留 admin_roles 优先、兼容 user_settings.is_admin 的权限规则。
      const [roleResult, settingsResult] = await Promise.all([
        supabase.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_settings').select('is_admin').eq('user_id', user.id).maybeSingle(),
      ])
      const isAdmin = !!roleResult.data?.role || settingsResult.data?.is_admin === true
      if (!isAdmin) {
        if (isTemporaryQueryFailure(roleResult) || isTemporaryQueryFailure(settingsResult)) return unavailable()
        return redirect('/dashboard')
      }
    } else {
      // 验证 JWT 签名与有效期，不能信任 getSession() 解出的 Cookie。
      // 非对称密钥可用缓存的 JWKS 本地验证；对称密钥由 SDK 回退到 getUser()。
      // 各数据接口仍独立 getUser() 验证账号状态和原有禁用/额度规则。
      const { data, error } = await supabase.auth.getClaims()
      if (error) return isInvalidSession(error) ? redirect('/login') : unavailable()
      if (!data?.claims.sub) return redirect('/login')
    }

    // 此时 request Cookie 已一次批量更新，页面与浏览器收到同一份完整会话。
    return withSession(NextResponse.next({ request: { headers: req.headers } }))
  } catch (error) {
    return isInvalidSession(error) ? redirect('/login') : unavailable()
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/payment/:path*', '/history/:path*'],
}
