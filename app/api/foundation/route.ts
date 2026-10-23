import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServiceSupabase } from '@/lib/admin-auth'
import { PROFILE_UUID } from '@/lib/profile-history'
import { runAnyBoard } from '@/lib/assistant/board-dispatch'
import { readInternal, type BoardContext } from '@/lib/assistant/boards'
import { ADVICE_PURPOSES, ADVICE_STAGES } from '@/lib/industry-advice'
import { saveFoundationRow } from '@/lib/foundation-save'
import {
  createFoundation,
  getFoundation,
  missingKeys,
  quotaVerdict,
  runFoundation,
  runningFoundation,
  FOUNDATION_TYPES,
  type FoundationJob,
} from '@/lib/foundation-job'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 返回给界面的样子：只给进度，不给内部字段 */
function publicJob(job: FoundationJob) {
  return {
    id: job.id,
    profileId: job.profileId,
    status: job.status,
    steps: job.steps.map((s) => ({ key: s.key, label: s.label, status: s.status, error: s.error })),
  }
}

/**
 * 一键生成地基：同一个档案已经在跑就直接返回那一次的进度（重复点击、刷新后重新挂上，都不会多花额度）。
 * 只生成缺的项；额度不够时不启动，也不扣任何次数。
 */
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const userId = guard.userId!

  const body = (await request.json().catch(() => null)) as { profileId?: unknown; purpose?: unknown; stage?: unknown } | null
  const profileId = typeof body?.profileId === 'string' ? body.profileId : ''
  if (!PROFILE_UUID.test(profileId)) return NextResponse.json({ error: '档案编号不正确' }, { status: 400 })

  const db = getServiceSupabase()
  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: '档案暂时读不到，请稍后再试' }, { status: 503 })
  if (!profile) return NextResponse.json({ error: '档案不存在' }, { status: 404 })

  const running = runningFoundation(userId, profileId)
  if (running) return NextResponse.json({ job: publicJob(running) }, { status: 202 })

  const { data: rows, error: rowsError } = await db
    .from('account_positioning')
    .select('positioning_type')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
  if (rowsError) return NextResponse.json({ error: '地基进度暂时读不到，请稍后再试' }, { status: 503 })
  const existing = [...new Set((rows ?? []).map((r) => r.positioning_type as string))]

  const keys = missingKeys(existing)
  if (keys.length === 0) return NextResponse.json({ alreadyDone: true, job: null })

  // 行业建议要先有目的和阶段：界面会带上，这里再校验一次
  const purpose = typeof body?.purpose === 'string' ? body.purpose : 'staged'
  const stage = typeof body?.stage === 'string' ? body.stage : 'start'
  if (keys.includes('advice') && (!ADVICE_PURPOSES.some((p) => p.key === purpose) || !ADVICE_STAGES.some((s) => s.key === stage))) {
    return NextResponse.json({ error: '行业建议的目的或阶段不对' }, { status: 400 })
  }
  const advice = { purpose, stage }

  const ctx: BoardContext = { userId, cookie: request.headers.get('cookie') ?? '', profileId }
  let remaining: number | null = null
  try {
    const quota = (await readInternal(ctx, '/api/quota/check')) as { features?: { feature: string; remaining: number }[] }
    remaining = quota.features?.find((f) => f.feature === 'positioning')?.remaining ?? null
  } catch {
    remaining = null
  }
  const verdict = quotaVerdict(keys.length, remaining)
  if (!verdict.ok) return NextResponse.json({ error: verdict.message }, { status: 402 })

  const job = createFoundation(userId, profileId, keys)
  void runFoundation(
    job,
    {
      existingTypes: existing,
      runBoard: (board) => runAnyBoard(ctx, board),
      save: (kind, text) => saveFoundationRow({ userId, profileId, kind, text }),
    },
    advice,
  ).catch((e: Error) => {
    job.status = 'error'
    job.finishedAt = Date.now()
    console.error('[foundation] 地基生成出错:', e.message)
  })

  return NextResponse.json({ job: publicJob(job) }, { status: 202 })
}

/** 查进度：?jobId=。只能看自己的任务 */
export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const jobId = new URL(request.url).searchParams.get('jobId') ?? ''
  const job = getFoundation(jobId, guard.userId!)
  if (!job) return NextResponse.json({ error: '没有找到这次的地基生成' }, { status: 404 })
  return NextResponse.json({ job: publicJob(job), labels: FOUNDATION_TYPES }, { headers: { 'Cache-Control': 'no-store' } })
}
