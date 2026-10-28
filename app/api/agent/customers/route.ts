import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { requireAgent } from '@/lib/agent-auth';
import { agentCustomers } from '@/lib/agent-data';

export const dynamic = 'force-dynamic';

/** 代理的客户：用它的码注册的用户。邮箱脱敏，不给生成内容 */
export async function GET() {
  const agent = await requireAgent();
  if (!agent) return NextResponse.json({ error: '需要代理身份' }, { status: 403 });

  try {
    return NextResponse.json({ customers: await agentCustomers(getServiceSupabase(), agent.agentId) });
  } catch (e) {
    console.error('[agent/customers] 读取失败:', (e as Error).message);
    return NextResponse.json({ error: '读取失败，请稍后再试' }, { status: 500 });
  }
}
