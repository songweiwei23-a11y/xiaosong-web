import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth'
import { runRegression } from '@/lib/quality-regression'
import { getRunState, startRun } from '@/lib/quality-regression-run'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 定时任务带的暗号（服务器 .env.local 里的 QUALITY_CRON_SECRET）；没配就只认管理员 */
function cronAuthorized(request: Request): boolean {
  const secret = process.env.QUALITY_CRON_SECRET || ''
  const got = request.headers.get('x-cron-secret') || ''
  if (secret.length < 16 || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

/** 跑一遍回归并把结果写进 quality_checks（source = nightly） */
async function runAndStore() {
  const outcomes = await runRegression()
  const db = getServiceSupabase()
  const { error } = await db.from('quality_checks').insert(outcomes.map((o) => ({
    task_type: o.task,
    source: 'nightly',
    passed: o.result.passed && !o.error,
    // 没跑成（Dify 出错、超时）：记成不通过，原因写在样例里，看板上能看到
    issues: o.result.issues,
    sample: o.error ? `没跑成：${o.error}` : o.sample,
  })))
  if (error) console.warn('[quality] 回归结果记录失败:', error.message)
  return {
    stored: !error,
    passed: outcomes.filter((o) => o.result.passed && !o.error).length,
    total: outcomes.length,
    outcomes,
  }
}

/*
 * 手动回归改为后台运行（2026-10-10 巡检 M3）。
 * 原来 POST 要等约 3 分钟才返回，中途被反向代理断开，管理员就只看到「运行失败」。
 * 现在：管理员 POST 立即返回 202，服务端在后台跑；页面轮询 GET 看进度。
 * 定时任务（带暗号）仍然同步跑完再返回，因为夜间脚本要把结果写进日志。
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权查看' }, { status: 403 })
  return NextResponse.json(getRunState() ?? { status: 'idle' }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  // 定时任务：同步跑完，把结果直接返回给脚本
  if (cronAuthorized(request)) {
    const { stored, outcomes } = await runAndStore()
    return NextResponse.json({
      stored,
      outcomes: outcomes.map((o) => ({ task: o.task, passed: o.result.passed && !o.error, issues: o.result.issues, error: o.error })),
    })
  }

  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权运行' }, { status: 403 })

  // 已经在跑时 startRun 不会重复开，返回的是那一次的状态；两种情况都是 202「已接受，在后台跑」
  const { run } = startRun(() => runAndStore())
  return NextResponse.json(run, { status: 202 })
}
