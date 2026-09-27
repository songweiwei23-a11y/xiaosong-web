import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth';
import { FUNNEL_KINDS, buildFunnel, type FunnelCounts } from '@/lib/funnel';

export const dynamic = 'force-dynamic';

/**
 * 转化漏斗（管理员看）。?days=7 或 30，默认 7。
 *
 * 前三步：匿名事件按访客去重计数。
 * 后三步：这段时间里注册的人（同一批人）——其中出过第一条的、其中付过费的。
 * 用"同一批人往下走了多少"而不是各数各的：否则老用户这周付费，
 * 会让"注册 3 人、付费 5 人"这种说不通的数出现。
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const days = new URL(request.url).searchParams.get('days') === '30' ? 30 : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = getServiceSupabase();

  const [eventsRes, usersRes, usageRes, ordersRes] = await Promise.all([
    db.from('funnel_events').select('kind, visitor_id').gte('created_at', since).limit(50000),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db.from('usage_events').select('user_id').gte('created_at', since).limit(50000),
    db.from('payment_orders').select('user_id').eq('status', 'approved').gte('created_at', since).limit(5000),
  ]);

  const counts: FunnelCounts = { landing_view: 0, landing_try: 0, register_view: 0, signup: 0, activated: 0, paid: 0 };

  // 匿名事件：表还没建时这三步显示 0，页面上说明
  const anonymousReady = !eventsRes.error;
  if (anonymousReady) {
    for (const kind of FUNNEL_KINDS) {
      counts[kind] = new Set((eventsRes.data ?? []).filter((e) => e.kind === kind).map((e) => e.visitor_id)).size;
    }
  }

  const signups = new Set(
    (usersRes.data?.users ?? []).filter((u) => u.created_at && u.created_at >= since).map((u) => u.id)
  );
  counts.signup = signups.size;
  counts.activated = new Set((usageRes.data ?? []).map((r) => r.user_id).filter((id) => signups.has(id))).size;
  counts.paid = new Set((ordersRes.data ?? []).map((r) => r.user_id).filter((id) => signups.has(id))).size;

  return NextResponse.json({ days, anonymousReady, steps: buildFunnel(counts) });
}
