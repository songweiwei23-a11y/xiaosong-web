import { NextResponse } from 'next/server'
import { getServiceSupabase, requireAdminPermission } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** 管理员标记一条提醒：误报，或者确认有问题。按规则统计误报率（lib/quality-feedback） */
export async function POST(request: Request) {
  const admin = await requireAdminPermission('manage_quality')
  if (!admin) return NextResponse.json({ error: '无权标记' }, { status: 403 })
  const body = (await request.json().catch(() => null)) as { ruleKey?: unknown; taskType?: unknown; verdict?: unknown } | null
  const ruleKey = typeof body?.ruleKey === 'string' ? body.ruleKey.slice(0, 80) : ''
  const taskType = typeof body?.taskType === 'string' ? body.taskType.slice(0, 60) : ''
  const verdict = body?.verdict === 'false_positive' || body?.verdict === 'true_positive' ? body.verdict : null
  if (!ruleKey || !taskType || !verdict) return NextResponse.json({ error: '标记内容不完整' }, { status: 400 })

  const { error } = await getServiceSupabase().from('quality_feedback').insert({
    task_type: taskType,
    rule_key: ruleKey,
    rule_kind: ruleKey.split('|')[0],
    verdict,
    admin_id: admin.userId,
  })
  if (error) {
    return NextResponse.json({
      error: /quality_feedback/.test(error.message)
        ? '误报标记表还没建：请先运行 supabase/migrations/20261023_quality_feedback.sql'
        : '保存失败：' + error.message,
    }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
