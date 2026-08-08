import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

    const body = await request.json()
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .insert([
        {
          user_id: user.id,
          ...body
        }
      ])
      .select()
      .single()

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

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: '缺少档案ID' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

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
