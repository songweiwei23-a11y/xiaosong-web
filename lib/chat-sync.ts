import type { ChatMessage } from './chat-message-utils'
import type { DraftStorage } from './canvas-draft'

export interface ChatSnapshot {
  id: string
  remoteId?: string
  cloudId?: string
  title: string
  difyConversationId: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  wantsFreshWindow?: boolean
}
export interface ChatSyncStatus { state: 'saving' | 'saved' | 'failed'; localProtected: boolean }

export function pendingChatPrefix(ownerId: string, profileId: string | null): string {
  return `kaiwu:pending-chat:${encodeURIComponent(ownerId)}:${encodeURIComponent(profileId || 'default')}:`
}

export function readPendingChats(storage: DraftStorage & { length: number; key(index: number): string | null }, ownerId: string, profileId: string | null): ChatSnapshot[] {
  const prefix = pendingChatPrefix(ownerId, profileId)
  const rows: ChatSnapshot[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(prefix)) continue
      try {
        const value = JSON.parse(storage.getItem(key) || 'null')
        if (value && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.messages)) rows.push(value)
      } catch { /* 单条坏草稿不会阻挡其他记录恢复 */ }
    }
  } catch { /* 隐私模式可能禁止本机存储 */ }
  return rows
}

/** 保存失败后自动重试的等待时间（毫秒） */
export const AUTO_RETRY_DELAYS = [3000, 10000, 30000]

/** 每条对话串行保存。只有确认最新快照入库后才移除本机备份。 */
export class ChatSyncQueue {
  private queues = new Map<string, Promise<boolean>>()
  private remoteIds = new Map<string, string>()
  private revisions = new Map<string, string>()
  private forgotten = new Set<string>()

  constructor(private options: {
    ownerId: string
    profileId: string | null
    storage: DraftStorage
    /** 每次写入前核对会话，避免退出账号后的后台任务写到新账号。 */
    canSync: () => Promise<boolean>
    create: (snapshot: ChatSnapshot, profileId: string | null) => Promise<string | null>
    update: (id: string, snapshot: ChatSnapshot) => Promise<boolean>
    onStatus?: (id: string, status: ChatSyncStatus) => void
    onSaved?: (localId: string, remoteId: string) => void
    /** 保存失败后自动重试前等多久（毫秒）；试完还不行才报失败 */
    retryDelays?: number[]
  }) {}

  /** 生成过程中只留本机快照，不逐 token 请求数据库。 */
  protect(input: ChatSnapshot): boolean {
    if (this.forgotten.has(input.id)) return false
    const serialized = JSON.stringify(input)
    this.revisions.set(input.id, serialized)
    try {
      this.options.storage.setItem(pendingChatPrefix(this.options.ownerId, this.options.profileId) + encodeURIComponent(input.id), serialized)
      return true
    } catch { return false }
  }

  enqueue(input: ChatSnapshot): Promise<boolean> {
    if (this.forgotten.has(input.id)) return Promise.resolve(false)
    const serialized = JSON.stringify(input)
    // 流式 state 会修改对象；异步队列必须持有固定快照。
    const snapshot: ChatSnapshot = JSON.parse(serialized)
    const key = pendingChatPrefix(this.options.ownerId, this.options.profileId) + encodeURIComponent(snapshot.id)
    const localProtected = this.protect(snapshot)
    this.options.onStatus?.(snapshot.id, { state: 'saving', localProtected })
    const previous = this.queues.get(snapshot.id) ?? Promise.resolve(true)
    const work = previous.catch(() => false).then(async () => {
      let ok = false
      const delays = this.options.retryDelays ?? AUTO_RETRY_DELAYS
      for (let attempt = 0; ; attempt++) {
        let accountChanged = false
        try {
          if (!await this.options.canSync() || this.forgotten.has(snapshot.id)) { accountChanged = true; throw new Error('account changed') }
          let remoteId = this.remoteIds.get(snapshot.id) || snapshot.remoteId
          if (!remoteId) remoteId = await this.options.create(snapshot, this.options.profileId) || undefined
          if (remoteId) {
            this.remoteIds.set(snapshot.id, remoteId)
            this.options.onSaved?.(snapshot.id, remoteId)
            if (!await this.options.canSync() || this.forgotten.has(snapshot.id)) { accountChanged = true; throw new Error('account changed') }
            ok = await this.options.update(remoteId, snapshot)
          }
        } catch { ok = false }
        // 2026-10-05：线路抖一下就亮「云端同步失败」，要用户自己点重试。现在先自己等一会儿再试几次；
        // 已经有更新的快照（接着在生成、又改了）就不重试这份旧的，交给新的那次保存
        if (ok || accountChanged || attempt >= delays.length || this.revisions.get(snapshot.id) !== serialized) break
        // 等的时候有新快照进来就不等了，免得挡住后面那次保存
        for (const end = Date.now() + delays[attempt]; Date.now() < end && this.revisions.get(snapshot.id) === serialized;) {
          await new Promise((r) => setTimeout(r, Math.min(250, end - Date.now())))
        }
        if (this.revisions.get(snapshot.id) !== serialized || this.forgotten.has(snapshot.id)) break
      }
      if (this.revisions.get(snapshot.id) === serialized) {
        if (ok) {
          try { if (this.options.storage.getItem(key) === serialized) this.options.storage.removeItem(key) } catch {}
        }
        this.options.onStatus?.(snapshot.id, { state: ok ? 'saved' : 'failed', localProtected })
      }
      return ok
    })
    this.queues.set(snapshot.id, work)
    void work.finally(() => { if (this.queues.get(snapshot.id) === work) this.queues.delete(snapshot.id) })
    return work
  }

  forget(id: string): void {
    this.forgotten.add(id)
    this.revisions.delete(id)
    this.remoteIds.delete(id)
    try { this.options.storage.removeItem(pendingChatPrefix(this.options.ownerId, this.options.profileId) + encodeURIComponent(id)) } catch {}
  }
}
