import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { requireAgent } from '@/lib/agent-auth';
import { AGENT_CODE_MAX_USES } from '@/lib/agent-data';
import { generateInvitationCode } from '@/lib/invitation-code';
import { createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/*
 * 代理自己的邀请码：只列出、只生成这个代理名下的码（agent_id 从会话里取，不接受前端传）。
 * 码的状态与注册时的核对一致：多人共用、不过期；生成的码统一是免费版，套餐由管理员另外定。
 */

const createLimited = createRateLimiter(60_000, 10);

export async function GET() {
  const agent = await requireAgent();
  if (!agent) return NextResponse.json({ error: '需要代理身份' }, { status: 403 });

  const { data, error } = await getServiceSupabase()
    .from('invitation_codes')
    .select('id, code, status, use_count, max_uses, notes, created_at')
    .eq('agent_id', agent.agentId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[agent/codes] 读取失败:', error.message);
    return NextResponse.json({ error: '读取邀请码失败' }, { status: 500 });
  }
  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(request: Request) {
  const agent = await requireAgent();
  if (!agent) return NextResponse.json({ error: '需要代理身份' }, { status: 403 });
  if (createLimited(agent.userId)) return NextResponse.json({ error: '操作太频繁，请稍后再试' }, { status: 429 });

  let body: { count?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const countRaw = Number(body.count ?? 1);
  const count = Number.isFinite(countRaw) ? Math.min(Math.max(Math.trunc(countRaw), 1), 20) : 1;

  const supabase = getServiceSupabase();
  // 撞码几乎不可能；真撞上（唯一索引冲突）就补上没插进去的那几个，最多试五轮
  const created: { id: string; code: string }[] = [];
  for (let attempt = 0; attempt < 5 && created.length < count; attempt++) {
    const rows = Array.from({ length: count - created.length }, () => ({
      code: generateInvitationCode(),
      created_by: agent.userId,
      created_by_admin: false,
      status: 'active',
      plan_type: 'free',
      max_uses: AGENT_CODE_MAX_USES,
      is_public: false,
      notes: '代理码',
      agent_id: agent.agentId,
    }));
    const { data, error } = await supabase.from('invitation_codes').insert(rows).select('id, code');
    if (error) {
      if (/duplicate key|unique constraint/i.test(error.message)) continue;
      console.error('[agent/codes] 生成失败:', error.message);
      return NextResponse.json({ error: '生成失败，请稍后再试' }, { status: 500 });
    }
    created.push(...((data ?? []) as { id: string; code: string }[]));
  }

  if (created.length === 0) return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
  return NextResponse.json({ created: created.length, codes: created });
}
