import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServiceSupabase } from '@/lib/admin-auth'
import { createRateLimiter } from '@/lib/rate-limit'
import { readJsonBody } from '@/lib/read-body'
import { sanitizeQualityReport } from '@/lib/quality-checks'

export const dynamic = 'force-dynamic'

const limited = createRateLimiter(60 * 60_000, 200)

/**
 * 浏览器每次生成完体检一遍，结果报到这里记一笔（lib/quality-checks）。
 * 记不上（表还没建、数据库忙）就算了：体检是给后台看趋势的，不能影响用户。
 */
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  if (limited(guard.userId!)) return NextResponse.json({ stored: false })
  const body = await readJsonBody(request, guard.userId).catch(() => null)
  const row = sanitizeQualityReport(body)
  if (!row) return NextResponse.json({ error: '体检数据不完整' }, { status: 400 })
  const { error } = await getServiceSupabase().from('quality_checks').insert({ ...row, user_id: guard.userId, source: 'live' })
  if (error) console.warn('[quality] 记录失败（表可能还没建）:', error.message)
  return NextResponse.json({ stored: !error })
}
