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

// 获取账号定位列表
export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')

    let query = supabase
      .from('account_positioning')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // 如果指定了档案ID，只返回该档案的定位
    if (profileId) {
      query = query.eq('profile_id', profileId)
    }

    const { data: positionings, error } = await query

    if (error) {
      console.error('❌ 获取定位列表失败:', error)
      return NextResponse.json({ error: '获取定位列表失败' }, { status: 500 })
    }

    return NextResponse.json(positionings)
  } catch (error) {
    console.error('❌ 定位API错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// 创建账号定位
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    
    // 如果设置为激活，先将其他定位设为非激活
    if (body.is_active) {
      await supabase
        .from('account_positioning')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('profile_id', body.profile_id)
    }
    
    const { data: positioning, error } = await supabase
      .from('account_positioning')
      .insert([
        {
          user_id: user.id,
          ...body
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('❌ 创建定位失败:', error)
      return NextResponse.json({ error: '创建定位失败' }, { status: 500 })
    }

    console.log('✅ 定位创建成功:', positioning.id)
    return NextResponse.json(positioning)
  } catch (error) {
    console.error('❌ 创建定位错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// 更新账号定位
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
      return NextResponse.json({ error: '缺少定位ID' }, { status: 400 })
    }

    // 如果设置为激活，先将其他定位设为非激活
    if (updateData.is_active) {
      const { data: currentPositioning } = await supabase
        .from('account_positioning')
        .select('profile_id')
        .eq('id', id)
        .single()
      
      if (currentPositioning) {
        await supabase
          .from('account_positioning')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('profile_id', currentPositioning.profile_id)
          .neq('id', id)
      }
    }

    const { data: positioning, error } = await supabase
      .from('account_positioning')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('❌ 更新定位失败:', error)
      return NextResponse.json({ error: '更新定位失败' }, { status: 500 })
    }

    return NextResponse.json(positioning)
  } catch (error) {
    console.error('❌ 更新定位错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// 删除账号定位
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
      return NextResponse.json({ error: '缺少定位ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('account_positioning')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ 删除定位失败:', error)
      return NextResponse.json({ error: '删除定位失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ 删除定位错误:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
