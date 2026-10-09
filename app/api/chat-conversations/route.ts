import { NextResponse } from 'next/server'
import { PROFILE_UUID } from '@/lib/profile-history'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { sanitizeMessages } from '@/lib/chat-message-utils'
import { readJsonBody } from '@/lib/read-body'

export const dynamic = 'force-dynamic'

const VALID_KINDS = ['free_chat', 'continuous'] as const

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get('profileId')
  if (profileId && profileId !== 'default' && !PROFILE_UUID.test(profileId)) {
    return NextResponse.json({ error: '档案编号不正确' }, { status: 400 })
  }
  const kind = searchParams.get('kind')
  const taskType = searchParams.get('taskType')
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(Math.floor(limitRaw), 100) : 50
  const offsetRaw = Number(searchParams.get('offset'))
  const offset = Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0

  let query = supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', guard.userId!)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (offset > 0) query = query.range(offset, offset + limit - 1)

  if (profileId === 'default') query = query.is('profile_id', null)
  else if (profileId) query = query.eq('profile_id', profileId)
  if (kind) query = query.eq('kind', kind)
  if (taskType) query = query.eq('task_type', taskType)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  let body: any
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求内容没有传完整，请重试保存' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })
  if (body.ownerId && body.ownerId !== guard.userId) return NextResponse.json({ error: '账号已切换，原账号的本机草稿保留，请切回后保存' }, { status: 409 })
  if (body.id && (typeof body.id !== 'string' || !PROFILE_UUID.test(body.id))) {
    return NextResponse.json({ error: '对话编号不正确' }, { status: 400 })
  }
  if (body.profileId && (typeof body.profileId !== 'string' || !PROFILE_UUID.test(body.profileId))) {
    return NextResponse.json({ error: '档案编号不正确' }, { status: 400 })
  }
  const messages = sanitizeMessages(body.messages)
  if (Buffer.byteLength(JSON.stringify(messages), 'utf8') > 8 * 1024 * 1024) {
    return NextResponse.json({ error: '此对话过大，历史未裁切；请先导出保存，再新建对话继续' }, { status: 413 })
  }

  const kind = body.kind
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind 必须是 free_chat 或 continuous' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: guard.userId!,
      ...(body.id ? { id: body.id } : {}),
      kind,
      task_type: body.taskType || null,
      profile_id: body.profileId || null,
      title: body.title || '新对话',
      dify_conversation_id: body.difyConversationId || '',
      messages,
    })
    .select()
    .single()

  if (error) {
    // 网络超时后重复提交同一创建请求，认回本账号已有记录，避免重复对话。
    if (error.code === '23505' && body.id) {
      const existing = await supabase.from('chat_conversations').select('*').eq('id', body.id).eq('user_id', guard.userId!).maybeSingle()
      if (existing.data) return NextResponse.json(existing.data)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少对话 ID' }, { status: 400 })
  }

  let body: any
  try { body = await readJsonBody(request, guard.userId) } catch { return NextResponse.json({ error: '请求内容没有传完整，请重试保存' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 })
  if (body.ownerId && body.ownerId !== guard.userId) return NextResponse.json({ error: '账号已切换，原账号的本机草稿保留，请切回后保存' }, { status: 409 })
  if (body.profileId && (typeof body.profileId !== 'string' || !PROFILE_UUID.test(body.profileId))) {
    return NextResponse.json({ error: '档案编号不正确' }, { status: 400 })
  }

  // 只更新本次明确给出的字段：流式过程中会多次保存，
  // 若把未传的字段一律写成默认值，会把已拿到的 dify 会话 id 抹掉。
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.difyConversationId === 'string' && body.difyConversationId) {
    patch.dify_conversation_id = body.difyConversationId
  }
  if (body.messages !== undefined) patch.messages = sanitizeMessages(body.messages)
  if (patch.messages && Buffer.byteLength(JSON.stringify(patch.messages), 'utf8') > 8 * 1024 * 1024) {
    return NextResponse.json({ error: '此对话过大，历史未裁切；请先导出保存，再新建对话继续' }, { status: 413 })
  }
  if (body.profileId !== undefined) patch.profile_id = body.profileId || null

  const { data, error } = await supabase
    .from('chat_conversations')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '对话不存在或无权限' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少对话 ID' }, { status: 400 })
  }

  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', guard.userId!)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
