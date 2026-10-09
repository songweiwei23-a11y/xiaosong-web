import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { readMetrics, summarizePerformance, type PerformanceRow } from '@/lib/performance'
import { SCRIPT_TYPE_LABELS } from '@/lib/creation-settings'

export const dynamic = 'force-dynamic'

/**
 * 数据回流的复盘（lib/performance）：这个号（profileId）录了数据的作品，
 * 连同它是哪种视频、用的哪种拍法（从作品的脚本 / 选题记录里取当时的创作设置）一起汇总。
 * 没传 profileId 就汇总这个人全部的。数据列还没建时返回空，不报错。
 */
export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const profileId = new URL(request.url).searchParams.get('profileId')

  let q = supabase.from('works').select('id, title, profile_id, metrics, published_at').eq('user_id', guard.userId!).not('metrics', 'is', null).order('published_at', { ascending: false }).limit(200)
  if (profileId) q = q.eq('profile_id', profileId)
  const { data: works, error } = await q
  if (error) return NextResponse.json({ ...summarizePerformance([]), unavailable: /metrics/.test(error.message) })
  if (!works?.length) return NextResponse.json(summarizePerformance([]))

  // 每条作品当时的创作设置：优先脚本那一步的，没有就用选题的
  const { data: items } = await supabase
    .from('script_history')
    .select('work_id, task_type, input_data, created_at')
    .eq('user_id', guard.userId!)
    .in('work_id', works.map((w) => w.id))
    .in('task_type', ['脚本生成', '选题策划'])
    .order('created_at', { ascending: false })
  // 记录按时间倒序：每条作品取最新的脚本设置；没有脚本才用最新的选题设置
  const settingsOf = new Map<string, { s: Record<string, unknown>; fromScript: boolean }>()
  for (const it of items ?? []) {
    const s = (it.input_data as Record<string, unknown> | null)?.creationSettings as Record<string, unknown> | undefined
    if (!s || !it.work_id) continue
    const had = settingsOf.get(it.work_id)
    const fromScript = it.task_type === '脚本生成'
    if (!had || (fromScript && !had.fromScript)) settingsOf.set(it.work_id, { s, fromScript })
  }

  const rows: PerformanceRow[] = works.flatMap((w) => {
    const metrics = readMetrics(w.metrics)
    if (!metrics) return []
    const s = settingsOf.get(w.id)?.s ?? {}
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    return [{ title: w.title, purpose: str(s.purpose), tactic: str(s.tactic), scriptType: str(s.scriptType) ? SCRIPT_TYPE_LABELS[str(s.scriptType)!] ?? str(s.scriptType) : null, metrics, platform: metrics.platform || str(s.platform), publishedAt: w.published_at }]
  })
  return NextResponse.json(summarizePerformance(rows))
}
