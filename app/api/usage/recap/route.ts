import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 这个人用开物做过什么：按功能数次数（全部时间）。
 *
 * 付费引导弹窗里的"你已经用开物写了 12 条脚本、5 批选题"就用它。
 * 读 usage_events：每次成功生成记一条、只增不删（删了历史记录也不少算）。
 * 表还没建时返回空，弹窗就不显示回顾那一段。
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const { data, error } = await getServiceSupabase()
    .from('usage_events')
    .select('feature')
    .eq('user_id', guard.userId!)
    .limit(5000);

  if (error) return NextResponse.json({ counts: {} });
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const f = (r as { feature?: string }).feature;
    if (f) counts[f] = (counts[f] ?? 0) + 1;
  }
  return NextResponse.json({ counts });
}
