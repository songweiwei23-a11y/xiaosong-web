import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { validSiteAccessCode, SITE_ACCESS_CODE_MAX, SITE_ACCESS_CODE_MIN } from '@/lib/site-access-code';
import { SITE_GATE_COOKIE, isHttpsRequest, siteGateCookieOptions, siteGateToken } from '@/lib/site-gate';
import { loadGateSetting, resetGateCache, saveGateSetting, type GateSetting } from '@/lib/site-gate-store';
import { readJsonBody } from '@/lib/read-body';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/*
 * 首页拦截的访问码（后台「首页拦截」板块）。访问码本身就是密钥，所以读和写都要「密钥管理」权限，
 * 和联网搜索密钥是同一个权限。
 *
 * 保存时，当前管理员这台浏览器会自动拿到新的 Cookie，不会把自己挡在门外。
 * 访问码本身不写进操作日志，只记是否开启、码长。
 */

function statusOf(setting: GateSetting | null) {
  return {
    enabled: setting?.enabled ?? false,
    code: setting?.source === 'unavailable' ? '' : (setting?.code ?? ''),
    source: setting?.source ?? 'none',
  };
}

export async function GET() {
  const admin = await requireAdminPermission('manage_secrets');
  if (!admin) return NextResponse.json({ error: '无权查看首页访问码' }, { status: 403, headers });
  resetGateCache();
  return NextResponse.json(statusOf(await loadGateSetting()), { headers });
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('manage_secrets');
  if (!admin) return NextResponse.json({ error: '无权更换首页访问码' }, { status: 403, headers });

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(request, admin.userId);
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400, headers });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400, headers });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const enabled = body.enabled;
  if (!validSiteAccessCode(code)) {
    return NextResponse.json(
      { error: `访问码需要 ${SITE_ACCESS_CODE_MIN}–${SITE_ACCESS_CODE_MAX} 位，只能用字母、数字、短横线和下划线` },
      { status: 400, headers },
    );
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: '请选择是否开启首页拦截' }, { status: 400, headers });
  }

  try {
    await saveGateSetting(code, enabled, admin.userId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503, headers });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.UPDATE_SITE_ACCESS,
    target_type: 'system',
    target_id: 'site_access',
    details: { enabled, code_length: code.length },
  });

  const res = NextResponse.json({ ok: true, ...statusOf({ code, enabled, source: 'database' }) }, { headers });
  // 当前管理员的浏览器拿到新的 Cookie，保存后不用再输一次
  if (enabled) res.cookies.set(SITE_GATE_COOKIE, await siteGateToken(code), siteGateCookieOptions(isHttpsRequest(request)));
  return res;
}
