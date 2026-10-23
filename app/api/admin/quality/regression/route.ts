import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth'
import { runRegression } from '@/lib/quality-regression'
import { getRunState, startRun } from '@/lib/quality-regression-run'
import { manualRunBlock } from '@/lib/quality-run-guard'
import { diffRuns, groupRuns, type QualityRow } from '@/lib/quality-checks'
import { newFailureText, sendQualityAlert } from '@/lib/quality-alert'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 定时任务带的暗号（服务器 .env.local 里的 QUALITY_CRON_SECRET）；没配就只认管理员 */
function cronAuthorized(request: Request): boolean {
  const secret = process.env.QUALITY_CRON_SECRET || ''
  const got = request.headers.get('x-cron-secret') || ''
  if (secret.length < 16 || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

/** 夜间回归有新增失败时发告警（和上一次夜间回归比；持续失败不重复提醒） */
async function alertNewFailures(db: ReturnType<typeof getServiceSupabase>) {
  try {
    const since = new Date(Date.now() - 3 * 864e5).toISOString()
    const { data } = await db
      .from('quality_checks')
      .select('id, task_type, source, passed, issues, sample, created_at')
      .eq('source', 'nightly')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    const runs = groupRuns((data ?? []) as QualityRow[], 'nightly')
    if (runs.length === 0) return
    const diff = diffRuns(runs[0], runs[1] ?? null)
    if (diff.newFailures.length) await sendQualityAlert(newFailureText(diff, runs[0].at))
  } catch (e) {
    console.warn('[quality] 告警判断失败:', (e as Error).message)
  }
}

/** 跑一遍回归并把结果写进 quality_checks。夜间和手动分开记（source 不同），看板上分开看 */
async function runAndStore(source: 'nightly' | 'manual') {
  const outcomes = await runRegression()
  const db = getServiceSupabase()
  const { error } = await db.from('quality_checks').insert(outcomes.map((o) => ({
    task_type: o.task,
    source,
    passed: o.result.passed && !o.error,
    // 没跑成（Dify 出错、超时）：记成不通过，但 issues 里是 error 类，看板上单独计数、不计入通过率
    issues: o.result.issues,
    sample: o.error ? `没跑成：${o.error}` : o.sample,
  })))
  if (error) console.warn('[quality] 回归结果记录失败:', error.message)
  if (source === 'nightly' && !error) await alertNewFailures(db)
  return {
    stored: !error,
    passed: outcomes.filter((o) => o.result.passed && !o.error).length,
    total: outcomes.length,
    outcomes,
  }
}

/** 最近 24 小时内手动回归的完成时间（每一次在库里是一批同样的 created_at） */
async function recentManualRunTimes(): Promise<string[]> {
  const since = new Date(Date.now() - 864e5).toISOString()
  const { data, error } = await getServiceSupabase()
    .from('quality_checks')
    .select('created_at')
    .eq('source', 'manual')
    .gte('created_at', since)
    .limit(1000)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => r.created_at as string))]
}

/*
 * 手动回归改为后台运行（2026-10-10 巡检 M3）。
 * 原来 POST 要等约 3 分钟才返回，中途被反向代理断开，管理员就只看到「运行失败」。
 * 现在：管理员 POST 立即返回 202，服务端在后台跑；页面轮询 GET 看进度。
 * 定时任务（带暗号）仍然同步跑完再返回，因为夜间脚本要把结果写进日志。
 */
export async function GET() {
  const admin = await requireAdminPermission('view_quality')
  if (!admin) return NextResponse.json({ error: '无权查看' }, { status: 403 })
  return NextResponse.json(getRunState() ?? { status: 'idle' }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  // 定时任务：同步跑完，把结果直接返回给脚本（夜间不节流）
  if (cronAuthorized(request)) {
    const { stored, outcomes } = await runAndStore('nightly')
    return NextResponse.json({
      stored,
      outcomes: outcomes.map((o) => ({ task: o.task, passed: o.result.passed && !o.error, issues: o.result.issues, error: o.error })),
    })
  }

  const admin = await requireAdminPermission('manage_quality')
  if (!admin) return NextResponse.json({ error: '无权运行' }, { status: 403 })

  // 手动回归每次约 10 次模型调用：正在跑时直接返回那一次的状态；否则先看冷却和当日上限
  if (getRunState()?.status !== 'running') {
    let block: string | null
    try {
      block = manualRunBlock(await recentManualRunTimes(), Date.now())
    } catch {
      return NextResponse.json({ error: '读取手动回归记录失败，先不跑' }, { status: 500 })
    }
    if (block) return NextResponse.json({ error: block }, { status: 429 })
  }

  const { run } = startRun(() => runAndStore('manual'))
  return NextResponse.json(run, { status: 202 })
}
