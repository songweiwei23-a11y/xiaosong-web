import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { requireAgent } from '@/lib/agent-auth';
import { agentBills, currentRate, settlementsOf } from '@/lib/agent-data';
import { isValidPeriod } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/** 代理的账单：客户购买会员的已通过订单。period=YYYY-MM 按月筛，不传则全部 */
export async function GET(request: Request) {
  const agent = await requireAgent();
  if (!agent) return NextResponse.json({ error: '需要代理身份' }, { status: 403 });

  const period = new URL(request.url).searchParams.get('period') || null;
  if (period !== null && !isValidPeriod(period)) {
    return NextResponse.json({ error: '月份格式应为 YYYY-MM' }, { status: 400 });
  }

  try {
    const db = getServiceSupabase();
    const [rate, settlements] = await Promise.all([currentRate(db), settlementsOf(db, agent.agentId)]);
    const bills = await agentBills(db, agent.agentId, period, rate, settlements);
    return NextResponse.json({ bills });
  } catch (e) {
    console.error('[agent/bills] 读取失败:', (e as Error).message);
    return NextResponse.json({ error: '读取失败，请稍后再试' }, { status: 500 });
  }
}
