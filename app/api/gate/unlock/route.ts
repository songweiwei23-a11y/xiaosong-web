import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { createRateLimiter } from '@/lib/rate-limit';
import { SITE_GATE_COOKIE, isHttpsRequest, sameSecret, siteGateCookieOptions, siteGateToken } from '@/lib/site-gate';
import { loadGateSetting } from '@/lib/site-gate-store';

export const dynamic = 'force-dynamic';

/*
 * 首页拦截的「访问码」入口（第一道）。通过后发 Cookie，之后的页面才放行。
 * 访问码错了不告诉是哪一种错误；15 分钟内错 20 次就先停一下，防止被猜。
 */
const attemptLimited = createRateLimiter(15 * 60_000, 20);

export async function POST(request: Request) {
  const setting = await loadGateSetting();
  // 没开拦截，就没有可进的门
  if (!setting || !setting.enabled) return NextResponse.json({ ok: true });
  if (setting.source === 'unavailable' || !setting.code) {
    return NextResponse.json({ error: '暂时无法核对访问码，请稍后再试' }, { status: 503 });
  }

  if (attemptLimited(clientIp(request))) {
    return NextResponse.json({ error: '尝试太频繁了，请 15 分钟后再试' }, { status: 429 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const given = String(body.code || '').trim();
  const token = await siteGateToken(setting.code);
  if (!given || !sameSecret(await siteGateToken(given), token)) {
    return NextResponse.json({ error: '访问码不对，请核对后再试' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_GATE_COOKIE, token, siteGateCookieOptions(isHttpsRequest(request)));
  return res;
}
