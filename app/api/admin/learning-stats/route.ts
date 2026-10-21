import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { compareControl } from '@/lib/learning-stats';

export const dynamic = 'force-dynamic';

/**
 * 对照组效果（管理员）：最近 60 天，带偏好 vs 对照组，各自「有用」的比例。
 * GET → { generations, treatment, control, liftPoints, enoughSample }
 * 反馈没对上生成记录的不算；数据不够（每边不到 30 条）时 enoughSample 为 false，只给数不下结论。
 */
export async function GET() {
  const admin = await requireAdminPermission('view_analytics');
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const db = getServiceSupabase();
  const { data, error } = await db.from('result_feedback').select('control, rating').gte('created_at', since).not('control', 'is', null).limit(20000);
  if (error) return NextResponse.json({ error: '对照组数据读不到（迁移可能还没执行）' }, { status: 503 });
  const { count } = await db.from('user_signals').select('id', { count: 'exact', head: true }).eq('kind', 'generation').gte('created_at', since);

  return NextResponse.json({ windowDays: 60, generations: count ?? null, ...compareControl((data ?? []) as { control: boolean | null; rating: number }[]) }, { headers: { 'Cache-Control': 'no-store' } });
}
