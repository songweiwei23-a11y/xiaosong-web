import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { fetchDifyMessage } from '@/lib/dify-recover';

export const dynamic = 'force-dynamic';

/**
 * 断线续取：页面和服务器之间的流断了，来问一下那篇写完没有。
 *
 * 页面每隔几秒问一次，写完了就把全文拿回去（见 lib/sse-stream.ts）。
 * 只能取自己的：Dify 按 user 隔离会话，这里的 user 用的是登录用户的 id，
 * 拿别人的会话 id 来问，Dify 那边查不到。
 */
export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId') || '';
  const messageId = searchParams.get('messageId') || '';
  if (!conversationId || !messageId) {
    return NextResponse.json({ error: '缺少会话或消息编号' }, { status: 400 });
  }

  const state = await fetchDifyMessage(conversationId, messageId, guard.userId!);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
