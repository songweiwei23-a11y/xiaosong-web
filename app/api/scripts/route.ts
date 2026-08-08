import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', id)
      .eq('user_id', guard.userId!)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: '脚本不存在' }, { status: 404 })
    }

    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', guard.userId!)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!

  const supabase = await getServerSupabase()
  const body = await request.json()

  if (!body.script_content) {
    return NextResponse.json({ error: '脚本内容不能为空' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      user_id: guard.userId!,
      profile_id: body.profile_id || null,
      positioning_id: body.positioning_id || null,
      topic_id: body.topic_id || null,
      script_type: body.script_type,
      duration: body.duration,
      content_form: body.content_form,
      key_lines: body.key_lines || null,
      emotion_requirement: body.emotion_requirement || null,
      feasibility_constraints: body.feasibility_constraints || null,
      script_content: body.script_content,
      conversation_id: body.conversation_id || null,
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
    return NextResponse.json({ error: '缺少脚本 ID' }, { status: 400 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('scripts')
    .update({
      script_content: body.script_content,
      conversation_id: body.conversation_id || null,
    })
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '脚本不存在或无权限' }, { status: 404 })
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
    return NextResponse.json({ error: '缺少脚本 ID' }, { status: 400 })
  }

  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', id)
    .eq('user_id', guard.userId!)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
