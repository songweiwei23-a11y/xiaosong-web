// 对话记录的纯逻辑：时间戳归一、入库前清洗、追问对话的认回判定。
//
// 单独成文件是为了让服务端（app/api/chat-conversations）与客户端
// （lib/chat-store、ContinuousDialog）共用同一份规则，且能直接写单元测试——
// 放在 route.ts 或组件里都没法独立测。

import { sanitizeAttachments, type ChatAttachment } from './chat-attachments'
import { sanitizeWebSources, type WebSearchStatus } from './dify-web-status'
import { mergeCreationSettings, type CreationSettings } from './creation-settings'
import { sanitizeCanvasVersions, type CanvasVersion } from './canvas'
export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
  /** 存储时可能是数字或 ISO 字符串，读回后统一成数字 */
  timestamp: number
  attachments?: ChatAttachment[]
  webSearch?: WebSearchStatus
  creationSettings?: CreationSettings
  /** 结果画布里改过的各版（lib/canvas）。第一版是 AI 原稿 */
  canvas?: CanvasVersion[]
}

/**
 * 单个会话保留的最大消息数。正常对话远达不到，这里只是防止异常写入
 * 把单行撑到无法读取——超出时丢最旧的，保住最近的上下文。
 */
export const MAX_MESSAGES = 500

/**
 * 时间戳归一。
 *
 * 自由对话页存的是 Date.now() 数字，持续对话弹窗存的是 Date 序列化后的
 * ISO 字符串。不归一的话，弹窗在读回字符串时调用 timestamp.toLocaleTimeString()
 * 会直接抛错。
 */
export function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return Date.now()
}

type IncomingMessage = {
  role?: unknown
  content?: unknown
  timestamp?: unknown
  attachments?: unknown
  webSearch?: unknown
  creationSettings?: unknown
  canvas?: unknown
}

/**
 * 入库前清洗：丢掉结构不合法的条目，超长时只保留最近的部分。
 * timestamp 原样保留（数字或字符串都可），读回时再由 normalizeTimestamp 归一。
 */
export function sanitizeMessages(input: unknown): Array<{
  role: ChatRole
  content: string
  timestamp: number | string
  attachments?: ChatAttachment[]
  webSearch?: WebSearchStatus
  creationSettings?: CreationSettings
  canvas?: CanvasVersion[]
}> {
  if (!Array.isArray(input)) return []
  const cleaned = input
    .filter((m): m is IncomingMessage => !!m && typeof m === 'object')
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as ChatRole,
      content: typeof m.content === 'string' ? m.content : '',
      ...(m.creationSettings && typeof m.creationSettings === 'object' ? { creationSettings: mergeCreationSettings(m.creationSettings) } : {}),
      ...(sanitizeAttachments(m.attachments).length ? { attachments: sanitizeAttachments(m.attachments) } : {}),
      ...(sanitizeCanvasVersions(m.canvas).length ? { canvas: sanitizeCanvasVersions(m.canvas) } : {}),
      ...(m.webSearch && typeof m.webSearch === 'object' && 'status' in m.webSearch && ['done', 'unavailable', 'quota_exhausted'].includes(String(m.webSearch.status))
        ? { webSearch: { status: m.webSearch.status as 'done' | 'unavailable' | 'quota_exhausted', sources: sanitizeWebSources('sources' in m.webSearch ? m.webSearch.sources : []),
            ...('message' in m.webSearch && typeof m.webSearch.message === 'string' ? { message: m.webSearch.message.slice(0, 500) } : {}) } } : {}),
      timestamp:
        typeof m.timestamp === 'number' || typeof m.timestamp === 'string'
          ? m.timestamp
          : Date.now(),
    }))
  return cleaned.length > MAX_MESSAGES ? cleaned.slice(-MAX_MESSAGES) : cleaned
}

/**
 * 判断云端某条记录是否就是「本次生成结果」对应的追问对话。
 *
 * 追问对话的第一条永远是生成结果原文，用它比对即可认回。
 * 只比开头一段并附带长度校验，避免每次都对上万字的正文做全量比较。
 */
export function matchesGeneration(
  firstMessage: { role?: string; content?: string } | undefined,
  initialContent: string
): boolean {
  if (!firstMessage || firstMessage.role !== 'assistant') return false
  const stored = firstMessage.content
  if (typeof stored !== 'string') return false
  if (stored.length !== initialContent.length) return false
  return stored.slice(0, 200) === initialContent.slice(0, 200)
}
