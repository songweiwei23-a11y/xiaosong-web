import { NextResponse } from 'next/server'
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth'
import { summarizeQuality, type QualityRow } from '@/lib/quality-checks'
import { ruleStats } from '@/lib/quality-feedback'

export const dynamic = 'force-dynamic'

const SOURCES = ['live', 'nightly', 'manual', 'all']

/**
 * 后台质检看板：近 N 天（默认 7）的记录汇总。
 * source：live（默认，实时体检）/ nightly（夜间回归）/ manual（手动回归）/ all；task 可按板块筛。
 */
export async function GET(request: Request) {
  const admin = await requireAdminPermission('view_quality')
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  const sp = new URL(request.url).searchParams
  const days = Math.min(30, Math.max(1, Number(sp.get('days')) || 7))
  const sourceParam = sp.get('source') ?? 'live'
  const source = SOURCES.includes(sourceParam) ? sourceParam : 'live'
  const task = sp.get('task')?.slice(0, 60) || undefined
  const since = new Date(Date.now() - days * 864e5).toISOString()

  const db = getServiceSupabase()
  const { data, error } = await db
    .from('quality_checks')
    .select('id, task_type, source, passed, issues, sample, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) {
    // 表还没建：看板上明说，不显示一片 0
    return NextResponse.json({ error: /quality_checks/.test(error.message) ? '质检记录表还没建：请运行 supabase/migrations/20261003_quality_checks.sql' : '读取失败：' + error.message }, { status: 500 })
  }
  const rows = (data ?? []) as QualityRow[]
  const summary = summarizeQuality(rows, { source, task })

  // 误报标记：表还没建时照常出统计，只是没有误报率（feedbackReady 为 false）
  const fb = await db.from('quality_feedback').select('rule_key, verdict').gte('created_at', since).limit(5000)
  const feedbackReady = !fb.error
  const feedback = (fb.data ?? []) as { rule_key: string; verdict: string }[]

  return NextResponse.json({ days, ...summary, rules: ruleStats(rows, feedback).slice(0, 30), feedbackReady })
}
