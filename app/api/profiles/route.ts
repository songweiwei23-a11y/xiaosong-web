import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/admin-auth'
import { readJsonBody } from '@/lib/read-body'

export const dynamic = 'force-dynamic'

/**
 * 新加的档案栏（content_mix 等）要用户在 Supabase 手动跑迁移。跑之前，带着这一栏保存会整条失败——
 * 用户只是改了个错字，结果"更新档案失败"。所以库里没有某一栏时，去掉它再存一次，其余照常保存。
 */
async function withoutMissingColumns<T>(
  data: Record<string, unknown>,
  run: (d: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
) {
  let payload = { ...data }
  const dropped: string[] = []
  for (let i = 0; i < 4; i++) {
    const res = await run(payload)
    const col = res.error?.code === 'PGRST204' ? res.error.message?.match(/'([a-z_]+)' column/)?.[1] : undefined
    if (!col || !(col in payload)) return { ...res, dropped }
    console.warn(`档案表还没有 ${col} 列（迁移未跑），这一栏先不存`)
    dropped.push(col)
    const { [col]: _dropped, ...rest } = payload
    payload = rest
  }
  return { ...(await run(payload)), dropped }
}

/** 返回给页面：哪几栏因为数据库没升级没存上（页面要明说，不能让编导以为存上了） */
const withDropped = (profile: unknown, dropped: string[]) =>
  dropped.length && profile && typeof profile === 'object' ? { ...(profile as object), _droppedColumns: dropped } : profile


/**
 * 确认不了登录态时分两种：真没登录（401）和认证服务超时、断线（503）。
 * 页面把 401 当成「没有档案」，超时要是也回 401，档案就「消失」了。
 */
function authFailure(authError: { status?: number; name?: string } | null) {
  const expired = !authError || authError.status === 401 || authError.status === 403 || authError.name === 'AuthSessionMissingError'
  return NextResponse.json(
    { error: expired ? '未授权' : '登录状态暂时确认不了，请稍后重试' },
    { status: expired ? 401 : 503 }
  )
}

export async function GET() {
  try {
    const supabase = await getServerSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return authFailure(authError)

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取档案列表失败:', error)
      return NextResponse.json({ error: '获取档案列表失败' }, { status: 500 })
    }

    return NextResponse.json(profiles)
  } catch (error) {
    console.error('档案API错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) return authFailure(authError)

    const body = await readJsonBody(request)
    
    const { data: profile, error, dropped } = await withoutMissingColumns({ ...body, user_id: user.id }, (d) =>
      supabase.from('user_profiles').insert([d]).select().single()
    )

    if (error) {
      console.error('创建档案失败:', error)
      return NextResponse.json({ error: '创建档案失败' }, { status: 500 })
    }

    return NextResponse.json(withDropped(profile, dropped))
  } catch (error) {
    console.error('创建档案错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) return authFailure(authError)

    const body = await readJsonBody(request)
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: '缺少档案ID' }, { status: 400 })
    }

    const { data: profile, error, dropped } = await withoutMissingColumns(updateData, (d) =>
      supabase.from('user_profiles').update(d).eq('id', id).eq('user_id', user.id).select().single()
    )

    if (error) {
      console.error('更新档案失败:', error)
      return NextResponse.json({ error: '更新档案失败' }, { status: 500 })
    }

    return NextResponse.json(withDropped(profile, dropped))
  } catch (error) {
    console.error('更新档案错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) return authFailure(authError)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少档案ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('删除档案失败:', error)
      return NextResponse.json({ error: '删除档案失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除档案错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
