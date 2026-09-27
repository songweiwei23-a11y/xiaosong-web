import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { LAUNCH_TOTAL, normalizeDoneDays, toggleDay } from '@/lib/launch-plan';

export const dynamic = 'force-dynamic';

/**
 * 7 天起号计划（见 lib/launch-plan.ts）。
 *   GET                      → { plan: { startedAt, doneDays } | null }
 *   POST { action: 'start' } → 开始（已开始的从头来）
 *   POST { action: 'toggle', day } → 勾选 / 取消某一天
 *   POST { action: 'quit' }  → 不做了，删掉
 *
 * 表还没建（迁移没跑）时 GET 返回 unavailable，页面就不显示这张卡——
 * 显示一张点了会报错的卡，比不显示更糟。
 */

const missing = (msg: string) => /schema cache|does not exist|relation/i.test(msg);

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const { data, error } = await getServiceSupabase()
    .from('launch_plans')
    .select('started_at, done_days')
    .eq('user_id', guard.userId!)
    .maybeSingle();

  if (error) {
    if (missing(error.message)) return NextResponse.json({ plan: null, unavailable: true });
    return NextResponse.json({ error: '读取起号计划失败' }, { status: 500 });
  }
  return NextResponse.json({
    plan: data ? { startedAt: data.started_at, doneDays: normalizeDoneDays(data.done_days) } : null,
  });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  let body: { action?: string; day?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const userId = guard.userId!;
  const now = new Date().toISOString();

  if (body.action === 'start') {
    const { error } = await db
      .from('launch_plans')
      .upsert({ user_id: userId, started_at: now, done_days: [], updated_at: now }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: '开始计划失败：' + error.message }, { status: 500 });
    return NextResponse.json({ plan: { startedAt: now, doneDays: [] } });
  }

  if (body.action === 'toggle') {
    const day = Number(body.day);
    if (!Number.isInteger(day) || day < 1 || day > LAUNCH_TOTAL) {
      return NextResponse.json({ error: '天数不对' }, { status: 400 });
    }
    const { data: row, error: readError } = await db
      .from('launch_plans')
      .select('started_at, done_days')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: '读取起号计划失败' }, { status: 500 });
    if (!row) return NextResponse.json({ error: '还没开始计划' }, { status: 404 });

    const doneDays = toggleDay(normalizeDoneDays(row.done_days), day);
    const { error } = await db
      .from('launch_plans')
      .update({ done_days: doneDays, updated_at: now })
      .eq('user_id', userId);
    if (error) return NextResponse.json({ error: '保存失败：' + error.message }, { status: 500 });
    return NextResponse.json({ plan: { startedAt: row.started_at, doneDays } });
  }

  if (body.action === 'quit') {
    const { error } = await db.from('launch_plans').delete().eq('user_id', userId);
    if (error) return NextResponse.json({ error: '操作失败：' + error.message }, { status: 500 });
    return NextResponse.json({ plan: null });
  }

  return NextResponse.json({ error: '不认识的操作' }, { status: 400 });
}
