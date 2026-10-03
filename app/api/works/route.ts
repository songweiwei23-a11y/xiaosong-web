import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { STAGE_ORDER, OPTIONAL_STAGES } from '@/lib/resume'

export const dynamic = 'force-dynamic'

/*
 * 环节清单从 lib/resume 取，前端画进度、算下一步用的是同一份。
 * 这里原来自己写了一份，lib/works.ts 里又写了一份，注释里写着"保持一致"——靠人记。
 */

/**
 * 选题这一步永远算做完：作品就是"从一批选题里挑定了这一条"才建的，标题本身就是选题。
 * 原来按"有没有挂着选题记录"算，而选题那一批从来不挂到作品上，于是永远是"没做"——
 * 侧边栏「进行中」每一条都显示"下一步：选题策划"，点进去永远回到选题页。
 */
function stageDone(stage: string, done: string[]): boolean {
  return stage === '选题策划' || done.includes(stage)
}

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

    // input_data 也要带上：续作时要知道当时用的打法、时长这些，不只是正文
    const { data: items } = await supabase
      .from('script_history')
      .select('id, task_type, result, input_data, created_at')
      .eq('work_id', id)
      .eq('user_id', guard.userId!)
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
    .eq('user_id', guard.userId!)
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
        stages: STAGE_ORDER.map((s) => ({ name: s, done: stageDone(s, done) })),
        doneCount: STAGE_ORDER.filter((s) => stageDone(s, done)).length,
        // 可选环节（开篇）：能挂、能打开，但不算进度
        optional: OPTIONAL_STAGES.map((s) => ({ name: s, done: done.includes(s) })),
      }
    })
  )
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const body = await request.json()
  const title = String(body.title || '未命名作品').trim().slice(0, 60)
  const profileId = body.profileId || null

  /*
   * 同一个选题已经有进行中的作品，就复用它，不再新建。
   *
   * 线上出过：「20年前濮阳老板怎么招客？看完我笑了」06:52 建了一次、
   * 06:57 又建了一次。原因是离开脚本页再回来，页面恢复了上次的脚本正文，
   * 却没恢复它属于哪个作品——再点生成，就又建了一个同名作品。
   * 页面那边也补了（恢复时连作品一起恢复），这里再兜一层：
   * 从选题清单里对同一条点两次"写脚本"，也只会有一个作品。
   *
   * "未命名"不参与复用——那不是同一条内容，只是都没起名字。
   */
  if (title !== '未命名作品' && title !== '未命名脚本') {
    let q = supabase
      .from('works')
      .select('*')
      .eq('user_id', guard.userId!)
      .eq('title', title)
      .eq('is_done', false)
      .order('updated_at', { ascending: false })
      .limit(1)
    q = profileId ? q.eq('profile_id', profileId) : q.is('profile_id', null)
    const { data: existing } = await q
    if (existing?.[0]) {
      await supabase
        .from('works')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
        .eq('user_id', guard.userId!)
      return NextResponse.json({ ...existing[0], reused: true })
    }
  }

  const { data, error } = await supabase
    .from('works')
    .insert({ user_id: guard.userId!, profile_id: profileId, title })
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
  /*
   * 落地状态（2026-10-02）：拍没拍、发没发。原来作品只记到"标题封面做完"，
   * 之后系统就不知道了——「创作进度」里没法提醒"脚本好了还没拍"。
   */
  if (['none', 'shot', 'published'].includes(body.shootStatus)) {
    patch.shoot_status = body.shootStatus
    const now = new Date().toISOString()
    if (body.shootStatus === 'none') { patch.shot_at = null; patch.published_at = null }
    if (body.shootStatus === 'shot') { patch.shot_at = now; patch.published_at = null }
    if (body.shootStatus === 'published') patch.published_at = now
  }

  const { data, error } = await supabase
    .from('works')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select()
    .maybeSingle()

  if (error) {
    if (/shoot_status|shot_at|published_at/.test(error.message)) {
      return NextResponse.json({ error: '拍摄状态还没启用：请先在 Supabase 执行 20261002_library_and_progress.sql' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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
