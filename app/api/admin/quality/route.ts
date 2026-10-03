import { NextResponse } from 'next/server'
import { requireAdmin, getServiceSupabase } from '@/lib/admin-auth'
import { summarizeQuality, type QualityRow } from '@/lib/quality-checks'

export const dynamic = 'force-dynamic'

/** 后台质检看板：近 N 天（默认 7）的体检记录汇总（lib/quality-checks 的 summarizeQuality） */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  const days = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 7))
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await getServiceSupabase()
    .from('quality_checks')
    .select('task_type, source, passed, issues, sample, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) {
    // 表还没建：看板上明说，不显示一片 0
    return NextResponse.json({ error: /quality_checks/.test(error.message) ? '质检记录表还没建：请运行 supabase/migrations/20261003_quality_checks.sql' : '读取失败：' + error.message }, { status: 500 })
  }
  return NextResponse.json({ days, ...summarizeQuality((data ?? []) as QualityRow[]) })
}
