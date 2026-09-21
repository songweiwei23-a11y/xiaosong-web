import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { sanitizeMessages } from '@/lib/chat-message-utils'

export const dynamic = 'force-dynamic'

const VALID_KINDS = ['free_chat', 'continuous'] as const

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind')
  const taskType = searchParams.get('taskType')
  const limitRaw = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50

  let query = supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', guard.userId!)
    .order('updated_at', { ascending: false })
    .limit(limit)

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
  const body = await request.json()

  const kind = body.kind
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind 必须是 free_chat 或 continuous' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: guard.userId!,
      kind,
      task_type: body.taskType || null,
      profile_id: body.profileId || null,
      title: body.title || '新对话',
      dify_conversation_id: body.difyConversationId || '',
      messages: sanitizeMessages(body.messages),
    })
    .select()
    .single()

  if (error) {
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

  const body = await request.json()

  // 只更新本次明确给出的字段：流式过程中会多次保存，
  // 若把未传的字段一律写成默认值，会把已拿到的 dify 会话 id 抹掉。
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.difyConversationId === 'string' && body.difyConversationId) {
    patch.dify_conversation_id = body.difyConversationId
  }
  if (body.messages !== undefined) patch.messages = sanitizeMessages(body.messages)
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
