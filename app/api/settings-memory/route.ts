import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { historyProfileFilter } from '@/lib/profile-history';
import { MEMORY_WINDOW, memorySummary, pickDefaults } from '@/lib/settings-memory';

export const dynamic = 'force-dynamic';

/**
 * 设置记忆（二期）：GET ?board=script&profileId=
 * 返回这个档案最近常选的设置（见 lib/settings-memory）。只读本人的记录；
 * 画布改稿那种同一次生成的版本不算（带 canvasOf 的），不然一次生成会被数成好几次。
 */
const BOARD_TASK: Record<string, string> = { script: '脚本生成' };

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const { searchParams } = new URL(request.url);
  const task = BOARD_TASK[searchParams.get('board') ?? ''];
  if (!task) return NextResponse.json({ error: '这个板块还没有设置记忆' }, { status: 400 });

  let filter: string | null;
  try {
    filter = historyProfileFilter(searchParams.get('profileId'));
  } catch {
    return NextResponse.json({ error: '档案编号不正确' }, { status: 400 });
  }

  try {
    let q = getServiceSupabase().from('script_history').select('input_data')
      .eq('user_id', guard.userId!).eq('task_type', task).is('input_data->>canvasOf', null)
      .order('created_at', { ascending: false }).limit(MEMORY_WINDOW);
    if (filter) q = q.or(filter);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: '读取常用设置失败' }, { status: 500 });
    const inputs = (data ?? []).map((r) => (r.input_data && typeof r.input_data === 'object' ? r.input_data as Record<string, unknown> : null));
    const defaults = pickDefaults(inputs);
    return NextResponse.json({ defaults, sample: inputs.length, summary: memorySummary(defaults) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: '读取常用设置失败' }, { status: 500 });
  }
}
