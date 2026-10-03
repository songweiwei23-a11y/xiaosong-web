import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
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
  for (let i = 0; i < 3; i++) {
    const res = await run(payload)
    const col = res.error?.code === 'PGRST204' ? res.error.message?.match(/'([a-z_]+)' column/)?.[1] : undefined
    if (!col || !(col in payload)) return res
    console.warn(`档案表还没有 ${col} 列（迁移未跑），这一栏先不存`)
    const { [col]: _dropped, ...rest } = payload
    payload = rest
  }
  return run(payload)
}

async function getSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function GET() {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

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
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    
    const { data: profile, error } = await withoutMissingColumns({ ...body, user_id: user.id }, (d) =>
      supabase.from('user_profiles').insert([d]).select().single()
    )

    if (error) {
      console.error('创建档案失败:', error)
      return NextResponse.json({ error: '创建档案失败' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('创建档案错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: '缺少档案ID' }, { status: 400 })
    }

    const { data: profile, error } = await withoutMissingColumns(updateData, (d) =>
      supabase.from('user_profiles').update(d).eq('id', id).eq('user_id', user.id).select().single()
    )

    if (error) {
      console.error('更新档案失败:', error)
      return NextResponse.json({ error: '更新档案失败' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('更新档案错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

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
