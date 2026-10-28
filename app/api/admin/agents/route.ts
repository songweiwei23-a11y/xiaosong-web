import { NextResponse } from 'next/server';
import { requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';
import { adminWriteLimited } from '@/lib/admin-rate';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { adminAgentList, currentRate, findUserIdByEmail } from '@/lib/agent-data';
import { parseRatePercent } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/*
 * 代理的开通、停用、统一费率。全部由管理员手动操作（2026-10-28 确认）。
 * 代理身份记在 agents 表里，不放进 admin_roles：那张表一有记录就算管理员。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['active', 'paused'] as const;

export async function GET() {
  const admin = await requireAdminPermission('view_agents');
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  try {
    const db = getServiceSupabase();
    const rate = await currentRate(db);
    return NextResponse.json({ rate, agents: await adminAgentList(db, rate) });
  } catch (e) {
    console.error('[admin/agents] 读取失败:', (e as Error).message);
    return NextResponse.json({ error: '读取代理失败' }, { status: 500 });
  }
}

/** 开通代理：按邮箱找到已注册的账号，那个账号就成为代理（账号要先自己注册） */
export async function POST(request: Request) {
  const admin = await requireAdminPermission('manage_agents');
  if (!admin) return NextResponse.json({ error: '无权开通代理' }, { status: 403 });
  if (adminWriteLimited(admin.userId)) return NextResponse.json({ error: '操作太频繁，请稍后再试' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const displayName = String(body.displayName ?? '').trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: '请填写正确的邮箱地址' }, { status: 400 });

  const db = getServiceSupabase();
  const userId = await findUserIdByEmail(db, email);
  if (!userId) return NextResponse.json({ error: '没有这个邮箱的账号，请先让对方注册' }, { status: 404 });

  const { data, error } = await db
    .from('agents')
    .insert({ user_id: userId, display_name: displayName, created_by: admin.userId })
    .select('id')
    .single();
  if (error) {
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: '这个账号已经是代理了' }, { status: 409 });
    }
    console.error('[admin/agents] 开通失败:', error.message);
    return NextResponse.json({ error: '开通失败，请稍后再试' }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: AdminActions.CREATE_AGENT,
    target_type: 'agent',
    details: { agentId: data.id, email, displayName },
  });
  return NextResponse.json({ id: data.id });
}

/**
 * 两种修改：
 * - { action: 'setStatus', id, status }：停用或启用代理。停用后代理进不了代理后台，它的邀请码也不能再注册（2026-10-28）；客户和账单保留
 * - { action: 'setRate', percent }：统一费率，百分比（20 = 20%）。只影响之后的结算，已结算的月份不变
 */
export async function PATCH(request: Request) {
  const admin = await requireAdminPermission('manage_agents');
  if (!admin) return NextResponse.json({ error: '无权修改代理' }, { status: 403 });
  if (adminWriteLimited(admin.userId)) return NextResponse.json({ error: '操作太频繁，请稍后再试' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const db = getServiceSupabase();

  if (body.action === 'setRate') {
    const rate = parseRatePercent(body.percent);
    if (rate === null) return NextResponse.json({ error: '费率应为 0 到 100 之间的数字，最多两位小数' }, { status: 400 });
    const { error } = await db.from('agent_program_settings').upsert(
      { id: 1, commission_rate: rate, updated_at: new Date().toISOString(), updated_by: admin.userId },
      { onConflict: 'id' }
    );
    if (error) {
      console.error('[admin/agents] 修改费率失败:', error.message);
      return NextResponse.json({ error: '修改费率失败' }, { status: 500 });
    }
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.SET_AGENT_RATE,
      target_type: 'agent_program',
      details: { percent: Number(body.percent), rate },
    });
    return NextResponse.json({ rate });
  }

  if (body.action === 'setStatus') {
    const id = String(body.id ?? '');
    const status = body.status;
    if (!id || !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: '缺少代理或状态不对' }, { status: 400 });
    }
    const { data, error } = await db.from('agents').update({ status }).eq('id', id).select('id');
    if (error) {
      console.error('[admin/agents] 改状态失败:', error.message);
      return NextResponse.json({ error: '修改状态失败' }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: '没有这个代理' }, { status: 404 });
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.SET_AGENT_STATUS,
      target_type: 'agent',
      details: { agentId: id, status },
    });
    return NextResponse.json({ id, status });
  }

  return NextResponse.json({ error: '不认识的操作' }, { status: 400 });
}
