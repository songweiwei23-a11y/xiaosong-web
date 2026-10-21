import { requireUser } from '@/lib/api-guard';
import { addNote, deleteNote, listNotes, normalizeNote } from '@/lib/assistant/notes-store';

/**
 * 助理的笔记（升级方案 B4）。界面和助理工具都用这一套接口，只能动自己的笔记。
 *   GET              列出最近的笔记
 *   POST {content}   新增一条
 *   DELETE ?id=      删除一条（助理的撤销按钮用这个）
 */

export const dynamic = 'force-dynamic';

const unavailable = () => Response.json({ error: '笔记暂时不可用，稍后再试' }, { status: 503 });

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  try {
    return Response.json({ notes: await listNotes(guard.userId!) });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = normalizeNote(body?.content);
  if (!content) return Response.json({ error: '笔记内容不能为空' }, { status: 400 });
  try {
    return Response.json({ note: await addNote(guard.userId!, content) }, { status: 201 });
  } catch {
    return unavailable();
  }
}

export async function DELETE(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: '缺少笔记编号' }, { status: 400 });
  try {
    await deleteNote(guard.userId!, id);
    return Response.json({ ok: true });
  } catch {
    return unavailable();
  }
}
