/**
 * 第一道：首页拦截（2026-10-16）。
 *
 * 没有门票、也没有设备通行的人，连页面都看不到：所有页面一律显示访问提示页（/gate）。
 * 门票由管理员发（后台「首页门票」），打开邀请链接（?invite=门票）就去领设备通行。
 * 设备通行是会话级的：关掉浏览器就要重新进门。已经登录的账号不看通行，直接放行；退出登录后立刻回到这里。
 * 登录、邀请码注册在门后面，原本就有。
 *
 * 这里只做判断，查库的细节在 lib/gate-tickets。/api/ 和静态资源不拦：支付回调、定时任务没有 Cookie，各自鉴权。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { devicePassValid, gateEnabled } from '@/lib/gate-tickets';

export const SITE_GATE_COOKIE = 'kaiwu_site_gate';
/** 邀请链接的参数名：/?invite=门票 */
export const SITE_GATE_QUERY = 'invite';

/** 不需要过拦截的路径：提示页本身、领门票的接口、Next 的静态资源、带后缀的静态文件（图片、脚本、robots.txt…） */
export function isGateExempt(pathname: string): boolean {
  if (pathname === '/gate') return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return true;
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

/**
 * 首页通行的 Cookie 是「会话 Cookie」：不设过期时间，关闭浏览器就没了。
 * 没登录的访客关掉浏览器，下次要重新凭门票进门；登录了的账号靠登录状态放行，不靠这个 Cookie。
 */
export function siteGateCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
}

/** 是不是 https 入口（直连或经过反向代理都算），决定 Cookie 要不要带 Secure */
export function isHttpsRequest(req: { url: string; headers: Headers }): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export interface GateDeps {
  /** 首页拦截开着吗。true / false；null = 读不到又没有缓存，按关门处理 */
  enabled: () => Promise<boolean | null>;
  /** 这个设备通行（Cookie 原文）还有效吗 */
  devicePass: (cookieSecret: string) => Promise<boolean>;
}

const defaultDeps: GateDeps = { enabled: gateEnabled, devicePass: devicePassValid };

/**
 * 首页拦截的判断。返回 null 表示放行；返回响应表示拦下：
 * - 带着邀请链接来的：去 /api/gate/claim 领设备通行，领完回到原来的页面；
 * - 其它：页面地址不变，内容换成提示页。
 */
export async function siteGateResponse(
  req: NextRequest,
  deps: GateDeps = defaultDeps,
  loggedIn?: () => Promise<boolean>,
): Promise<NextResponse | null> {
  if (isGateExempt(req.nextUrl.pathname)) return null;

  const enabled = await deps.enabled();
  if (enabled === false) return null;
  const closed = () => NextResponse.rewrite(new URL('/gate', req.url));
  if (enabled === null) return closed();

  // 已经登录的账号直接放行。退出登录后登录状态没了，才会走到下面的门票判断
  if (loggedIn && (await loggedIn())) return null;

  const cookie = req.cookies.get(SITE_GATE_COOKIE)?.value || '';
  if (cookie && (await deps.devicePass(cookie))) return null;

  const ticket = req.nextUrl.searchParams.get(SITE_GATE_QUERY);
  if (ticket) {
    const back = new URL(req.url);
    back.searchParams.delete(SITE_GATE_QUERY);
    const claim = new URL('/api/gate/claim', req.url);
    claim.searchParams.set('t', ticket);
    claim.searchParams.set('next', back.pathname + back.search);
    return NextResponse.redirect(claim);
  }

  return closed();
}
