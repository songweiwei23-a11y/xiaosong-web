import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { readJsonBody } from '@/lib/read-body'
import { PRESET_LIMITS, pickActivePreset, readPresetInput, toPreset, type PresetExample, type PresetInput } from '@/lib/creator-presets'

export const dynamic = 'force-dynamic'

/**
 * 个人风格预设（2026-10-03），说明见 lib/creator-presets.ts，表见 20261003_creator_presets.sql。
 *
 *   GET                          本人全部预设
 *   GET ?active=1&profileId=…    这个档案生成时用的那一份（各生成板块读这个；没有返回 preset: null）
 *   POST { name, style, structure, examples, profileId }           新增
 *   PATCH ?id=… { 同上 }           修改；{ action: 'adopt' | 'unadopt' } 采用 / 停用
 *   DELETE ?id=…
 *
 * 示例只认两种：素材库里「认可的好稿」（服务端按 libraryId 取正文，核对是本人的、kind = approved），或用户自己贴的。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const tableMissing = (msg?: string) => /creator_presets/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')
const NOT_READY = '风格预设还没启用：请先在 Supabase 执行 20261003_creator_presets.sql'
const COLS = 'id, profile_id, name, style, structure, examples, is_active, created_at, updated_at'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase 客户端
type Db = any

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const sp = new URL(request.url).searchParams
  const active = sp.get('active') === '1'
  const profileId = sp.get('profileId')

  let q = supabase.from('creator_presets').select(COLS).eq('user_id', guard.userId!)
  if (active) q = q.eq('is_active', true)
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(PRESET_LIMITS.perUser * 2)
  if (error) {
    // 生成板块读预设：表没建就当没有，不挡生成
    if (tableMissing(error.message)) return active ? NextResponse.json({ preset: null, notReady: true }) : NextResponse.json({ error: NOT_READY, presets: [] }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const presets = (data ?? []).map(toPreset)
  if (active) return NextResponse.json({ preset: pickActivePreset(presets, profileId && UUID_RE.test(profileId) ? profileId : null) })
  return NextResponse.json({ presets })
}

/** 素材库来的示例：按 id 取服务端正文，只认本人的好稿；有一条不是就整体拒绝（不悄悄丢掉） */
async function verifiedExamples(db: Db, userId: string, input: PresetInput): Promise<PresetExample[] | { error: string; status: number }> {
  const ids = input.examples.map((e) => e.libraryId).filter(Boolean) as string[]
  if (!ids.length) return input.examples
  const { data, error } = await db.from('material_library').select('id, title, content, kind').eq('user_id', userId).in('id', ids)
  if (error) {
    if (/\bkind\b/.test(error.message)) return { error: '好稿功能还没启用：请先在 Supabase 执行 20261003_library_assets.sql', status: 503 }
    return { error: error.message, status: 500 }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>((data ?? []).map((r: any) => [r.id, r]))
  const out: PresetExample[] = []
  for (const e of input.examples) {
    if (!e.libraryId) { out.push(e); continue }
    const row = byId.get(e.libraryId)
    if (!row || row.kind !== 'approved') return { error: `「${e.title}」不是你认可的好稿：先在素材库里点星标认可，再拿来当示例`, status: 400 }
    out.push({ title: String(row.title || e.title).slice(0, 80), content: String(row.content || '').slice(0, PRESET_LIMITS.exampleChars), libraryId: row.id })
  }
  return out
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  let body: unknown
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }
  const input = readPresetInput(body)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })

  const supabase = await getServerSupabase()
  const { count, error: countError } = await supabase.from('creator_presets').select('id', { count: 'exact', head: true }).eq('user_id', guard.userId!)
  if (countError) {
    if (tableMissing(countError.message)) return NextResponse.json({ error: NOT_READY }, { status: 503 })
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }
  if ((count ?? 0) >= PRESET_LIMITS.perUser) return NextResponse.json({ error: `预设最多 ${PRESET_LIMITS.perUser} 个，先删掉不用的` }, { status: 400 })

  const examples = await verifiedExamples(supabase, guard.userId!, input)
  if ('error' in examples) return NextResponse.json({ error: examples.error }, { status: examples.status })

  const { data, error } = await supabase.from('creator_presets').insert({
    user_id: guard.userId!, profile_id: input.profileId, name: input.name, style: input.style, structure: input.structure, examples,
  }).select(COLS).maybeSingle()
  if (error) return NextResponse.json({ error: tableMissing(error.message) ? NOT_READY : '保存失败，请稍后重试' }, { status: tableMissing(error.message) ? 503 : 500 })
  return NextResponse.json({ preset: data ? toPreset(data) : null })
}

export async function PATCH(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: '缺少预设 ID' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })
  const supabase = await getServerSupabase()

  const { data: current, error: readError } = await supabase.from('creator_presets').select('id, profile_id, is_active').eq('id', id).eq('user_id', guard.userId!).maybeSingle()
  if (readError) return NextResponse.json({ error: tableMissing(readError.message) ? NOT_READY : readError.message }, { status: tableMissing(readError.message) ? 503 : 500 })
  if (!current) return NextResponse.json({ error: '预设不存在' }, { status: 404 })

  if (body.action === 'adopt' || body.action === 'unadopt') {
    if (body.action === 'adopt') {
      // 同一档案（或「全部档案」）只留一份在用：先把别的停掉。数据库有唯一索引兜底，撞了说明并发点了两次
      let off = supabase.from('creator_presets').update({ is_active: false }).eq('user_id', guard.userId!).eq('is_active', true).neq('id', id)
      off = current.profile_id ? off.eq('profile_id', current.profile_id) : off.is('profile_id', null)
      const r1 = await off
      if (r1.error) return NextResponse.json({ error: r1.error.message }, { status: 500 })
    }
    const r2 = await supabase.from('creator_presets').update({ is_active: body.action === 'adopt' }).eq('id', id).eq('user_id', guard.userId!)
    if (r2.error) return NextResponse.json({ error: r2.error.code === '23505' ? '刚才同时采用了两份，请刷新后再点一次' : r2.error.message }, { status: r2.error.code === '23505' ? 409 : 500 })
    return NextResponse.json({ success: true })
  }

  const input = readPresetInput(body)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const examples = await verifiedExamples(supabase, guard.userId!, input)
  if ('error' in examples) return NextResponse.json({ error: examples.error }, { status: examples.status })
  // 在用的预设改了适用档案：可能和目标档案已有的在用预设撞，先停掉它，用户再点采用
  const moving = (current.profile_id ?? null) !== input.profileId
  const patch: Record<string, unknown> = {
    name: input.name, style: input.style, structure: input.structure, examples, profile_id: input.profileId,
    updated_at: new Date().toISOString(), ...(moving && current.is_active ? { is_active: false } : {}),
  }
  const { data, error } = await supabase.from('creator_presets').update(patch).eq('id', id).eq('user_id', guard.userId!).select(COLS).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '预设不存在' }, { status: 404 })
  return NextResponse.json({ preset: toPreset(data), deactivated: moving && current.is_active })
}

export async function DELETE(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: '缺少预设 ID' }, { status: 400 })
  const supabase = await getServerSupabase()
  const { error } = await supabase.from('creator_presets').delete().eq('id', id).eq('user_id', guard.userId!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
