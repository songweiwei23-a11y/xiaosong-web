import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { libraryExportMarkdown, readKind } from '@/lib/library'
import { fetchAllPages } from '@/lib/db-pages'

export const dynamic = 'force-dynamic'

/**
 * 素材库导出（2026-10-03）：本人的全部收藏（或某个档案的），带全文。
 *   ?profileId=…   只导这个档案的
 *   ?format=json   默认 Markdown；json 是原始字段，留作备份
 * 按页取完，不受数据库默认 1000 行上限影响。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const assetsMissing = (msg?: string) => /\b(kind|fields)\b/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()
  const sp = new URL(request.url).searchParams
  const profileId = sp.get('profileId')
  const json = sp.get('format') === 'json'

  const read = (cols: string) => fetchAllPages<Record<string, unknown>>((from, to) => {
    let q = supabase.from('material_library').select(cols).eq('user_id', guard.userId!)
    if (profileId && UUID_RE.test(profileId)) q = q.eq('profile_id', profileId)
    else if (profileId === 'default') q = q.is('profile_id', null)
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to) as never
  })
  const base = 'id, profile_id, category, source, title, content, note, created_at'
  let rows: Record<string, unknown>[]
  try {
    try { rows = await read(`${base}, kind, fields`) } catch (e) {
      if (!assetsMissing((e as Error).message)) throw e
      rows = await read(base)
    }
  } catch (e) {
    console.error('[library/export] 导出失败:', (e as Error).message)
    return NextResponse.json({ error: '导出失败，请稍后重试' }, { status: 500 })
  }

  const items = rows.map((r) => ({ ...r, kind: readKind(r.kind) }))
  const day = new Date().toISOString().slice(0, 10)
  const name = `开物素材库_${day}.${json ? 'json' : 'md'}`
  const text = json
    ? JSON.stringify({ exportedAt: new Date().toISOString(), count: items.length, items }, null, 2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : libraryExportMarkdown(items as any)
  return new Response(text, {
    headers: {
      'Content-Type': json ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="library.${json ? 'json' : 'md'}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
