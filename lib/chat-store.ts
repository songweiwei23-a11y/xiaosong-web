// 对话记录的云端存取
//
// 自由对话页与生成结果下的「持续对话」弹窗都用这里的函数读写
// /api/chat-conversations，避免两处各写一份 fetch 逻辑。
//
// 设计取舍：保存失败一律不抛错，只返回 null 并在控制台留痕。
// 这些调用都发生在用户正在聊天的过程中，网络抖动时最不该做的事
// 就是打断对话——界面照常显示，下一次保存会把完整内容再写一遍。

import { normalizeTimestamp, type ChatMessage } from './chat-message-utils';
import { sanitizeAttachments } from './chat-attachments'
import { sanitizeMessages } from './chat-message-utils'
import { postSafely } from '@/lib/safe-post'

export { normalizeTimestamp, matchesGeneration } from './chat-message-utils'
export type { ChatMessage, ChatRole } from './chat-message-utils'

const saveErrors = new Map<string, string>()
export function getConversationSaveError(id: string): string { return saveErrors.get(id) || '' }
async function responseSaveError(response: Response): Promise<string> {
  try { const data = await response.json(); if (typeof data?.error === 'string') return data.error.slice(0, 500) } catch {}
  return response.status === 401 ? '登录已过期，请重新登录后重试同步' : '云端暂时无法保存，请稍后重试或导出完整历史'
}

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
    messages: sanitizeMessages(rawMessages).map((m: any) => ({
      role: m?.role === 'user' ? 'user' : 'assistant',
      content: typeof m?.content === 'string' ? m.content : '',
      timestamp: normalizeTimestamp(m?.timestamp),
      ...(sanitizeAttachments(m?.attachments).length ? { attachments: sanitizeAttachments(m.attachments) } : {}),
      ...(m.webSearch ? { webSearch: m.webSearch } : {}),
      ...(m.creationSettings ? { creationSettings: m.creationSettings } : {}),
      // 结果画布的各版（lib/canvas）：读回来要带上，不然刷新后画布里改过的都没了
      ...(m.canvas ? { canvas: m.canvas } : {}),
      // 出方案的那几轮（lib/plan-builder）：读回来要带上，不然刷新后大纲编辑器没了
      ...(m.plan ? { plan: m.plan } : {}),
      // 深度研究那一轮（lib/research-meta）：读回来要带上，不然刷新后进度和计划卡片没了
      ...(m.research ? { research: m.research } : {}),
    })),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }
}

export async function listConversations(
  kind: 'free_chat' | 'continuous',
  options: { taskType?: string; limit?: number; offset?: number; profileId?: string | null; strict?: boolean } = {}
): Promise<ChatConversation[]> {
  try {
    const params = new URLSearchParams({ kind })
    if ('profileId' in options) params.set('profileId', options.profileId || 'default')
    if (options.taskType) params.set('taskType', options.taskType)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.offset) params.set('offset', String(options.offset))

    const res = await fetch(`/api/chat-conversations?${params.toString()}`)
    if (!res.ok) { if (options.strict) throw new Error('读取对话失败，请重试'); return [] }
    const rows = await res.json()
    return Array.isArray(rows) ? rows.map(toConversation) : []
  } catch (e) {
    if (options.strict) throw e
    console.warn('[chat-store] 读取对话失败', e)
    return []
  }
}

export async function createConversation(payload: {
  id?: string
  ownerId?: string
  kind: 'free_chat' | 'continuous'
  taskType?: string | null
  profileId?: string | null
  title?: string
  difyConversationId?: string
  messages?: ChatMessage[]
}): Promise<ChatConversation | null> {
  try {
    const res = await postSafely('/api/chat-conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { if (payload.id) saveErrors.set(payload.id, await responseSaveError(res)); return null }
    if (payload.id) saveErrors.delete(payload.id)
    return toConversation(await res.json())
  } catch (e) {
    if (payload.id) saveErrors.set(payload.id, '网络连接失败，请重试同步或先导出完整历史')
    console.warn('[chat-store] 创建对话失败', e)
    return null
  }
}

/** 同一对话按请求顺序写入，避免慢的旧快照覆盖新的画布或回答。 */
const writeQueues = new Map<string, Promise<boolean>>()

export function updateConversation(
  id: string,
  patch: {
    title?: string
    difyConversationId?: string
    messages?: ChatMessage[]
    profileId?: string | null
    ownerId?: string
  }
): Promise<boolean> {
  const previous = writeQueues.get(id) ?? Promise.resolve(true)
  const work = previous.catch(() => false).then(() => writeConversation(id, patch))
  writeQueues.set(id, work)
  void work.finally(() => { if (writeQueues.get(id) === work) writeQueues.delete(id) })
  return work
}

async function writeConversation(id: string, patch: {
  title?: string; difyConversationId?: string; messages?: ChatMessage[]; profileId?: string | null; ownerId?: string
}): Promise<boolean> {
  if (!id) return false
  try {
    const res = await postSafely(`/api/chat-conversations?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) { saveErrors.set(id, await responseSaveError(res)); return false }
    saveErrors.delete(id)
    return true
  } catch (e) {
    saveErrors.set(id, '网络连接失败，请重试同步或先导出完整历史')
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
