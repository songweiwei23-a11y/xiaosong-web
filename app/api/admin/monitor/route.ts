import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/admin-permissions';
import {
  readAllRows,
  readAllUsersCached,
  chinaDayStart,
  snapshotForRevision,
  readMonitorRevision,
  fillContent,
  pruneContent,
  generationContent,
  usageDetailContent,
  createTtlValue,
  lookupUsers,
} from '@/lib/admin-monitor-data';

/**
 * 快照时间片（毫秒）：同一个时间片、同一个数据版本内，多个管理员看到的是同一份结果。
 * 1 秒一个时间片：大屏每秒刷新一次，「在线」「多久前」每秒都跟着变。
 */
const SNAPSHOT_TTL_MS = 1_000;
import { APP_BUILD, presenceRevision, presenceSnapshot } from '@/lib/presence';
import { runningJobCount } from '@/lib/assistant/jobs';
import { slotStats } from '@/lib/generation-slots';
import {
  buildEvents,
  buildDirectory,
  activeUsers,
  featureBreakdown,
  pulseByMinute,
  isToday,
  effectiveRevenue,
  redactSnapshot,
  parseTime,
  EVENT_LIMIT,
  type RawGeneration,
  type RawOrder,
  type RawUsage,
  type RawWork,
} from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/** 历史生成总数：变化慢，每分钟算一次（P0-2） */
const totalGenerations = createTtlValue(60_000, async () => {
  const res = await getServiceSupabase()
    .from('script_history')
    .select('id', { count: 'exact', head: true })
    .is('input_data->>canvasOf', null);
  if (res.error || res.count === null) throw new Error(res.error?.message || '生成总数读取失败');
  return res.count;
});

/** 按状态数订单（带条件的计数，不把整张表读下来，P0-3） */
async function countOrders(status: string): Promise<number> {
  const res = await getServiceSupabase()
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', status);
  if (res.error || res.count === null) throw new Error(res.error?.message || '订单统计读取失败');
  return res.count;
}

/** 最早那笔等待审核的订单什么时候上传的凭证；没有待审订单返回 null */
async function oldestPendingAt(): Promise<string | null> {
  const res = await getServiceSupabase()
    .from('payment_orders')
    .select('proof_uploaded_at, created_at')
    .eq('status', 'reviewing')
    .order('proof_uploaded_at', { ascending: true })
    .limit(1);
  if (res.error) throw new Error(res.error.message);
  const row = res.data?.[0];
  return row ? (row.proof_uploaded_at ?? row.created_at ?? null) : null;
}

const ORDER_COLS = 'id, user_id, plan_id, plan_name, amount, status, billing_cycle, created_at, proof_uploaded_at, reviewed_at';

/**
 * 监控大屏的数据源。
 *
 * 数据库变更通过管理员 SSE 通知刷新；查询按分页取全，汇总使用精确计数。
 *
 * 【完整内容】实时动态列表里最近 EVENT_LIMIT 条生成和对话，每一条都带完整的输入和结果
 * （点「看完整记录」看全文）。每条全文只从数据库读一次，之后每秒刷新只补新出现的记录（见 fillContent）。
 *
 * 【按角色裁剪】快照是共用的；返回前按当前管理员的权限裁剪（见 redactSnapshot）：
 * 没有 view_content 的看不到输入摘要和结果开头，没有 view_users 的看不到完整邮箱。
 */
export async function GET() {
  const admin = await requireAdminPermission('view_monitor');
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    /*
     * 快照的键 = 数据版本 + 时间片 + 心跳版本。
     * 数据库一变、有人新上线，键就变，立刻重算；时间片让「在线」「多久前」随时间自己过期。
     */
    const dbStart = Date.now();
    const revision = await readMonitorRevision(supabase).catch(() => null);
    const dbLatencyMs = Date.now() - dbStart;
    const key = `${revision ?? 'no-version'}|${Math.floor(Date.now() / SNAPSHOT_TTL_MS)}|${presenceRevision()}`;
    const payload = await snapshotForRevision(key, async () => {
    const now = Date.now();
    const presence = presenceSnapshot(now);
    const upper = new Date(now).toISOString();
    const since = new Date(Math.min(chinaDayStart(now), now - 24 * 60 * 60 * 1000)).toISOString();

    // 活跃窗口内的元数据分页取全（不带正文）。正文只补最近 EVENT_LIMIT 条。
    const [recentGenerations, usageMeta, orders, users, pendingReview, pendingPay, oldestAt, totalCount] = await Promise.all([
      readAllRows<RawGeneration>((from, to) => supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id')
        // 画布改稿（lib/result-versions）是用户改的稿子，不是一次生成，不算进生成统计
        .is('input_data->>canvasOf', null)
        .gte('created_at', since).lte('created_at', upper)
        .order('created_at', { ascending: false }).order('id').range(from, to)),
      readAllRows<RawUsage>((from, to) => supabase
        .from('usage_events')
        .select('id, user_id, feature, task_type, created_at')
        .gte('created_at', since).lte('created_at', upper)
        .order('created_at', { ascending: false }).order('id').range(from, to)),
      // 只取近 24 小时有变动的订单（创建、审核、上传凭证）；更早的待审单由下面的计数和最早待审时间覆盖
      readAllRows<RawOrder>((from, to) => supabase
        .from('payment_orders')
        .select(ORDER_COLS)
        .or(`created_at.gte.${since},reviewed_at.gte.${since},proof_uploaded_at.gte.${since}`)
        .order('created_at', { ascending: false }).order('id').range(from, to)),
      readAllUsersCached(supabase),
      countOrders('reviewing'),
      countOrders('pending'),
      oldestPendingAt(),
      totalGenerations(),
    ]);

    // 实时动态要的最近 EVENT_LIMIT 条生成：补齐完整内容（缓存里有的不再读）
    const eventGens = recentGenerations.slice(0, EVENT_LIMIT);
    await fillContent(generationContent, eventGens.map((g) => String(g.id)), async (ids) => {
      const res = await supabase
        .from('script_history')
        .select('id, user_id, task_type, created_at, work_id, input_data, result')
        // 改稿记录不是生成，动态里也不要（与元数据查询同样过滤）
        .is('input_data->>canvasOf', null)
        .in('id', ids);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as RawGeneration[];
    }, (g) => String(g.id));
    pruneContent(generationContent, eventGens.map((g) => String(g.id)));

    // 对话（自由对话）的提问和回答：同样只补最近 EVENT_LIMIT 条。detail 列是后加的，迁移没跑时退回没有内容
    const chatRows = usageMeta.filter((u) => u.feature === 'freeChat').slice(0, EVENT_LIMIT);
    await fillContent(usageDetailContent, chatRows.map((u) => String(u.id)), async (ids) => {
      const res = await supabase.from('usage_events').select('id, detail').in('id', ids);
      if (res.error) {
        if (['42703', 'PGRST204'].includes(res.error.code)) return [];
        throw new Error(res.error.message);
      }
      return (res.data ?? []) as { id: string; detail: unknown }[];
    }, (r) => String(r.id));
    pruneContent(usageDetailContent, chatRows.map((u) => String(u.id)));

    // 同一条记录有完整内容就用它；没有的（超过 EVENT_LIMIT 条的）只有元数据
    const generations = recentGenerations.map((g) => generationContent.get(String(g.id)) ?? g);
    const usage = usageMeta.map((u) => {
      const d = usageDetailContent.get(String(u.id));
      return d ? { ...u, detail: d.detail } : u;
    });

    // 会员和资料只查活跃的人（P0-4）：近 24 小时有生成、使用、心跳，或登录过的
    const activeIds = new Set<string>();
    for (const g of recentGenerations) if (g.user_id) activeIds.add(g.user_id);
    for (const u of usageMeta) if (u.user_id) activeIds.add(u.user_id);
    for (const id of presence.keys()) activeIds.add(id);
    const sinceMs = Date.parse(since);
    for (const u of users) if (u.last_sign_in_at && Date.parse(u.last_sign_in_at) >= sinceMs) activeIds.add(u.id ?? '');
    activeIds.delete('');
    const lookup = await lookupUsers(supabase, [...activeIds]);
    const profiles = [...lookup.profiles.values()].flat();
    const subscriptions = [...lookup.plans.values()];

    const workIds = [...new Set(eventGens.map((g) => g.work_id).filter((x): x is string => !!x))];
    const workRes = workIds.length ? await supabase.from('works').select('id, title, profile_id').in('id', workIds) : { data: [], error: null };
    if (workRes.error) throw new Error(workRes.error.message);
    const works = (workRes.data ?? []) as RawWork[];

    const dir = buildDirectory({
      users,
      profiles,
      subscriptions,
      works,
    });

    const todayGen = generations.filter((g) => isToday(g.created_at, now));
    const todayUsers = users.filter((u) => isToday(u.created_at, now));
    const todayOrders = orders.filter((o) => isToday(o.created_at, now));
    const active = activeUsers({ users, generations, usage, presence, dir, now });
    const oldestMs = oldestAt ? parseTime(oldestAt) : null;

    return {
      now: new Date(now).toISOString(),
      active,
      // 在线 = 这一刻工作台里有心跳（见 lib/presence），不是「最近有操作」
      onlineCount: active.filter((u) => u.online).length,
      // 系统状态（快照里的部分）：快照耗时、在线里还是旧版本页面的人数
      status: {
        snapshotMs: Date.now() - now,
        staleOnline: active.filter((u) => u.online && u.build !== '' && u.build !== APP_BUILD).length,
        oldestPendingMinutes: oldestMs === null ? null : Math.max(0, Math.floor((now - oldestMs) / 60000)),
      },
      today: {
        generations: todayGen.length,
        newUsers: todayUsers.length,
        orders: todayOrders.length,
        revenue: effectiveRevenue(orders.filter((o) => isToday(o.reviewed_at || o.created_at, now))),
      },
      totals: {
        users: users.length,
        generations: totalCount,
        // 待审订单是唯一需要他立刻动手的东西，单独拎出来
        pendingReview,
        pendingPay,
      },
      pulse: pulseByMinute(generations, now),
      byFeature: featureBreakdown(generations, now),
      // 动态列表：最近 EVENT_LIMIT 条生成和对话，都带完整内容；注册、订单另算
      events: buildEvents({
        generations: eventGens.map((g) => generationContent.get(String(g.id)) ?? g),
        usage,
        users,
        orders,
        dir,
        now,
      }).slice(0, EVENT_LIMIT),
    };
    });
    // 每次请求现取的部分：数据库延迟、运行时长、助理进行中的任务、生成排队、服务器版本（不进快照缓存）
    const shown = redactSnapshot(payload, {
      content: hasPermission(admin.role, 'view_content'),
      users: hasPermission(admin.role, 'view_users'),
    });
    return NextResponse.json(
      {
        ...shown,
        status: {
          ...shown.status,
          build: APP_BUILD,
          dbLatencyMs,
          uptimeSec: Math.round(process.uptime()),
          assistantRunning: runningJobCount(),
          generationSlots: slotStats(),
          serverNow: new Date().toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/monitor] 取数失败:', msg);
    // 明确报错，不返回空壳——大屏必须能看出"现在是拉不到数据"，
    // 而不是显示一片 0 让人以为真的没人用
    return NextResponse.json({ error: '监控数据读取失败：' + msg }, { status: 500 });
  }
}
