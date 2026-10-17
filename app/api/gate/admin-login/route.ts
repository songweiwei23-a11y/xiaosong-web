import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIp } from '@/lib/client-ip';
import { createRateLimiter } from '@/lib/rate-limit';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { isAdminUser, gateAdminLoginEnabled, issueAdminDevicePass } from '@/lib/gate-tickets';
import { adminEmergencyLogin, maskEmail, parseAdminLogin, type AdminLoginDeps } from '@/lib/gate-admin-login';
import { SITE_GATE_COOKIE, isHttpsRequest, siteGateCookieOptions } from '@/lib/site-gate';

export const dynamic = 'force-dynamic';

/*
 * 首页应急登录（第一道的后门）：门票丢了的管理员，用「邮箱 + 密码」换一台设备的通行。
 * 默认关闭（后台开关）。只认管理员账号。两层限流：同一 IP 和同一邮箱，15 分钟内各有上限。
 * 失败只返回一句笼统的话；成功写入操作日志，并在服务器日志里留一条 warn，方便看见。
 * 登录用的会话只在这一次请求里用，不写进浏览器，结束后丢弃。
 */

const ipLimited = createRateLimiter(15 * 60_000, 10);
const emailLimited = createRateLimiter(15 * 60_000, 5);
const GENERIC_FAIL = '这个账号现在不能用应急登录。请确认账号和密码，或改用管理员门票';

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** 真实的每一步：用一个临时客户端完成登录，不写任何 Cookie */
function realDeps(client: ReturnType<typeof anonClient>): AdminLoginDeps {
  return {
    enabled: () => gateAdminLoginEnabled(),
    signIn: async (email, password) => {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) return null;
      return { userId: data.user.id };
    },
    isAdmin: (userId) => isAdminUser(userId),
    issuePass: (userId) => issueAdminDevicePass(userId),
  };
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (ipLimited(ip)) return NextResponse.json({ error: '尝试太频繁了，请 15 分钟后再试' }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }
  const input = parseAdminLogin(body);
  if (!input) return NextResponse.json({ error: '请填写管理员邮箱和密码' }, { status: 400 });
  if (emailLimited(input.email)) return NextResponse.json({ error: '尝试太频繁了，请 15 分钟后再试' }, { status: 429 });

  let outcome;
  try {
    outcome = await adminEmergencyLogin(input, realDeps(anonClient()));
  } catch (e) {
    console.error('[gate] 应急登录核对失败:', (e as Error).message);
    return NextResponse.json({ error: '暂时无法核对，请稍后再试，还不行就刷新页面' }, { status: 503 });
  }

  if (!outcome.ok) {
    console.warn('[gate] 应急登录失败', ip, maskEmail(input.email));
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
  }

  // 成功：留操作日志，并在服务器日志里一条 warn（没有邮件或即时通讯告警，这是现有的告警渠道）
  console.warn('[gate] 应急登录成功', outcome.userId, ip);
  try {
    await logAdminAction({
      admin_id: outcome.userId,
      action: AdminActions.GATE_ADMIN_LOGIN,
      target_type: 'system',
      target_id: 'site_gate',
      details: { via: 'emergency-login' },
    });
  } catch {
    // 日志写失败不影响这次进门，但服务器日志里已经有记录
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_GATE_COOKIE, outcome.devicePass, siteGateCookieOptions(isHttpsRequest(request)));
  return res;
}
