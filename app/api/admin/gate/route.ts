import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { readJsonBody } from '@/lib/read-body';
import {
  ADMIN_MAX_DEVICES,
  createAdminTicket,
  createInviteTicket,
  gateEnabled,
  hasActiveAdminTicket,
  listTickets,
  revokeTicket,
  setGateEnabled,
} from '@/lib/gate-tickets';
import { INVITE_CLAIM_DAYS, INVITE_MAX_DEVICES } from '@/lib/gate-ticket-format';
import { SITE_GATE_COOKIE, isHttpsRequest, siteGateCookieOptions } from '@/lib/site-gate';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/*
 * 首页门票（第一道）的后台接口。
 * - 查看、发邀请、撤销：「邀请码管理」权限（运营也有，可以给人发邀请）。
 * - 生成管理员长期门票、开启或关闭首页拦截：「密钥管理」权限（只有管理员和开发者）。
 * 门票原文只在生成的那一次返回；操作日志只记类型、备注和数量，不记门票原文。
 */

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function GET() {
  const admin = await requireAdminPermission('manage_invitations');
  if (!admin) return NextResponse.json({ error: '无权查看首页门票' }, { status: 403, headers });
  try {
    const [enabled, tickets, mine] = await Promise.all([
      gateEnabled(),
      listTickets(),
      hasActiveAdminTicket(admin.userId),
    ]);
    return NextResponse.json({
      enabled: enabled === true,
      // 读不到开关又没有缓存：页面要明说，不能显示成「未开启」
      gateUnavailable: enabled === null,
      hasMyAdminTicket: mine,
      tickets,
    }, { headers });
  } catch {
    return NextResponse.json({ error: '读取门票失败，请稍后再试' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(request);
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400, headers });
  }
  const action = typeof body?.action === 'string' ? body.action : '';

  if (action === 'create-invite' || action === 'revoke') {
    const admin = await requireAdminPermission('manage_invitations');
    if (!admin) return NextResponse.json({ error: '无权操作首页门票' }, { status: 403, headers });

    if (action === 'revoke') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return NextResponse.json({ error: '缺少门票编号' }, { status: 400, headers });
      try {
        const changed = await revokeTicket(id);
        if (!changed) return NextResponse.json({ error: '这张门票已经撤销过了' }, { status: 400, headers });
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 503, headers });
      }
      await logAdminAction({ admin_id: admin.userId, action: AdminActions.REVOKE_GATE_TICKET, target_type: 'system', target_id: id, details: {} });
      return NextResponse.json({ ok: true }, { headers });
    }

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || label.length > 60) {
      return NextResponse.json({ error: '请填写这张门票给谁（1–60 字），方便以后查' }, { status: 400, headers });
    }
    const claimDays = clampInt(body.claimDays, INVITE_CLAIM_DAYS.min, INVITE_CLAIM_DAYS.max, INVITE_CLAIM_DAYS.default);
    const maxDevices = clampInt(body.maxDevices, INVITE_MAX_DEVICES.min, INVITE_MAX_DEVICES.max, INVITE_MAX_DEVICES.default);
    try {
      const created = await createInviteTicket({ label, claimDays, maxDevices, createdBy: admin.userId });
      await logAdminAction({
        admin_id: admin.userId,
        action: AdminActions.CREATE_GATE_TICKET,
        target_type: 'system',
        target_id: created.id,
        details: { kind: 'invite', label, claimDays, maxDevices },
      });
      return NextResponse.json({ ok: true, secret: created.secret }, { headers });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 503, headers });
    }
  }

  if (action === 'create-admin' || action === 'set-enabled') {
    const admin = await requireAdminPermission('manage_secrets');
    if (!admin) return NextResponse.json({ error: '只有管理员和开发者能改这一项' }, { status: 403, headers });

    if (action === 'create-admin') {
      try {
        const created = await createAdminTicket(admin.userId);
        await logAdminAction({
          admin_id: admin.userId,
          action: AdminActions.CREATE_GATE_TICKET,
          target_type: 'system',
          target_id: created.id,
          details: { kind: 'admin', maxDevices: ADMIN_MAX_DEVICES },
        });
        const res = NextResponse.json({ ok: true, secret: created.secret }, { headers });
        // 旧的管理员门票作废了，当前这台浏览器换上新的通行，不被挡在外面
        if (created.devicePass) res.cookies.set(SITE_GATE_COOKIE, created.devicePass, siteGateCookieOptions(isHttpsRequest(request)));
        return res;
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 503, headers });
      }
    }

    const enabled = body.enabled;
    if (typeof enabled !== 'boolean') return NextResponse.json({ error: '请选择开启还是关闭' }, { status: 400, headers });
    try {
      const devicePass = await setGateEnabled(enabled, admin.userId);
      await logAdminAction({ admin_id: admin.userId, action: AdminActions.UPDATE_GATE_SETTING, target_type: 'system', target_id: 'site_gate', details: { enabled } });
      const res = NextResponse.json({ ok: true, enabled }, { headers });
      if (devicePass) res.cookies.set(SITE_GATE_COOKIE, devicePass, siteGateCookieOptions(isHttpsRequest(request)));
      return res;
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400, headers });
    }
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400, headers });
}
