/**
 * 第一道：首页拦截（2026-10-15）。
 *
 * 没有访问码、也没有通过邀请链接进来的人，连页面都看不到：所有页面一律显示「访问码」页。
 * 通过之后发一个 30 天的 httpOnly Cookie，之后正常打开首页、登录、注册。
 * 之后的两道（登录、邀请码注册）原本就有，这里不重复。
 *
 * - 访问码由后台「首页拦截」页面维护（数据库），没设过就用环境变量 SITE_ACCESS_CODE，见 lib/site-gate-store。
 * - 两种进入方式：打开 `?gate=访问码` 的邀请链接，或在访问码页输入。
 * - Cookie 里存的是访问码的摘要，不是访问码本身；改了访问码，旧 Cookie 自动失效。
 * - /api/ 不拦：支付回调、定时任务这些服务器之间的调用没有 Cookie，它们各自有鉴权。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { loadGateSetting, type GateSetting } from '@/lib/site-gate-store';

export const SITE_GATE_COOKIE = 'kaiwu_site_gate';
export const SITE_GATE_QUERY = 'gate';
const SITE_GATE_MAX_AGE = 30 * 86400;

/** 不需要过拦截的路径：访问码页本身、Next 的静态资源、接口、带后缀的静态文件（图片、脚本、robots.txt…） */
export function isGateExempt(pathname: string): boolean {
  if (pathname === '/gate') return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return true;
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

/** 访问码的摘要（SHA-256）。Cookie 和比对都只用它，访问码本身不落到浏览器里 */
export async function siteGateToken(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kaiwu-site-gate:v1:${code}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 逐位比较，比对时间不随内容变化 */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function siteGateCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: SITE_GATE_MAX_AGE };
}

/** 是不是 https 入口（直连或经过反向代理都算），决定 Cookie 要不要带 Secure */
export function isHttpsRequest(req: { url: string; headers: Headers }): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

/**
 * 首页拦截的判断。返回 null 表示放行；返回响应表示拦下（显示访问码页，或带着 Cookie 跳回干净的地址）。
 * 访问码来源读不到（source = unavailable）时一律拦下：没有可比对的码，谁也进不去。
 */
export async function siteGateResponse(
  req: NextRequest,
  load: () => Promise<GateSetting | null> = () => loadGateSetting(),
): Promise<NextResponse | null> {
  if (isGateExempt(req.nextUrl.pathname)) return null;
  const setting = await load();
  if (!setting || !setting.enabled) return null;

  const closed = () => NextResponse.rewrite(new URL('/gate', req.url));
  if (setting.source === 'unavailable' || !setting.code) return closed();
  const token = await siteGateToken(setting.code);

  // 特殊邀请链接：?gate=访问码 → 发 Cookie，去掉参数后跳到干净的地址
  const given = req.nextUrl.searchParams.get(SITE_GATE_QUERY);
  if (given !== null && sameSecret(await siteGateToken(given), token)) {
    const clean = new URL(req.url);
    clean.searchParams.delete(SITE_GATE_QUERY);
    const res = NextResponse.redirect(clean);
    res.cookies.set(SITE_GATE_COOKIE, token, siteGateCookieOptions(isHttpsRequest(req)));
    return res;
  }

  const cookie = req.cookies.get(SITE_GATE_COOKIE)?.value || '';
  if (cookie && sameSecret(cookie, token)) return null;

  // 没有通过：页面地址不变，内容换成访问码页
  return closed();
}
