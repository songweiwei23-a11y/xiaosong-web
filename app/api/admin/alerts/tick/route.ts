import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { cronRequestAuthorized } from '@/lib/cron-auth';
import { alertConfig, dueAlerts, evaluateAlerts, medianOf, sendAlert, thresholdsFromEnv, type AlertFacts } from '@/lib/alerts';
import { readMonitorRevision } from '@/lib/admin-monitor-data';
import { slotStats } from '@/lib/generation-slots';
import { parseTime } from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/** 同一条规则 30 分钟内只推一次（进程内记录；重启后会重新推一次，可接受） */
const lastFired = new Map<string, number>();

/**
 * 告警检查（后台扩展方案 P1-4）。由服务器 crontab 每分钟调用一次：
 *   curl -H "x-cron-secret: $ALERT_CRON_SECRET" http://127.0.0.1:3000/api/admin/alerts/tick
 * 管理员（需要 view_monitor）也可以手动调用，同样按规则检查和推送。
 */
export async function GET(request: Request) {
  const byCron = cronRequestAuthorized(request, 'ALERT_CRON_SECRET');
  if (!byCron) {
    const admin = await requireAdminPermission('view_monitor');
    if (!admin) return NextResponse.json({ error: '需要管理员权限或定时任务密钥' }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    // 三次采样取中位数：单次偶发的冷启动或网络抖动不会触发告警（服务器到数据库本身有 ~0.9 秒的往返，见 lib/alerts）
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await readMonitorRevision(supabase);
      samples.push(Date.now() - t0);
    }
    const dbLatencyMs = Math.round(medianOf(samples));

    const [pending, oldest] = await Promise.all([
      supabase.from('payment_orders').select('id', { count: 'exact', head: true }).eq('status', 'reviewing'),
      supabase.from('payment_orders').select('proof_uploaded_at, created_at').eq('status', 'reviewing').order('proof_uploaded_at', { ascending: true }).limit(1),
    ]);
    if (pending.error || pending.count === null) throw new Error(pending.error?.message || '待审订单读取失败');
    if (oldest.error) throw new Error(oldest.error.message);
    const row = oldest.data?.[0];
    const oldestAt = row ? (row.proof_uploaded_at ?? row.created_at ?? null) : null;
    const oldestMs = oldestAt ? parseTime(oldestAt) : null;

    const facts: AlertFacts = {
      dbLatencyMs,
      pendingReview: pending.count,
      oldestPendingMinutes: oldestMs === null ? null : Math.max(0, (Date.now() - oldestMs) / 60000),
      generationQueued: slotStats().queued,
    };
    const hits = evaluateAlerts(facts, thresholdsFromEnv());
    const due = dueAlerts(hits, lastFired);

    const cfg = alertConfig();
    let sent = 0;
    for (const h of due) {
      if (cfg && (await sendAlert(h))) sent++;
      else console.warn('[alerts] 命中但未推送（未配置或推送失败）:', h.id);
    }
    return NextResponse.json({
      checked: true,
      facts,
      hits: hits.map((h) => h.id),
      pushed: sent,
      webhookConfigured: !!cfg,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[alerts/tick] 检查失败:', msg);
    return NextResponse.json({ error: '告警检查没有完成：' + msg }, { status: 500 });
  }
}
