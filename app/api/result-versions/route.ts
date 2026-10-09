import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServiceSupabase } from '@/lib/admin-auth'
import { readJsonBody } from '@/lib/read-body'
import { sanitizeCanvasVersions } from '@/lib/canvas'
import { CANVAS_TASKS, MAX_VERSIONS_BYTES } from '@/lib/result-versions'
import { mergeCreationSettings } from '@/lib/creation-settings'

export const dynamic = 'force-dynamic'

/**
 * 生成结果的画布版本（2026-10-04），说明见 lib/result-versions.ts。
 *
 * POST { id?, taskType, workId?, profileId?, versions, base? }
 *   - 没有 id：新建一条「画布改稿」历史记录（result = 最新一版）
 *   - 有 id：只更新本人的、带 canvasOf 标记的那条（不能拿这个接口改别的生成记录）
 * 用 service role 写（script_history 的行级更新权限没开），所以每一步都显式按本人过滤。
 * 作品要是本人的、档案要对得上，不对就拒绝，不悄悄挂到别人的作品上。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  let body: Record<string, unknown>
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })

  const taskType = typeof body.taskType === 'string' ? body.taskType : ''
  if (!CANVAS_TASKS.has(taskType)) return NextResponse.json({ error: '这个板块的结果不能存画布版本' }, { status: 400 })
  const versions = sanitizeCanvasVersions(body.versions)
  const latest = versions.at(-1)?.content?.trim()
  if (!latest) return NextResponse.json({ error: '没有可保存的内容' }, { status: 400 })
  if (JSON.stringify(versions).length > MAX_VERSIONS_BYTES) return NextResponse.json({ error: '版本太多太长，存不下了：请先复制或导出需要的版本，再从最新一版重新打开画布' }, { status: 413 })
  const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  const workId = typeof body.workId === 'string' && UUID_RE.test(body.workId) ? body.workId : null
  const profileId = typeof body.profileId === 'string' && UUID_RE.test(body.profileId) ? body.profileId : null
  const base = body.base && typeof body.base === 'object' ? body.base as Record<string, unknown> : {}

  const db = getServiceSupabase()
  if (workId) {
    const { data: work, error } = await db.from('works').select('id, profile_id').eq('id', workId).eq('user_id', guard.userId!).maybeSingle()
    if (error) return NextResponse.json({ error: '作品读取失败，请重试' }, { status: 500 })
    if (!work) return NextResponse.json({ error: '这条作品不存在或不属于当前账号' }, { status: 403 })
    if ((work.profile_id ?? null) !== profileId) return NextResponse.json({ error: '作品和当前档案对不上，请切到作品所属的档案再保存' }, { status: 403 })
  }

  const inputData = {
    canvasOf: true,
    canvasVersions: versions,
    profileId,
    ...(typeof base.originContent === 'string' && base.originContent ? { originContent: base.originContent.slice(0, 200_000) } : {}),
    ...(base.creationSettings ? { creationSettings: mergeCreationSettings(base.creationSettings) } : {}),
  }

  if (id) {
    const { data, error } = await db.from('script_history')
      .update({ result: latest, input_data: inputData })
      .eq('id', id).eq('user_id', guard.userId!).eq('task_type', taskType)
      .not('input_data->>canvasOf', 'is', null)
      .select('id').maybeSingle()
    if (error) return NextResponse.json({ error: '版本没保存上，请重试' }, { status: 500 })
    if (!data) return NextResponse.json({ error: '这份改稿记录不存在或不属于当前账号' }, { status: 404 })
    return NextResponse.json({ id: data.id })
  }

  const { data, error } = await db.from('script_history')
    .insert({ user_id: guard.userId!, task_type: taskType, input_data: inputData, result: latest, work_id: workId })
    .select('id').single()
  if (error) return NextResponse.json({ error: '版本没保存上，请重试' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
