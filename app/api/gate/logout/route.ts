import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeDevicePass } from '@/lib/gate-tickets';
import { SITE_GATE_COOKIE, isHttpsRequest, siteGateCookieOptions } from '@/lib/site-gate';

export const dynamic = 'force-dynamic';

/*
 * 退出登录时调用（第一道的闭环）：作废这台设备的首页通行，并清掉 Cookie。
 * 之后这台设备再打开首页，必须重新凭邀请链接或门票进门，不管之前登录的是哪个账号。
 * 不需要登录也能调用：它只会让当前设备失去通行，没有任何读取或修改账号数据的动作。
 * 跨站的 POST 带不上这个 Cookie（SameSite=lax），别的网站没法替用户把通行作废。
 */
export async function POST(request: Request) {
  const secret = (await cookies()).get(SITE_GATE_COOKIE)?.value || '';
  if (secret) {
    try {
      await revokeDevicePass(secret);
    } catch (e) {
      // 库里删不掉也要把 Cookie 清掉；通行会在 30 天后自然过期，服务器日志里留一条
      console.error('[gate] 退出时作废通行失败:', (e as Error).message);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_GATE_COOKIE, '', { ...siteGateCookieOptions(isHttpsRequest(request)), maxAge: 0 });
  return res;
}
