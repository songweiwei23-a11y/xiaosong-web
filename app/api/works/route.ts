import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/** 作品里可能出现的环节，顺序即创作流程 */
const STAGE_ORDER = ['选题策划', '脚本生成', '分镜脚本', '审稿优化', '标题封面'] as const

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20

  // 单个作品：连同它的全部环节一起返回
  if (id) {
    const { data: work, error } = await supabase
      .from('works')
      .select('*')
      .eq('id', id)
      .eq('user_id', guard.userId!)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!work) return NextResponse.json({ error: '作品不存在' }, { status: 404 })

    const { data: items } = await supabase
      .from('script_history')
      .select('id, task_type, result, created_at')
      .eq('work_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ ...work, items: items ?? [] })
  }

  // 列表：一次把这些作品的环节全查出来再归组，
  // 逐个作品查一次会变成 N+1 次请求，列表越长越慢
  const { data: works, error } = await supabase
    .from('works')
    .select('*')
    .eq('user_id', guard.userId!)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!works || works.length === 0) return NextResponse.json([])

  const { data: items } = await supabase
    .from('script_history')
    .select('id, work_id, task_type, created_at')
    .in('work_id', works.map((w) => w.id))

  const byWork = new Map<string, string[]>()
  for (const it of items ?? []) {
    if (!it.work_id) continue
    const list = byWork.get(it.work_id) ?? []
    if (!list.includes(it.task_type)) list.push(it.task_type)
    byWork.set(it.work_id, list)
  }

  return NextResponse.json(
    works.map((w) => {
      const done = byWork.get(w.id) ?? []
      return {
        ...w,
        // 按流程顺序返回，前端直接照着画进度，不用自己排
        stages: STAGE_ORDER.map((s) => ({ name: s, done: done.includes(s) })),
        doneCount: STAGE_ORDER.filter((s) => done.includes(s)).length,
      }
    })
  )
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const body = await request.json()

  const { data, error } = await supabase
    .from('works')
    .insert({
      user_id: guard.userId!,
      profile_id: body.profileId || null,
      title: (body.title || '未命名作品').slice(0, 60),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少作品 ID' }, { status: 400 })

  const body = await request.json()

  // 只更新明确给出的字段：环节保存时会频繁调这里刷新 updated_at，
  // 若把未传的字段一律写成默认值，会把用户改过的标题冲掉
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.slice(0, 60)
  if (typeof body.isDone === 'boolean') patch.is_done = body.isDone
  if (body.profileId !== undefined) patch.profile_id = body.profileId || null

  const { data, error } = await supabase
    .from('works')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '作品不存在或无权限' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少作品 ID' }, { status: 400 })

  // 环节记录不删，只断开关联——那条脚本本身仍然有价值，
  // 用户可能只是不想再按作品组织它
  const { error } = await supabase
    .from('works')
    .delete()
    .eq('id', id)
    .eq('user_id', guard.userId!)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
