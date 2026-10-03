import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { historyProfileFilter } from '@/lib/profile-history'
import { getServiceSupabase } from '@/lib/admin-auth'
import { removeTopicSection, deletedTopicsOf } from '@/lib/topic-library'
import { readJsonBody } from '@/lib/read-body'

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

    let profileFilter: string | null
    try { profileFilter = historyProfileFilter(new URL(request.url).searchParams.get('profileId')) }
    catch { return NextResponse.json({ error: '档案编号不正确' }, { status: 400 }) }
    let query = supabase
      .from('script_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_type', '选题策划')
      .order('created_at', { ascending: false })
    if (profileFilter) query = query.or(profileFilter)
    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取选题历史失败:', error)
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

    const body = await readJsonBody(request)
    const { input_data, result } = body

    const { data, error } = await supabase
      .from('script_history')
      .insert({
        user_id: user.id,
        task_type: '选题策划',
        input_data,
        result
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('保存选题失败:', error)
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
    const topic = searchParams.get('topic')

    /*
     * 删一条选题（不是删整批）。
     *
     * 同一条可能在好几批里都出现过——撞车的那几条就是这样。只从一批里删，
     * 它会从别的批次"复活"回选题库。所以按指纹在这个账号所有批次里一起删。
     *
     * 删掉的标题记进那一批的 input_data.deletedTopics：删掉多半是因为不喜欢，
     * 生成新选题时它照样算"已经出过"，不能让 AI 再推回来。
     * 用 service_role 写：这张表的行级更新权限开没开不确定，显式按本人过滤。
     */
    if (topic) {
      const db = getServiceSupabase()
      const { data: batches, error: readError } = await db
        .from('script_history')
        .select('id, result, input_data')
        .eq('user_id', user.id)
        .eq('task_type', '选题策划')
      if (readError) throw readError

      let removed = 0
      for (const b of batches ?? []) {
        const r = removeTopicSection(b.result || '', topic)
        if (r.removed.length === 0) continue
        const input = b.input_data && typeof b.input_data === 'object' ? b.input_data : {}
        const deletedTopics = Array.from(new Set([...deletedTopicsOf(input), ...r.removed]))
        const { error: upError } = await db
          .from('script_history')
          .update({ result: r.markdown, input_data: { ...input, deletedTopics } })
          .eq('id', b.id)
          .eq('user_id', user.id)
        if (upError) throw upError
        removed += r.removed.length
      }
      if (removed === 0) return NextResponse.json({ error: '没找到这条选题' }, { status: 404 })
      return NextResponse.json({ success: true, removed })
    }

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
    console.error('删除选题失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
