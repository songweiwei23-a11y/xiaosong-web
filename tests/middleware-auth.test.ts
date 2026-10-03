import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, type NextResponse } from 'next/server'

const mock = vi.hoisted(() => {
  const getClaims = vi.fn()
  const getUser = vi.fn()
  const getSession = vi.fn()
  const role = vi.fn()
  const settings = vi.fn()
  const state = { cookies: null as any }
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: table === 'admin_roles' ? role : settings })),
    })),
  }))
  const createServerClient = vi.fn((_url: string, _key: string, options: any) => {
    state.cookies = options.cookies
    return { auth: { getClaims, getUser, getSession }, from }
  })
  return { getClaims, getUser, getSession, role, settings, state, from, createServerClient }
})

vi.mock('@supabase/ssr', () => ({ createServerClient: mock.createServerClient }))

import { middleware } from '@/middleware'
import { supabaseFetch } from '@/lib/supabase/fetch'

const authHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}
const chunks = [
  { name: 'sb-synthetic-auth.0', value: 'new-first-chunk', options: { path: '/', maxAge: 3600, sameSite: 'lax' } },
  { name: 'sb-synthetic-auth.1', value: 'new-second-chunk', options: { path: '/', maxAge: 3600, sameSite: 'lax' } },
]
const request = (path = '/dashboard') => new NextRequest(`http://localhost${path}`, {
  headers: { cookie: 'sb-synthetic-auth.0=old-first-chunk; sb-synthetic-auth.1=old-second-chunk; theme=dark' },
})
const rotate = () => mock.state.cookies.setAll(chunks, authHeaders)
const verifySessionHeaders = (response: NextResponse) => {
  for (const [name, value] of Object.entries(authHeaders)) expect(response.headers.get(name)).toBe(value)
}
const verifyRotatedCookies = (response: NextResponse) => {
  expect(response.cookies.get('sb-synthetic-auth.0')).toMatchObject({ value: 'new-first-chunk', path: '/', maxAge: 3600, sameSite: 'lax' })
  expect(response.cookies.get('sb-synthetic-auth.1')).toMatchObject({ value: 'new-second-chunk', path: '/', maxAge: 3600, sameSite: 'lax' })
  verifySessionHeaders(response)
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.state.cookies = null
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: 'verified-owner' } }, error: null })
  mock.getUser.mockResolvedValue({ data: { user: { id: 'verified-owner' } }, error: null })
  mock.getSession.mockResolvedValue({ data: { session: { user: { id: 'unverified-cookie-owner' } } }, error: null })
  mock.role.mockResolvedValue({ data: null, error: null, status: 200 })
  mock.settings.mockResolvedValue({ data: null, error: null, status: 200 })
})

describe('受保护页面验证会话并完整回写刷新 Cookie', () => {
  it.each(['/dashboard', '/dashboard/script', '/history', '/payment'])('%s 使用经过验证的 claims 放行，不直接信任会话 Cookie', async (path) => {
    const response = await middleware(request(path))
    expect(response.status).toBe(200)
    expect(mock.getClaims).toHaveBeenCalledOnce()
    expect(mock.getSession).not.toHaveBeenCalled()
    expect(mock.getUser).not.toHaveBeenCalled()
    expect(mock.createServerClient.mock.calls[0][2].global.fetch).toBe(supabaseFetch)
    verifySessionHeaders(response)
  })

  it('两块刷新 Cookie 同时传给浏览器和后续页面请求，不丢失前一块', async () => {
    mock.getClaims.mockImplementationOnce(async () => {
      rotate()
      return { data: { claims: { sub: 'verified-owner' } }, error: null }
    })
    const req = request()
    const response = await middleware(req)
    verifyRotatedCookies(response)
    expect(req.cookies.get('sb-synthetic-auth.0')?.value).toBe('new-first-chunk')
    expect(req.cookies.get('sb-synthetic-auth.1')?.value).toBe('new-second-chunk')
    expect(req.cookies.get('theme')?.value).toBe('dark')
    const forwarded = response.headers.get('x-middleware-request-cookie')
    expect(forwarded).toContain('sb-synthetic-auth.0=new-first-chunk')
    expect(forwarded).toContain('sb-synthetic-auth.1=new-second-chunk')
    expect(forwarded).not.toContain('old-first-chunk')
    expect(mock.state.cookies.getAll()).toEqual(req.cookies.getAll())
  })

  it('SDK 多批写入时保留全部更新，并清掉多余旧 Cookie 块', async () => {
    mock.getClaims.mockImplementationOnce(async () => {
      mock.state.cookies.setAll([{ name: 'sb-synthetic-auth.2', value: '', options: { path: '/', maxAge: 0 } }], authHeaders)
      rotate()
      return { data: { claims: { sub: 'verified-owner' } }, error: null }
    })
    const req = request()
    req.cookies.set('sb-synthetic-auth.2', 'obsolete-chunk')
    const response = await middleware(req)
    verifyRotatedCookies(response)
    expect(req.cookies.has('sb-synthetic-auth.2')).toBe(false)
    expect(response.cookies.get('sb-synthetic-auth.2')).toMatchObject({ value: '', maxAge: 0 })
  })

  it.each(['/dashboard', '/history', '/payment'])('%s 缺失会话仍重定向登录', async (path) => {
    mock.getClaims.mockResolvedValueOnce({ data: null, error: null })
    const response = await middleware(request(path))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    verifySessionHeaders(response)
  })

  it.each([
    { name: 'AuthInvalidJwtError', status: 400, code: 'invalid_jwt' },
    { name: 'AuthSessionMissingError', status: 400 },
    { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' },
  ])('无效会话 %j 不能靠 Cookie 中的伪造用户通过', async (error) => {
    mock.getClaims.mockResolvedValueOnce({ data: null, error })
    const response = await middleware(request())
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    expect(mock.getSession).not.toHaveBeenCalled()
  })

  it('登录重定向完整携带 SDK Cookie 和禁止缓存头', async () => {
    mock.getClaims.mockImplementationOnce(async () => {
      rotate()
      return { data: null, error: { name: 'AuthApiError', status: 401 } }
    })
    const response = await middleware(request())
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    verifyRotatedCookies(response)
  })
})

describe('认证上游短暂故障保留会话，给出可重试的 503', () => {
  it.each([
    { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' },
    { name: 'AuthApiError', status: 500, code: 'unexpected_failure' },
    { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
  ])('%j 不跳登录、不清 Cookie', async (error) => {
    mock.getClaims.mockResolvedValueOnce({ data: null, error })
    const req = request()
    const response = await middleware(req)
    expect(response.status).toBe(503)
    expect(response.headers.has('location')).toBe(false)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(response.headers.get('retry-after')).toBe('5')
    expect(req.cookies.get('sb-synthetic-auth.0')?.value).toBe('old-first-chunk')
    expect(await response.text()).toContain('请稍后刷新重试')
    verifySessionHeaders(response)
  })

  it.each([
    new DOMException('request aborted', 'AbortError'),
    new DOMException('request timed out', 'TimeoutError'),
    new TypeError('fetch failed'),
  ])('实际抛出 $name 时仍保留刷新前的会话', async (error) => {
    mock.getClaims.mockRejectedValueOnce(error)
    const response = await middleware(request())
    expect(response.status).toBe(503)
    expect(response.headers.has('location')).toBe(false)
    expect(response.headers.has('set-cookie')).toBe(false)
    verifySessionHeaders(response)
  })

  it('已刷新后验证服务故障，503 仍带回全部刷新 Cookie', async () => {
    mock.getClaims.mockImplementationOnce(async () => {
      rotate()
      throw new TypeError('fetch failed')
    })
    const response = await middleware(request())
    expect(response.status).toBe(503)
    expect(response.headers.has('location')).toBe(false)
    verifyRotatedCookies(response)
  })
})

describe('管理员必须通过当前用户校验与原有权限检查', () => {
  it.each([
    [{ role: 'admin' }, null],
    [null, { is_admin: true }],
  ])('支持 admin_roles 和旧 user_settings 的原有管理员身份', async (role, settings) => {
    mock.role.mockResolvedValueOnce({ data: role, error: null, status: 200 })
    mock.settings.mockResolvedValueOnce({ data: settings, error: null, status: 200 })
    const response = await middleware(request('/admin/users'))
    expect(response.status).toBe(200)
    expect(mock.getUser).toHaveBeenCalledOnce()
    expect(mock.getClaims).not.toHaveBeenCalled()
    expect(mock.getSession).not.toHaveBeenCalled()
    expect(mock.from.mock.calls.map(([table]) => table)).toEqual(['admin_roles', 'user_settings'])
  })

  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { name: 'AuthApiError', status: 403, code: 'user_banned' } },
  ])('无当前用户或账号被停用时仍禁止进入后台', async (result) => {
    mock.getUser.mockResolvedValueOnce(result)
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('用户校验网络故障不当作退出，也不继续授予后台权限', async () => {
    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0 } })
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(503)
    expect(response.headers.has('location')).toBe(false)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('确认没有后台权限时跳工作台，完整携带刷新 Cookie', async () => {
    mock.getUser.mockImplementationOnce(async () => {
      rotate()
      return { data: { user: { id: 'verified-owner' } }, error: null }
    })
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/dashboard')
    verifyRotatedCookies(response)
  })

  it('后台登录失效的重定向也保留完整 SDK Cookie', async () => {
    mock.getUser.mockImplementationOnce(async () => {
      rotate()
      return { data: { user: null }, error: { name: 'AuthApiError', status: 403, code: 'user_banned' } }
    })
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    verifyRotatedCookies(response)
  })

  it('管理员权限查询暂时不可用时返回 503，不误判为普通用户', async () => {
    mock.getUser.mockImplementationOnce(async () => {
      rotate()
      return { data: { user: { id: 'verified-owner' } }, error: null }
    })
    mock.role.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' }, status: 0 })
    const response = await middleware(request('/admin'))
    expect(response.status).toBe(503)
    expect(response.headers.has('location')).toBe(false)
    verifyRotatedCookies(response)
  })
})
