// 对话记录的云端存取
//
// 自由对话页与生成结果下的「持续对话」弹窗都用这里的函数读写
// /api/chat-conversations，避免两处各写一份 fetch 逻辑。
//
// 设计取舍：保存失败一律不抛错，只返回 null 并在控制台留痕。
// 这些调用都发生在用户正在聊天的过程中，网络抖动时最不该做的事
// 就是打断对话——界面照常显示，下一次保存会把完整内容再写一遍。

import { normalizeTimestamp, type ChatMessage, type ChatRole } from './chat-message-utils'

export { normalizeTimestamp, matchesGeneration } from './chat-message-utils'
export type { ChatMessage, ChatRole } from './chat-message-utils'

export interface ChatConversation {
  id: string
  kind: 'free_chat' | 'continuous'
  taskType: string | null
  profileId: string | null
  title: string
  difyConversationId: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

/** 数据库行 → 前端结构。timestamp 两种来源统一成数字，避免前端再判类型。 */
function toConversation(row: any): ChatConversation {
  const rawMessages = Array.isArray(row?.messages) ? row.messages : []
  return {
    id: row.id,
    kind: row.kind,
    taskType: row.task_type ?? null,
    profileId: row.profile_id ?? null,
    title: row.title || '新对话',
    difyConversationId: row.dify_conversation_id || '',
    messages: rawMessages.map((m: any) => ({
      role: m?.role === 'user' ? 'user' : 'assistant',
      content: typeof m?.content === 'string' ? m.content : '',
      timestamp: normalizeTimestamp(m?.timestamp),
    })),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }
}

export async function listConversations(
  kind: 'free_chat' | 'continuous',
  options: { taskType?: string; limit?: number } = {}
): Promise<ChatConversation[]> {
  try {
    const params = new URLSearchParams({ kind })
    if (options.taskType) params.set('taskType', options.taskType)
    if (options.limit) params.set('limit', String(options.limit))

    const res = await fetch(`/api/chat-conversations?${params.toString()}`)
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows.map(toConversation) : []
  } catch (e) {
    console.warn('[chat-store] 读取对话失败', e)
    return []
  }
}

export async function createConversation(payload: {
  kind: 'free_chat' | 'continuous'
  taskType?: string | null
  profileId?: string | null
  title?: string
  difyConversationId?: string
  messages?: ChatMessage[]
}): Promise<ChatConversation | null> {
  try {
    const res = await fetch('/api/chat-conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    return toConversation(await res.json())
  } catch (e) {
    console.warn('[chat-store] 创建对话失败', e)
    return null
  }
}

export async function updateConversation(
  id: string,
  patch: {
    title?: string
    difyConversationId?: string
    messages?: ChatMessage[]
    profileId?: string | null
  }
): Promise<boolean> {
  if (!id) return false
  try {
    const res = await fetch(`/api/chat-conversations?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch (e) {
    console.warn('[chat-store] 保存对话失败', e)
    return false
  }
}

export async function deleteConversation(id: string): Promise<boolean> {
  if (!id) return false
  try {
    const res = await fetch(`/api/chat-conversations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch (e) {
    console.warn('[chat-store] 删除对话失败', e)
    return false
  }
}
