import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { CATEGORY_IDS, KIND_IDS, cleanKeyword, dateRange, libraryPreview, pageOf, readKind, readRealFields, realMaterialContent, realMaterialTitle } from '@/lib/library'
import { fetchAllPages } from '@/lib/db-pages'
import { readJsonBody } from '@/lib/read-body'
import { readLibraryCreationContext } from '@/lib/library'

export const dynamic = 'force-dynamic'

/**
 * 素材库（2026-10-02）。表见 supabase/migrations/20261002_library_and_progress.sql，
 * 真实素材 / 认可的好稿两栏见 20261003_library_assets.sql。按本人过滤，行级权限也只放本人。
 *
 * GET 列表（2026-10-03 改成分页）：
 *   ?profileId=&category=&kind=&q=&from=&to=&offset=&limit=
 *   只回预览（正文点开再取 ?id=…），total 是这个筛选下的总数；offset=0 时附带各分类、各来源的数量。
 *   原来一次最多取 500 条、搜索在浏览器里做，第 501 条以后的收藏看不到也搜不到。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CONTENT = 30_000
const MAX_BATCH = 30

/** 迁移没跑时，报错里带着表名 / 列名 */
const tableMissing = (msg?: string) => /material_library/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')
const NOT_READY = { error: '素材库还没启用：请先在 Supabase 执行 20261002_library_and_progress.sql' }
const assetsMissing = (msg?: string) => /\b(kind|fields)\b/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')
const ASSETS_NOT_READY = '真实素材和好稿还没启用：请先在 Supabase 执行 20261003_library_assets.sql'

const BASE_COLS = 'id, profile_id, category, source, title, content, note, created_at'
const ASSET_COLS = `${BASE_COLS}, kind, fields`

/** 同一段内容只收藏一次：空白和加粗符号不算区别 */
const hashOf = (content: string) => createHash('sha256').update(content.replace(/\*\*/g, '').replace(/\s+/g, '')).digest('hex')

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase 查询链类型随 select 变化
type Query = any

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const sp = new URL(request.url).searchParams
  const userId = guard.userId!

  // 一条的全文
  const id = sp.get('id')
  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })
    let r = await supabase.from('material_library').select(ASSET_COLS).eq('id', id).eq('user_id', userId).maybeSingle()
    if (r.error && assetsMissing(r.error.message)) r = await supabase.from('material_library').select(BASE_COLS).eq('id', id).eq('user_id', userId).maybeSingle()
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    if (!r.data) return NextResponse.json({ error: '素材不存在' }, { status: 404 })
    return NextResponse.json({ item: r.data })
  }

  const profileId = sp.get('profileId')
  const range = dateRange(sp.get('from'), sp.get('to'))
  const scope = (q: Query) => {
    let r = q.eq('user_id', userId)
    // 按档案隔离：档案编号只看这个档案的；default 只看没挂档案的（和 lib/profile-history 同一口径）
    if (profileId && UUID_RE.test(profileId)) r = r.eq('profile_id', profileId)
    else if (profileId === 'default') r = r.is('profile_id', null)
    if (range.gte) r = r.gte('created_at', range.gte)
    if (range.lt) r = r.lt('created_at', range.lt)
    return r
  }
  const category = sp.get('category')
  const kind = sp.get('kind')
  const kw = cleanKeyword(sp.get('q'))
  const page = pageOf(sp)

  const list = (cols: string, withKind: boolean) => {
    let q = scope(supabase.from('material_library').select(cols, { count: 'exact' }))
    if (category && CATEGORY_IDS.has(category)) q = q.eq('category', category)
    if (withKind && kind && KIND_IDS.has(kind)) q = q.eq('kind', kind)
    if (kw) q = q.or(`title.ilike.%${kw}%,content.ilike.%${kw}%,note.ilike.%${kw}%`)
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(page.offset, page.offset + page.limit - 1)
  }

  let assetsReady = true
  let res = await list(ASSET_COLS, true)
  if (res.error && assetsMissing(res.error.message)) {
    assetsReady = false
    // 还没升级：按「来源」筛的请求没法回答，别把全部当成结果给出去
    if (kind && kind !== 'ai') return NextResponse.json({ items: [], total: 0, assetsReady, notice: ASSETS_NOT_READY, offset: page.offset, limit: page.limit })
    res = await list(BASE_COLS, false)
  }
  if (res.error) {
    if (tableMissing(res.error.message)) return NextResponse.json({ ...NOT_READY, items: [], total: 0 }, { status: 503 })
    return NextResponse.json({ error: res.error.message }, { status: 500 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (res.data ?? []).map(({ content, ...rest }: any) => ({
    ...rest, kind: readKind(rest.kind), preview: libraryPreview(String(content || '')), length: String(content || '').length,
  }))
  const body: Record<string, unknown> = { items, total: res.count ?? items.length, assetsReady, offset: page.offset, limit: page.limit }
  if (!assetsReady) body.notice = ASSETS_NOT_READY

  // 第一页附带各分类、各来源的数量（同一档案、同一时间段，不看关键词）：只取两个短列，按页取完
  if (page.offset === 0) {
    try {
      const rows = await fetchAllPages<{ category: string; kind?: string }>((from, to) =>
        scope(supabase.from('material_library').select(assetsReady ? 'id, category, kind' : 'id, category')).order('id').range(from, to)
      )
      const categories: Record<string, number> = {}
      const kinds: Record<string, number> = {}
      for (const r of rows) {
        categories[r.category] = (categories[r.category] ?? 0) + 1
        const k = readKind(r.kind)
        kinds[k] = (kinds[k] ?? 0) + 1
      }
      body.counts = { all: rows.length, categories, kinds }
    } catch (e) {
      console.error('[library] 计数失败:', (e as Error).message)
    }
  }
  return NextResponse.json(body)
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  let body: any
  // 浏览器端可能压缩 / 分块发来（lib/safe-post）
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })

  const profileId = typeof body.profileId === 'string' && UUID_RE.test(body.profileId) ? body.profileId : null
  const supabase = await getServerSupabase()

  // 记录一条真实素材（手动录入）
  if (body.real) {
    const fields = readRealFields(body.real.fields)
    if (!fields?.question && !fields?.quote && !fields?.result) return NextResponse.json({ error: '至少写上客户问题、原话或真实结果中的一项' }, { status: 400 })
    const content = realMaterialContent(fields)
    const row = {
      user_id: guard.userId!, profile_id: profileId, category: 'material', source: '手动记录',
      title: realMaterialTitle(fields, typeof body.real.title === 'string' ? body.real.title : ''),
      content, content_hash: hashOf(content), kind: 'real', fields,
    }
    const { data, error } = await supabase.from('material_library').insert(row).select('id').maybeSingle()
    if (error) {
      if (assetsMissing(error.message)) return NextResponse.json({ error: ASSETS_NOT_READY }, { status: 503 })
      if (tableMissing(error.message)) return NextResponse.json(NOT_READY, { status: 503 })
      if (error.code === '23505') return NextResponse.json({ error: '一模一样的素材已经记过了' }, { status: 409 })
      console.error('[library] 记录真实素材失败:', error.message)
      return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: data?.id ?? null })
  }

  const raw = Array.isArray(body.items) ? body.items.slice(0, MAX_BATCH) : []
  const rows = raw
    .map((it: any) => {
      const content = String(it?.content ?? '').trim().slice(0, MAX_CONTENT)
      return {
        user_id: guard.userId!,
        profile_id: profileId,
        category: CATEGORY_IDS.has(it?.category) ? it.category : 'other',
        source: String(it?.source ?? '').slice(0, 30),
        title: String(it?.title ?? '').trim().slice(0, 120) || '未命名素材',
        content,
        content_hash: hashOf(content),
        ...(readLibraryCreationContext(it?.creationContext) ? { fields: { creationContext: readLibraryCreationContext(it.creationContext) } } : {}),
      }
    })
    .filter((r: { content: string }) => r.content.length >= 2)
  if (!rows.length) return NextResponse.json({ error: '没有可收藏的内容' }, { status: 400 })

  // 之前收藏过的不重复存（按正文指纹）；告诉用户有几条是早就在的
  const { data, error } = await supabase
    .from('material_library')
    .upsert(rows, { onConflict: 'user_id,content_hash', ignoreDuplicates: true })
    .select('id')
  if (error) {
    if (tableMissing(error.message)) return NextResponse.json(NOT_READY, { status: 503 })
    console.error('[library] 收藏失败:', error.message)
    return NextResponse.json({ error: '收藏失败，请稍后重试' }, { status: 500 })
  }
  const saved = data?.length ?? 0
  return NextResponse.json({ success: true, saved, duplicated: rows.length - saved })
}

/**
 * 改一条：标题、备注、分类、正文；AI 建议 ↔ 认可的好稿；真实素材改各栏（正文跟着重拼）。
 * 真实素材不能改成好稿、好稿也不能改成真实素材——来源是事实，不是标签。
 */
export async function PATCH(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })
  let body: any
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })

  const supabase = await getServerSupabase()
  const wantsAssets = body.kind !== undefined || body.fields !== undefined
  let current: { id: string; kind?: string } | null = null
  if (wantsAssets) {
    const r = await supabase.from('material_library').select('id, kind').eq('id', id).eq('user_id', guard.userId!).maybeSingle()
    if (r.error) {
      if (assetsMissing(r.error.message)) return NextResponse.json({ error: ASSETS_NOT_READY }, { status: 503 })
      return NextResponse.json({ error: r.error.message }, { status: 500 })
    }
    if (!r.data) return NextResponse.json({ error: '素材不存在' }, { status: 404 })
    current = r.data
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
  if (typeof body.note === 'string') patch.note = body.note.slice(0, 500)
  if (typeof body.category === 'string' && CATEGORY_IDS.has(body.category)) patch.category = body.category
  if (body.kind !== undefined) {
    const from = readKind(current?.kind)
    const to = body.kind
    if (from === 'real' || to === 'real' || !KIND_IDS.has(to)) return NextResponse.json({ error: '真实素材和生成的稿子不能互相转换' }, { status: 400 })
    patch.kind = to
  }
  if (body.fields !== undefined) {
    if (readKind(current?.kind) !== 'real') return NextResponse.json({ error: '只有真实素材有这些栏' }, { status: 400 })
    const fields = readRealFields(body.fields)
    if (!fields?.question && !fields?.quote && !fields?.result) return NextResponse.json({ error: '至少写上客户问题、原话或真实结果中的一项' }, { status: 400 })
    patch.fields = fields
    patch.content = realMaterialContent(fields)
  } else if (typeof body.content === 'string') {
    const content = body.content.trim().slice(0, MAX_CONTENT)
    if (content.length < 2) return NextResponse.json({ error: '正文不能为空' }, { status: 400 })
    patch.content = content
  }
  if (typeof patch.content === 'string') patch.content_hash = hashOf(patch.content)

  const { data, error } = await supabase
    .from('material_library')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '素材库里已经有一条一模一样的内容' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: '素材不存在' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })
  const supabase = await getServerSupabase()
  const { error } = await supabase.from('material_library').delete().eq('id', id).eq('user_id', guard.userId!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
