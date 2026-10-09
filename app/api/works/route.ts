import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { STAGE_ORDER, OPTIONAL_STAGES } from '@/lib/resume'
import { readMetrics } from '@/lib/performance'
import { fetchAllPages } from '@/lib/db-pages'
import { DEFAULT_PROFILE_SCOPE, PROFILE_UUID } from '@/lib/profile-history'

export const dynamic = 'force-dynamic'

/*
 * 环节清单从 lib/resume 取，前端画进度、算下一步用的是同一份。
 * 这里原来自己写了一份，lib/works.ts 里又写了一份，注释里写着"保持一致"——靠人记。
 */

/**
 * 选题这一步永远算做完：作品就是"从一批选题里挑定了这一条"才建的，标题本身就是选题。
 * 原来按"有没有挂着选题记录"算，而选题那一批从来不挂到作品上，于是永远是"没做"——
 * 顶栏「进行中」每一条都显示"下一步：选题策划"，点进去永远回到选题页。
 */
function stageDone(stage: string, done: string[]): boolean {
  return stage === '选题策划' || done.includes(stage)
}

/** 创作进度的分组，和 lib/works 的 progressGroup 同一口径 */
type WorkGroup = 'active' | 'toShoot' | 'shot' | 'published'
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase 查询链
const GROUPS: Record<WorkGroup, (q: any) => any> = {
  active: (q) => q.eq('shoot_status', 'none').eq('is_done', false),
  toShoot: (q) => q.eq('shoot_status', 'none').eq('is_done', true),
  shot: (q) => q.eq('shoot_status', 'shot'),
  published: (q) => q.eq('shoot_status', 'published'),
}

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20
  /*
   * 按档案隔离（2026-10-04 产品方：「档案 1 生成的内容只在档案 1 里，档案 2 看不到」）。
   * ?profileId=档案编号 只看这个档案的作品；?profileId=default 只看没挂档案的旧作品；不传是全部（单条读取、导出这类用）。
   */
  const scopeRaw = searchParams.get('profileId')
  if (scopeRaw && scopeRaw !== DEFAULT_PROFILE_SCOPE && !PROFILE_UUID.test(scopeRaw)) return NextResponse.json({ error: '档案编号不正确' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase 查询链
  const byProfile = <T,>(q: T): T => (!scopeRaw ? q : scopeRaw === DEFAULT_PROFILE_SCOPE ? (q as any).is('profile_id', null) : (q as any).eq('profile_id', scopeRaw))

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

  /*
   * 各组数量（2026-10-04）：创作进度页顶部的「创作中 / 待拍摄 / 已拍摄 / 已发布」。
   * 原来是把最近 50 条取回来在浏览器里数，第 51 条以后的作品既看不到也不算数。现在用数据库计数。
   */
  if (searchParams.get('counts') === '1') {
    const head = () => byProfile(supabase.from('works').select('id', { count: 'exact', head: true }).eq('user_id', guard.userId!))
    const rs = await Promise.all((Object.keys(GROUPS) as WorkGroup[]).map((g) => GROUPS[g](head())))
    const bad = rs.find((r) => r.error)
    if (bad?.error) {
      if (/shoot_status/.test(bad.error.message)) return NextResponse.json({ error: '拍摄状态还没启用：请先在 Supabase 执行 20261002_library_and_progress.sql' }, { status: 503 })
      return NextResponse.json({ error: bad.error.message }, { status: 500 })
    }
    const counts = Object.fromEntries((Object.keys(GROUPS) as WorkGroup[]).map((g, i) => [g, rs[i].count ?? 0]))
    return NextResponse.json({ ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0) })
  }

  // 列表：一次把这些作品的环节全查出来再归组，
  // 逐个作品查一次会变成 N+1 次请求，列表越长越慢。
  // ?offset= 翻页、?group= 只看某一组（2026-10-04），不再只给最近 50 条
  const offsetRaw = Number(searchParams.get('offset'))
  const offset = Number.isInteger(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
  const group = searchParams.get('group') as WorkGroup | null
  let listQuery = byProfile(supabase
    .from('works')
    .select('*')
    .eq('user_id', guard.userId!))
  if (group && GROUPS[group]) listQuery = GROUPS[group](listQuery)
  const { data: works, error } = await listQuery
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!works || works.length === 0) return NextResponse.json([])

  // 按页取完：50 条作品各有好几版时会超过数据库一次 1000 行的上限，后面的环节会被算成「没做」
  const items = await fetchAllPages<{ work_id: string | null; task_type: string }>((from, to) => supabase
    .from('script_history')
    .select('id, work_id, task_type, created_at')
    .eq('user_id', guard.userId!)
    .in('work_id', works.map((w) => w.id))
    .order('id')
    .range(from, to)).catch(() => [])

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
  /*
   * 发布后的数据（2026-10-03，数据回流）：播放、完播、互动、涨粉、咨询、成交。
   * 校验一遍再存（lib/performance 的 readMetrics），传 null 表示清空
   */
  if (body.metrics !== undefined) patch.metrics = body.metrics === null ? null : readMetrics(body.metrics)
  /*
   * 数据对应哪一版稿子（2026-10-04）：取这条作品最新的审稿 / 脚本记录（含画布改稿），记进 metrics.contentVersion。
   * 前端传来的不信，以服务端查到的为准；查不到就不记
   */
  if (patch.metrics && typeof patch.metrics === 'object') {
    const { data: latest } = await supabase
      .from('script_history')
      .select('id, task_type, created_at')
      .eq('user_id', guard.userId!)
      .eq('work_id', id)
      .in('task_type', ['审稿优化', '脚本生成'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const m = patch.metrics as Record<string, unknown>
    delete m.contentVersion
    if (latest) m.contentVersion = { historyId: latest.id, taskType: latest.task_type, at: latest.created_at }
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
    if (/metrics/.test(error.message)) {
      return NextResponse.json({ error: '数据录入还没启用：请先在 Supabase 执行 20261003_work_metrics.sql' }, { status: 503 })
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
