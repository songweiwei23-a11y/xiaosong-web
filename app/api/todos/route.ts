import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getServerSupabase } from '@/lib/admin-auth'
import { normalizeTodoInput, TODO_MAX_LEN } from '@/lib/todos'

export const dynamic = 'force-dynamic'

/*
 * 首页待办：自己记的事 + 可选的截止时间。
 * 走用户自己的会话（RLS 管住只能动自己的），和作品接口一个写法。
 */

/** 表还没建（迁移没跑）时给前端一个能认的信号，而不是一句看不懂的数据库报错 */
function failed(error: { code?: string; message: string }) {
  const missing = error.code === '42P01' || error.code === 'PGRST205' || /user_todos/.test(error.message)
  return NextResponse.json(
    missing ? { error: '待办功能还没开通', code: 'TABLE_MISSING' } : { error: error.message },
    { status: missing ? 503 : 500 }
  )
}

export async function GET() {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const supabase = await getServerSupabase()

  // 没做完的全要；做完的只留最近几条，给"刚划掉"一点回看的余地
  const [open, done] = await Promise.all([
    supabase.from('user_todos').select('*').eq('user_id', guard.userId!).eq('done', false)
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('user_todos').select('*').eq('user_id', guard.userId!).eq('done', true)
      .order('done_at', { ascending: false }).limit(5),
  ])
  if (open.error) return failed(open.error)
  if (done.error) return failed(done.error)
  return NextResponse.json([...(open.data ?? []), ...(done.data ?? [])])
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const input = normalizeTodoInput(await request.json().catch(() => ({})))
  if (!input.content) {
    return NextResponse.json({ error: `写点内容再添加（最多 ${TODO_MAX_LEN} 字）` }, { status: 400 })
  }
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('user_todos')
    .insert({ user_id: guard.userId!, content: input.content, due_at: input.dueAt })
    .select('*')
    .single()
  if (error) return failed(error)
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof body.done === 'boolean') {
    patch.done = body.done
    patch.done_at = body.done ? new Date().toISOString() : null
  }
  if ('content' in body || 'dueAt' in body) {
    const input = normalizeTodoInput(body)
    if ('content' in body) {
      if (!input.content) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
      patch.content = input.content
    }
    if ('dueAt' in body) patch.due_at = input.dueAt
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '没有要改的' }, { status: 400 })

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('user_todos')
    .update(patch)
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .select('*')
    .maybeSingle()
  if (error) return failed(error)
  if (!data) return NextResponse.json({ error: '这条待办不存在' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response!
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const supabase = await getServerSupabase()
  const { error } = await supabase.from('user_todos').delete().eq('id', id).eq('user_id', guard.userId!)
  if (error) return failed(error)
  return NextResponse.json({ ok: true })
}
