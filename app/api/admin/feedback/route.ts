import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { summarizeFeedback } from '@/lib/result-feedback';

export const dynamic = 'force-dynamic';

/** 结果反馈汇总：有用占比、各板块的好评差评、没用的原因。默认近 30 天 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const daysRaw = Number(new URL(request.url).searchParams.get('days'));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.trunc(daysRaw), 365) : 30;
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data, error } = await getServiceSupabase()
    .from('result_feedback')
    .select('board, rating, reason')
    .gte('created_at', since)
    .limit(20000);

  if (error) {
    console.error('[admin/feedback] 读取失败:', error.message);
    const missing = /schema cache|does not exist|Could not find the table/i.test(error.message);
    return NextResponse.json(
      { error: missing ? '结果反馈功能尚未启用' : '读取反馈失败' },
      { status: missing ? 503 : 500 }
    );
  }

  return NextResponse.json({ days, ...summarizeFeedback(data ?? []) });
}
