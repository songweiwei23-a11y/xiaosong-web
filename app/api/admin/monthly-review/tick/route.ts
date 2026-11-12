import { NextResponse } from 'next/server';
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth';
import { cronRequestAuthorized } from '@/lib/cron-auth';
import { previousMonthCN, worksInMonth, MONTH_KEY, type ReviewSlot } from '@/lib/monthly-review';
import { readStoredInsight } from '@/lib/work-insight-load';
import { reviewRunning, runMonthlyReview } from '@/lib/monthly-review-run';

export const dynamic = 'force-dynamic';

/**
 * 每月 1 号的自动复盘（2026-11-08 产品方定：每月 1 号自动跑 + 页面可手动）。
 * 服务器 crontab 调用 scripts/review-cron-tick.sh。端口从 Nginx upstream 片段读取，不写死。
 * 给上个月有作品动静（建了、拍了或发了）的档案各复盘一次；已经复盘过上个月的跳过（同一天重复调用不会重复花钱）。
 * 一个一个跑（和线上共用模型余额）；连续失败 3 次就停，免得把余额或接口打穿（见每晚质检的教训）。
 * 立刻返回要跑多少个，跑的过程在后台，结果看服务日志（[monthly-review/tick]）。
 */

const MAX_PROFILES = 300;
let busy = false;

export async function POST(request: Request) {
  if (!cronRequestAuthorized(request, 'REVIEW_CRON_SECRET')) {
    const admin = await requireAdminPermission('view_monitor');
    if (!admin) return NextResponse.json({ error: '需要管理员权限或定时任务密钥' }, { status: 403 });
  }
  if (busy) return NextResponse.json({ error: '上一轮自动复盘还在跑' }, { status: 409 });
  const param = new URL(request.url).searchParams.get('month');
  const month = param && MONTH_KEY.test(param) ? param : previousMonthCN();
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 8 * 3600_000).toISOString();

  const { data, error } = await getServiceSupabase()
    .from('works')
    .select('user_id, profile_id, created_at, shot_at, published_at')
    .not('profile_id', 'is', null)
    .or(`created_at.gte.${start},shot_at.gte.${start},published_at.gte.${start}`)
    .limit(20000);
  if (error) return NextResponse.json({ error: '读不到作品：' + error.message }, { status: 500 });
  const targets = new Map<string, string>();
  for (const w of worksInMonth(data ?? [], month)) if (w.profile_id && w.user_id) targets.set(w.profile_id, w.user_id);
  const list = [...targets.entries()].slice(0, MAX_PROFILES);

  busy = true;
  void (async () => {
    let done = 0, skipped = 0, failed = 0, streak = 0;
    try {
      for (const [profileId, userId] of list) {
        const row = (await readStoredInsight(userId, profileId).catch(() => null)) as ReviewSlot | null;
        if (row?.review?.month === month || reviewRunning(profileId)) { skipped++; continue; }
        try {
          await runMonthlyReview({ userId, profileId, month, source: 'auto' });
          done++; streak = 0;
        } catch (e) {
          failed++; streak++;
          console.error('[monthly-review/tick] 复盘失败', profileId, (e as Error).message);
          if (streak >= 3) { console.error('[monthly-review/tick] 连续失败 3 次，停止本轮'); break; }
        }
      }
    } finally {
      busy = false;
      console.log(`[monthly-review/tick] ${month} 完成：复盘 ${done}，跳过 ${skipped}，失败 ${failed}，共 ${list.length}`);
    }
  })();
  return NextResponse.json({ month, profiles: list.length, started: true }, { status: 202 });
}
