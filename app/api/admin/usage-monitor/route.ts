import { NextResponse } from 'next/server';
import { requireAdminPermission, getServiceSupabase } from '@/lib/admin-auth';
import { sumCountedUsage } from '@/lib/config/plans';
import {
  buildUsageMonitor,
  TOKEN_PRICE_CNY_PER_MILLION,
  type MonitorEvidence,
  type MonitorOrder,
  type MonitorPackLot,
  type MonitorQuota,
  type MonitorSubscription,
  type MonitorUsageEvent,
  type MonitorUser,
} from '@/lib/usage-monitor';

/** 时间窗口：7 / 30 / 90 天。其它值按 30 天 */
const WINDOWS = [7, 30, 90] as const;
/** 分页读取的上限：每张表最多 200 页（每页 1000 行），超过就截断并在返回里标出 */
const MAX_PAGES = 200;
const PAGE = 1000;

/** 逐页读完一张表。query 每次返回一个新的查询构造（带 range） */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** 用户列表来自认证系统（翻页读取，和 lib/admin-stats 同一个口径） */
async function fetchAuthUsers(): Promise<MonitorUser[]> {
  const supabase = getServiceSupabase();
  const users: MonitorUser[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      users.push({ id: u.id, email: u.email ?? null, createdAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null });
    }
    if (data.users.length < PAGE) break;
  }
  return users;
}

export async function GET(request: Request) {
  const admin = await requireAdminPermission('manage_users');
  if (!admin) return NextResponse.json({ error: '无权查看用户使用监控' }, { status: 403 });

  const requested = Number(new URL(request.url).searchParams.get('days'));
  const days = (WINDOWS as readonly number[]).includes(requested) ? requested : 30;
  const now = new Date();
  // 取数范围固定为最近 90 天：最长窗口就是 90 天，再早的记录不影响板块上的任何数字
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const supabase = getServiceSupabase();
  try {
    const [users, subs, quotas, events, evidence, lots, orders] = await Promise.all([
      fetchAuthUsers(),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('subscriptions').select('user_id, plan, status, end_date').range(from, to) as never),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('user_quotas').select('*').range(from, to) as never),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('usage_events').select('user_id, feature, created_at').gte('created_at', since).order('created_at', { ascending: true }).range(from, to) as never),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('creation_completion_evidence').select('user_id, feature, completed_at, usage_metadata').gte('completed_at', since).order('completed_at', { ascending: true }).range(from, to) as never),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('count_pack_lots').select('user_id, credits_total, credits_remaining, expires_at').range(from, to) as never),
      fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from('payment_orders').select('user_id, plan_id, status').range(from, to) as never),
    ]);

    const truncated = [subs, quotas, events, evidence, lots, orders].some((t) => t.truncated);

    const subscriptions: MonitorSubscription[] = subs.rows.map((s) => ({
      userId: String(s.user_id),
      plan: (s.plan as string) ?? null,
      status: (s.status as string) ?? null,
      endDate: (s.end_date as string) ?? null,
    }));
    const quotaRows: MonitorQuota[] = quotas.rows.map((q) => ({
      userId: String(q.user_id),
      periodUsed: sumCountedUsage(q),
    }));
    const eventRows: MonitorUsageEvent[] = events.rows.map((e) => ({
      userId: String(e.user_id),
      feature: String(e.feature),
      createdAt: String(e.created_at),
    }));
    const evidenceRows: MonitorEvidence[] = evidence.rows.map((e) => {
      const m = (e.usage_metadata ?? {}) as Record<string, unknown>;
      return {
        userId: String(e.user_id),
        feature: String(e.feature),
        completedAt: String(e.completed_at),
        totalTokens: Number(m.total_tokens) || 0,
        promptTokens: Number(m.prompt_tokens) || 0,
        completionTokens: Number(m.completion_tokens) || 0,
      };
    });
    const lotRows: MonitorPackLot[] = lots.rows.map((l) => ({
      userId: String(l.user_id),
      creditsTotal: Number(l.credits_total) || 0,
      creditsRemaining: Number(l.credits_remaining) || 0,
      expiresAt: (l.expires_at as string) ?? null,
    }));
    const orderRows: MonitorOrder[] = orders.rows.map((o) => ({
      userId: String(o.user_id),
      planId: String(o.plan_id),
      status: String(o.status),
    }));

    const report = buildUsageMonitor({
      users,
      subscriptions,
      events: eventRows,
      evidence: evidenceRows,
      quotas: quotaRows,
      packLots: lotRows,
      orders: orderRows,
      days,
      now,
      tokenPricePerMillion: TOKEN_PRICE_CNY_PER_MILLION,
    });

    return NextResponse.json({ ...report, truncated });
  } catch (error) {
    console.error('[admin/usage-monitor] 取数失败:', (error as Error).message);
    return NextResponse.json({ error: '用户使用数据暂时无法读取，可能是迁移还没执行' }, { status: 503 });
  }
}
