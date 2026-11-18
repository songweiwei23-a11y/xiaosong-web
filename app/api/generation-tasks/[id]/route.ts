import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { readGenerationTask } from '@/lib/generation-task';

export const dynamic = 'force-dynamic';

/**
 * 页面恢复生成任务：只返回当前用户自己的任务及最新可用版本。
 * 即使后处理暂未完成，latest 也会是已保存草稿，页面可立即恢复正文。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '生成任务编号不正确' }, { status: 400 });
  const task = await readGenerationTask(guard.userId!, id);
  if (!task) return NextResponse.json({ error: '没有找到这项生成任务，或当前账号无权限' }, { status: 404 });
  return NextResponse.json(task, { headers: { 'Cache-Control': 'private, no-store' } });
}
