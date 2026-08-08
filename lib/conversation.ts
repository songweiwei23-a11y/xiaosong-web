import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 创建 Supabase 客户端
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

// 保存对话消息
export async function saveConversationMessage(params: {
  sessionId: string
  taskType: string
  role: 'user' | 'assistant'
  content: string
  profileId?: string
}) {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ 用户未登录')
      return null
    }

    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        user_id: user.id,
        profile_id: params.profileId,
        session_id: params.sessionId,
        task_type: params.taskType,
        role: params.role,
        content: params.content
      })
      .select()
      .single()

    if (error) {
      console.error('❌ 保存对话消息失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('❌ 保存对话消息异常:', error)
    return null
  }
}

// 获取对话历史（最近 N 条）
export async function getConversationHistory(
  sessionId: string,
  limit: number = 10
): Promise<Message[]> {
  try {
    const supabase = await getSupabaseClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ 用户未登录')
      return []
    }

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit * 2) // 取最近 N 轮对话（user + assistant = 2条）

    if (error) {
      console.error('❌ 获取对话历史失败:', error)
      return []
    }

    return data.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  } catch (error) {
    console.error('❌ 获取对话历史异常:', error)
    return []
  }
}

// 格式化对话历史为字符串
export function formatConversationHistory(messages: Message[]): string {
  if (messages.length === 0) return ''
  
  const formatted = messages.map(msg => {
    const label = msg.role === 'user' ? '用户' : '助手'
    return `${label}：${msg.content}`
  }).join('\n\n')
  
  return `【对话历史】\n${formatted}\n\n【当前问题】\n`
}

// 清理旧对话（可选，用于定期清理）
export async function cleanupOldConversations(daysOld: number = 7) {
  try {
    const supabase = await getSupabaseClient()
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const { error } = await supabase
      .from('conversation_messages')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (error) {
      console.error('❌ 清理旧对话失败:', error)
      return false
    }

    console.log(`✅ 已清理 ${daysOld} 天前的对话`)
    return true
  } catch (error) {
    console.error('❌ 清理旧对话异常:', error)
    return false
  }
}
