import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth'
import { runRegression } from '@/lib/quality-regression'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 定时任务带的暗号（服务器 .env.local 里的 QUALITY_CRON_SECRET）；没配就只认管理员 */
function cronAuthorized(request: Request): boolean {
  const secret = process.env.QUALITY_CRON_SECRET || ''
  const got = request.headers.get('x-cron-secret') || ''
  if (secret.length < 16 || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

/**
 * 每晚回归（lib/quality-regression）：服务器定时任务每晚 3 点调一次；管理员也能在质检看板上手动点。
 * 串行跑固定代表性用例，结果记进 quality_checks（source = 'nightly'）。
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request) && !(await requireAdmin())) {
    return NextResponse.json({ error: '无权运行' }, { status: 403 })
  }
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
  return NextResponse.json({ stored: !error, outcomes: outcomes.map((o) => ({ task: o.task, passed: o.result.passed && !o.error, issues: o.result.issues, error: o.error })) })
}
