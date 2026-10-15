import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { claimTicket } from '@/lib/gate-tickets';
import { claimMessage, extractTicket, safeNextPath } from '@/lib/gate-ticket-format';
import { SITE_GATE_COOKIE, isHttpsRequest, siteGateCookieOptions } from '@/lib/site-gate';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/*
 * 用门票领设备通行（第一道）。
 * GET：打开邀请链接时由中间件转过来，领到通行后跳回原来的页面；失败跳到提示页并说明原因。
 * POST：提示页里粘贴门票或邀请链接，成功后返回 ok，由页面再回首页。
 * 门票原文不进日志；错误只说原因类别，不说门票存不存在以外的细节。
 */
const attemptLimited = createRateLimiter(15 * 60_000, 30);

function gateRedirect(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/gate?e=${encodeURIComponent(reason)}`, request.url));
}

export async function GET(request: Request) {
  if (attemptLimited(clientIp(request))) return gateRedirect(request, 'limited');
  const url = new URL(request.url);
  const ticket = extractTicket(url.searchParams.get('t') || '');
  if (!ticket) return gateRedirect(request, 'not_found');

  const result = await claimTicket(ticket);
  if (!result.ok) return gateRedirect(request, result.reason);

  const res = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get('next')), request.url));
  res.cookies.set(SITE_GATE_COOKIE, result.cookieSecret, siteGateCookieOptions(isHttpsRequest(request)));
  return res;
}

export async function POST(request: Request) {
  if (attemptLimited(clientIp(request))) {
    return NextResponse.json({ error: claimMessage('limited') }, { status: 429 });
  }
  let body: { ticket?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const ticket = extractTicket(String(body.ticket || ''));
  if (!ticket) return NextResponse.json({ error: '请粘贴管理员发给你的门票或邀请链接' }, { status: 400 });

  const result = await claimTicket(ticket);
  if (!result.ok) {
    return NextResponse.json({ error: claimMessage(result.reason) }, { status: result.reason === 'unavailable' ? 503 : 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_GATE_COOKIE, result.cookieSecret, siteGateCookieOptions(isHttpsRequest(request)));
  return res;
}
