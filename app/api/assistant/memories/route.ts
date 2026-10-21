import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { deleteMemory, listMemories } from '@/lib/assistant/memory-store';

export const dynamic = 'force-dynamic';

/**
 * 助理记下来的记忆。用户可以在助理面板里查看和删除（删了助理就不再记得这件事）。
 *   GET            列出
 *   DELETE ?id=    删除一条
 */

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  try {
    return NextResponse.json({ memories: await listMemories(guard.userId!) });
  } catch {
    return NextResponse.json({ error: '记忆暂时读不出来' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: '找不到这条记忆' }, { status: 404 });
  try {
    await deleteMemory(guard.userId!, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除没有成功' }, { status: 503 });
  }
}
