import { NextResponse } from 'next/server';
import { requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';
import { adminWriteLimited } from '@/lib/admin-rate';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';
import { currentRate, settleAgentsForPeriod } from '@/lib/agent-data';
import { canSettlePeriod, isValidPeriod } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/*
 * 月度分成结算（每月一次，管理员手动点）。
 * 只结已经过完的月份（北京时间），同一代理同一个月只结一次：重复点不会重复记。
 * 结算写的是快照（费率、单数、金额），之后改费率不影响它。系统只记账，打款线下做。
 */

/** 某个月的结算记录（带代理的显示名） */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_agents');
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const period = new URL(request.url).searchParams.get('period') ?? '';
  if (!isValidPeriod(period)) return NextResponse.json({ error: '月份格式应为 YYYY-MM' }, { status: 400 });

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('agent_settlements')
    .select('agent_id, period, order_count, paid_amount, commission_rate, commission_amount, settled_at')
    .eq('period', period)
    .order('commission_amount', { ascending: false });
  if (error) {
    console.error('[admin/agents/settle] 读取失败:', error.message);
    return NextResponse.json({ error: '读取结算记录失败' }, { status: 500 });
  }

  const ids = (data ?? []).map((r) => r.agent_id as string);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: agents } = await db.from('agents').select('id, display_name').in('id', ids);
    for (const a of agents ?? []) names.set(a.id as string, (a.display_name as string) || '（未命名）');
  }
  return NextResponse.json({
    period,
    settlements: (data ?? []).map((r) => ({ ...r, display_name: names.get(r.agent_id as string) ?? '（未命名）' })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('settle_commissions');
  if (!admin) return NextResponse.json({ error: '无权结算分成' }, { status: 403 });
  if (adminWriteLimited(admin.userId)) return NextResponse.json({ error: '操作太频繁，请稍后再试' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const period = String(body.period ?? '');
  if (!isValidPeriod(period)) return NextResponse.json({ error: '月份格式应为 YYYY-MM' }, { status: 400 });
  if (!canSettlePeriod(period)) {
    return NextResponse.json({ error: '只能结算已经过完的月份（北京时间）' }, { status: 400 });
  }

  try {
    const db = getServiceSupabase();
    const rate = await currentRate(db);
    const result = await settleAgentsForPeriod(db, period, rate, admin.userId);
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.SETTLE_AGENTS,
      target_type: 'agent_settlement',
      details: { period, rate, settled: result.settled, skipped: result.skipped, totalCommission: result.totalCommission },
    });
    return NextResponse.json({ period, rate, ...result });
  } catch (e) {
    console.error('[admin/agents/settle] 结算失败:', (e as Error).message);
    return NextResponse.json({ error: '结算失败，请稍后再试（已结算的不会重复记）' }, { status: 500 });
  }
}
