import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { historyProfileFilter } from '@/lib/profile-history'

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

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    /*
     * taskType 支持三种写法：
     *   不传 / '脚本生成'      单一类型
     *   '起号方案,开篇钩子'     逗号分隔的多个类型
     *   'all'                 全部
     *
     * 【为什么要支持多个】起号页一进来要同时恢复起号方案和开篇钩子，
     * 还要读最近的选题和脚本做备选。它原先直接 fetch('/api/script-history')
     * 不带参数，于是只拿到「脚本生成」，然后在结果里 find('起号方案') ——
     * 永远是 undefined。恢复代码看着对、跑着不报错、什么都恢复不了。
     * 知识库页和成交理由页栽的是同一个坑。
     *
     * 默认值保留「脚本生成」是为了不动脚本页的既有行为，但所有调用方
     * 现在都显式传参；tests/history-restore.test.ts 会扫描，漏传就红。
     */
    const { searchParams } = new URL(request.url)
    let profileFilter: string | null
    try { profileFilter = historyProfileFilter(searchParams.get('profileId')) }
    catch { return NextResponse.json({ error: '档案编号不正确' }, { status: 400 }) }
    const raw = searchParams.get('taskType') ?? '脚本生成'
    const limitRaw = Number(searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined

    let query = supabase
      .from('script_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .lte('created_at', new Date().toISOString())

    if (raw !== 'all') {
      const types = raw.split(',').map((t) => t.trim()).filter(Boolean)
      // types 为空（?taskType= 这种）按"不过滤"处理：宁可多返回，
      // 也不要 .eq('task_type', undefined) 之后悄悄返回空数组
      if (types.length === 1) query = query.eq('task_type', types[0])
      else if (types.length > 1) query = query.in('task_type', types)
    }
    if (profileFilter) query = query.or(profileFilter)
    if (limit) query = query.limit(limit)

    const all: unknown[] = []
    const pageSize = limit || 500
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await query.range(from, from + pageSize - 1)
      if (error) throw error
      all.push(...(data || []))
      if (limit || !data || data.length < pageSize) break
    }
    return NextResponse.json(all, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('获取脚本历史失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
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
    const { input_data, result } = body

    const { data, error } = await supabase
      .from('script_history')
      .insert({
        user_id: user.id,
        task_type: '脚本生成',
        input_data,
        result
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('保存脚本失败:', error)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
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
      return NextResponse.json({ error: '缺少 id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('script_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除脚本失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
