// 对话记录的纯逻辑：时间戳归一、入库前清洗、追问对话的认回判定。
//
// 单独成文件是为了让服务端（app/api/chat-conversations）与客户端
// （lib/chat-store、ContinuousDialog）共用同一份规则，且能直接写单元测试——
// 放在 route.ts 或组件里都没法独立测。

import { sanitizeAttachments, type ChatAttachment } from './chat-attachments'
import { sanitizeWebSources, type WebSearchStatus } from './dify-web-status'
import { mergeCreationSettings, type CreationSettings } from './creation-settings'
import { sanitizeCanvasVersions, type CanvasVersion } from './canvas'
import { readPlanMeta, type PlanMeta } from './plan-builder'
import { readResearchMeta, type ResearchMeta } from './research-meta'
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
  /** 出方案（lib/plan-builder）：这一轮是大纲还是全文、场景、确认的大纲。提问和回答都带 */
  plan?: PlanMeta
  /** 深度研究（lib/research-meta）：研究编号和状态；报告写完后放在 content 里 */
  research?: ResearchMeta
}

/**
 * 旧版阈值，仅作为长会话分段展示的参考。存储时不再裁切历史。
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
  plan?: unknown
  research?: unknown
}

/**
 * 入库前清洗：丢掉结构不合法的条目，完整保留合法消息。
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
  plan?: PlanMeta
  /** 深度研究（lib/research-meta）：研究编号和状态；报告写完后放在 content 里 */
  research?: ResearchMeta
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
      ...(readPlanMeta(m.plan) ? { plan: readPlanMeta(m.plan)! } : {}),
      ...(readResearchMeta(m.research) ? { research: readResearchMeta(m.research)! } : {}),
      ...(m.webSearch && typeof m.webSearch === 'object' && 'status' in m.webSearch && ['done', 'unavailable', 'quota_exhausted'].includes(String(m.webSearch.status))
        ? { webSearch: { status: m.webSearch.status as 'done' | 'unavailable' | 'quota_exhausted', sources: sanitizeWebSources('sources' in m.webSearch ? m.webSearch.sources : []),
            ...('message' in m.webSearch && typeof m.webSearch.message === 'string' ? { message: m.webSearch.message.slice(0, 500) } : {}) } } : {}),
      timestamp:
        typeof m.timestamp === 'number' || typeof m.timestamp === 'string'
          ? m.timestamp
          : Date.now(),
    }))
  return cleaned
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
