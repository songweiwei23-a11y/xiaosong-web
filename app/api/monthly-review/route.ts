import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/read-body';
import { createRateLimiter } from '@/lib/rate-limit';
import { readStoredInsight } from '@/lib/work-insight-load';
import { defaultReviewMonth, monthKeyCN, MONTH_KEY, reviewToMarkdown, rollbackReview, sanitizeEditedStrategy, type ReviewSlot } from '@/lib/monthly-review';
import { archiveReport, DIAGNOSIS_ARCHIVE_TASK, jobView, REVIEW_TASK_TYPE, startMonthlyReview } from '@/lib/monthly-review-run';

export const dynamic = 'force-dynamic';

/**
 * 月度复盘与策略卡（lib/monthly-review）。
 *   GET  ?profileId=            当前策略卡、最近 6 版、长期经验、复盘任务状态
 *   GET  ?profileId=&archive=review|diagnosis   历次复盘 / 历次账号诊断的永久存档（新到旧，最多 60 份）
 *   POST {profileId, action: 'run', month?, collectedText?, collectedSummary?}   开始复盘（后台跑，页面轮询 GET）
 *   POST {profileId, action: 'edit', strategy}    编导改策略卡
 *   POST {profileId, action: 'toggle', off}       关掉 / 打开策略卡
 *   POST {profileId, action: 'rollback', index}   退回历史里的某一版
 * 复盘不扣额度（2026-11-08 产品方），但每个账号一小时最多手动跑 6 次。
 */

const runLimit = createRateLimiter(60 * 60_000, 6);
const COLLECT_MAX = 120_000;

async function owns(userId: string, profileId: string): Promise<boolean> {
  if (!profileId) return false;
  const { data } = await getServiceSupabase().from('user_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  const params = new URL(request.url).searchParams;
  const profileId = params.get('profileId') ?? '';
  if (!(await owns(userId, profileId))) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });

  const archive = params.get('archive');
  if (archive === 'review' || archive === 'diagnosis') {
    const { data, error } = await getServiceSupabase()
      .from('script_history')
      .select('id, result, created_at, input_data')
      .eq('user_id', userId)
      .eq('task_type', archive === 'review' ? REVIEW_TASK_TYPE : DIAGNOSIS_ARCHIVE_TASK)
      .or(`input_data->>profileId.eq.${profileId},input_data->>profile_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) return NextResponse.json({ error: '暂时读不到存档，请稍后再试' }, { status: 503 });
    let rows = data ?? [];
    // 存档上线以前的那一份（作品概况那一行里的最新诊断 / 当前策略卡）：存档里没有就补存一份，以后都在存档里
    const row = (await readStoredInsight(userId, profileId).catch(() => null)) as (ReviewSlot & { diagnosis?: { report: string; generatedAt: string; materials: string[] } | null }) | null;
    const stamp = (r: { input_data: unknown }) => (r.input_data as Record<string, unknown> | null) ?? {};
    if (archive === 'diagnosis' && row?.diagnosis?.report && !rows.some((r) => stamp(r).generatedAt === row.diagnosis!.generatedAt)) {
      if (await archiveReport(userId, profileId, DIAGNOSIS_ARCHIVE_TASK, row.diagnosis.report, { materials: row.diagnosis.materials, generatedAt: row.diagnosis.generatedAt })) {
        rows = [{ id: 'current', result: row.diagnosis.report, created_at: row.diagnosis.generatedAt, input_data: { generatedAt: row.diagnosis.generatedAt } }, ...rows];
      }
    }
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, createdAt: r.created_at, result: String(r.result ?? ''), month: (r.input_data as Record<string, unknown> | null)?.month ?? null })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const row = (await readStoredInsight(userId, profileId).catch(() => null)) as ReviewSlot | null;
  return NextResponse.json({
    review: row?.review ?? null,
    history: row?.reviewHistory ?? [],
    memory: row?.reviewMemory ?? { verified: [], dropped: [] },
    job: jobView(row?.reviewJob, profileId),
    defaultMonth: defaultReviewMonth(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  let body: Record<string, unknown>;
  try { body = await readJsonBody(request, userId); } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }); }
  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!(await owns(userId, profileId))) return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });

  if (body.action === 'run') {
    const month = typeof body.month === 'string' && MONTH_KEY.test(body.month) ? body.month : defaultReviewMonth();
    if (month > (monthKeyCN(Date.now()) ?? month)) return NextResponse.json({ error: '还没到这个月，不能复盘' }, { status: 400 });
    if (runLimit(userId)) return NextResponse.json({ error: '复盘太频繁了，过一会儿再试' }, { status: 429 });
    const collectedText = typeof body.collectedText === 'string' ? body.collectedText.slice(0, COLLECT_MAX) : '';
    const collectedSummary = typeof body.collectedSummary === 'string' ? body.collectedSummary.slice(0, 200) : '';
    const r = await startMonthlyReview({ userId, profileId, month, source: 'manual', collectedText, collectedSummary });
    if (!r.started) return NextResponse.json({ error: r.reason }, { status: 409 });
    return NextResponse.json({ started: true, month }, { status: 202 });
  }

  const row = (await readStoredInsight(userId, profileId).catch(() => null)) as (ReviewSlot & Record<string, unknown>) | null;
  if (!row?.review && body.action !== 'rollback') return NextResponse.json({ error: '还没有策略卡，先复盘一次' }, { status: 400 });
  let next: (ReviewSlot & Record<string, unknown>) | null = null;
  if (body.action === 'edit') {
    const strategy = sanitizeEditedStrategy(body.strategy);
    if (!strategy) return NextResponse.json({ error: '「最该抓的一件事」不能空着' }, { status: 400 });
    next = { ...row!, review: { ...row!.review!, strategy, edited: true } };
  } else if (body.action === 'toggle') {
    next = { ...row!, review: { ...row!.review!, off: body.off === true } };
  } else if (body.action === 'rollback') {
    const index = typeof body.index === 'number' ? body.index : -1;
    next = row ? rollbackReview(row, index) : null;
    if (!next) return NextResponse.json({ error: '找不到要退回的那一版' }, { status: 404 });
  } else {
    return NextResponse.json({ error: '不认识的操作' }, { status: 400 });
  }
  const { error } = await getServiceSupabase()
    .from('account_work_insights')
    .upsert({ profile_id: profileId, user_id: userId, insight: next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (error) return NextResponse.json({ error: '没保存上，请稍后再试' }, { status: 503 });
  // 改过的那一版也另存一份：哪一版都找得回来
  if (body.action === 'edit' && next.review) await archiveReport(userId, profileId, REVIEW_TASK_TYPE, reviewToMarkdown(next.review), { month: next.review.month, source: 'edited', review: next.review });
  return NextResponse.json({ ok: true, review: next.review ?? null, history: next.reviewHistory ?? [] });
}
