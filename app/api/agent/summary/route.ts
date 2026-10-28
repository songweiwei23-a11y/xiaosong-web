import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { requireAgent } from '@/lib/agent-auth';
import { agentSummary } from '@/lib/agent-data';

export const dynamic = 'force-dynamic';

/** 代理首页：累计统计、每月分成（只看自己的客户和会员账单） */
export async function GET() {
  const agent = await requireAgent();
  if (!agent) return NextResponse.json({ error: '需要代理身份' }, { status: 403 });

  try {
    return NextResponse.json(await agentSummary(getServiceSupabase(), agent));
  } catch (e) {
    console.error('[agent/summary] 读取失败:', (e as Error).message);
    return NextResponse.json({ error: '读取失败，请稍后再试' }, { status: 500 });
  }
}
