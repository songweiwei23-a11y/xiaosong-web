import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { dayWindows, startOfBeijingDay, sumAmounts } from '@/lib/admin-overview';

export const dynamic = 'force-dynamic';

/**
 * 管理概览：管理者进后台先看到的东西。
 * 待办（要动手的）、今日数字、近 7 天趋势。全部来自真实数据，没有数据来源的指标不放。
 * 质检、反馈两张表可能还没建：没建时对应项返回 null，页面写明「未启用」，不显示成 0。
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const db = getServiceSupabase();
  const now = Date.now();
  const todayStart = new Date(startOfBeijingDay(now)).toISOString();
  const weekAgo = new Date(now - 7 * 86400_000).toISOString();
  const soon = new Date(now + 7 * 86400_000).toISOString();
  const windows = dayWindows(7, now);

  const count = async (build: () => PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await build();
    return error ? null : n ?? 0;
  };

  const [
    reviewingRows,
    paidTodayRows,
    usageToday,
    expiringSoon,
    qualityFailures,
    negativeFeedback,
    dbProbe,
    trendRows,
  ] = await Promise.all([
    db.from('payment_orders').select('amount').eq('status', 'reviewing').limit(1000),
    db.from('payment_orders').select('amount').eq('status', 'approved').gte('reviewed_at', todayStart).limit(1000),
    count(() => db.from('usage_events').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    count(() =>
      db.from('subscriptions').select('id', { count: 'exact', head: true })
        .neq('plan', 'free').gte('end_date', new Date(now).toISOString()).lte('end_date', soon)
    ),
    count(() =>
      db.from('quality_checks').select('id', { count: 'exact', head: true })
        .eq('passed', false).gte('created_at', weekAgo)
    ),
    count(() =>
      db.from('result_feedback').select('id', { count: 'exact', head: true })
        .eq('rating', -1).gte('created_at', weekAgo)
    ),
    db.from('subscriptions').select('id', { head: true, count: 'exact' }).limit(1),
    Promise.all(
      windows.map(async (w) => ({
        label: w.label,
        usage: await count(() => db.from('usage_events').select('id', { count: 'exact', head: true }).gte('created_at', w.start).lt('created_at', w.end)),
        paid: await count(() => db.from('payment_orders').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', w.start).lt('reviewed_at', w.end)),
      }))
    ),
  ]);

  const reviewing = reviewingRows.data ?? [];
  const paidToday = paidTodayRows.data ?? [];

  return NextResponse.json({
    todo: {
      reviewing: reviewing.length,
      reviewingAmount: sumAmounts(reviewing),
      qualityFailures7d: qualityFailures,
      negativeFeedback7d: negativeFeedback,
      expiringSoon,
    },
    today: {
      usage: usageToday,
      paid: paidToday.length,
      paidAmount: sumAmounts(paidToday),
    },
    trend: trendRows,
    health: { db: !dbProbe.error },
    tables: {
      quality: qualityFailures !== null,
      feedback: negativeFeedback !== null,
    },
    generatedAt: new Date(now).toISOString(),
  });
}
