import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { CATEGORY_IDS } from '@/lib/library'
import { readJsonBody } from '@/lib/read-body'

export const dynamic = 'force-dynamic'

/**
 * 素材库（2026-10-02）。表见 supabase/migrations/20261002_library_and_progress.sql。
 * 按本人过滤，行级权限也只放本人。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CONTENT = 30_000
const MAX_BATCH = 30

/** 迁移没跑时，报错里带着表名 */
const tableMissing = (msg?: string) => /material_library/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')
const NOT_READY = { error: '素材库还没启用：请先在 Supabase 执行 20261002_library_and_progress.sql' }

/** 同一段内容只收藏一次：空白和加粗符号不算区别 */
const hashOf = (content: string) => createHash('sha256').update(content.replace(/\*\*/g, '').replace(/\s+/g, '')).digest('hex')

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get('profileId')

  let q = supabase
    .from('material_library')
    .select('id, profile_id, category, source, title, content, note, created_at')
    .eq('user_id', guard.userId!)
    .order('created_at', { ascending: false })
    .limit(500)
  if (profileId && UUID_RE.test(profileId)) q = q.eq('profile_id', profileId)

  const { data, error } = await q
  if (error) {
    if (tableMissing(error.message)) return NextResponse.json({ ...NOT_READY, items: [] }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  let body: any
  // 浏览器端可能压缩 / 分块发来（lib/safe-post）
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }

  const profileId = typeof body.profileId === 'string' && UUID_RE.test(body.profileId) ? body.profileId : null
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
      }
    })
    .filter((r: { content: string }) => r.content.length >= 2)
  if (!rows.length) return NextResponse.json({ error: '没有可收藏的内容' }, { status: 400 })

  const supabase = await getServerSupabase()
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

export async function PATCH(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })
  let body: any
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
  if (typeof body.note === 'string') patch.note = body.note.slice(0, 500)
  if (typeof body.category === 'string' && CATEGORY_IDS.has(body.category)) patch.category = body.category

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('material_library')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
