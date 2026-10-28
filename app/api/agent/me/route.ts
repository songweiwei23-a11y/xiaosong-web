import { NextResponse } from 'next/server';
import { requireAgent } from '@/lib/agent-auth';

export const dynamic = 'force-dynamic';

/**
 * 我是不是代理（2026-10-28）：头像菜单的「代理后台」、首页的招募横幅靠它决定显示哪个。
 * 只回答是不是、显示名；代理的数据仍然只走 /api/agent/* 的其他接口，那里各自要求代理身份。
 */
export async function GET() {
  const agent = await requireAgent();
  return NextResponse.json(agent ? { isAgent: true, displayName: agent.displayName } : { isAgent: false });
}
