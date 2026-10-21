import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { deleteThread, getThread, listMessages, listThreads } from '@/lib/assistant/memory-store';
import { needsSummary } from '@/lib/assistant/memory';

export const dynamic = 'force-dynamic';

/**
 * 助理的对话记录（长期对话）。
 *   GET            列出自己的对话（标题、最后更新时间）
 *   GET ?id=       取一条对话的消息（按时间顺序）
 *   DELETE ?id=    删除一条对话
 * 数据库还没建表时返回 503，界面会退回到只在本次打开期间记得的方式。
 */

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('id');
  try {
    if (!id) return NextResponse.json({ threads: await listThreads(guard.userId!) });
    const thread = await getThread(guard.userId!, id);
    if (!thread) return NextResponse.json({ error: '找不到这段对话' }, { status: 404 });
    const messages = await listMessages(guard.userId!, id);
    return NextResponse.json({
      thread: { id: thread.id, title: thread.title },
      messages: messages.map((m) => ({ id: m.id, role: m.role, text: m.text, meta: m.meta })),
      // 对话已经超过压缩的门槛、摘要却没跟上（上一次压缩没有成功）：界面要提醒用户，助理可能记不全更早的细节
      summaryLagging: needsSummary(messages.length, thread.summarized_count),
    });
  } catch {
    return NextResponse.json({ error: '对话记录暂时读不出来' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: '找不到这段对话' }, { status: 404 });
  try {
    await deleteThread(guard.userId!, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除没有成功' }, { status: 503 });
  }
}
