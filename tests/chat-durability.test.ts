import { describe, expect, it, vi } from 'vitest'
import { canvasDraftKey, clearCanvasDraft, readCanvasDraft, writeCanvasDraft } from '@/lib/canvas-draft'
import { ChatSyncQueue, readPendingChats, type ChatSnapshot } from '@/lib/chat-sync'
import { readCode } from './helpers/source'

function storage() {
  const items = new Map<string, string>()
  return { get length() { return items.size }, key: (n: number) => [...items.keys()][n] || null,
    getItem: (key: string) => items.get(key) || null, setItem: (key: string, value: string) => { items.set(key, value) }, removeItem: (key: string) => { items.delete(key) } }
}
const snapshot = (text = '原稿'): ChatSnapshot => ({ id: 'pending-conversation', cloudId: '11111111-1111-4111-8111-111111111111', title: '创作', difyConversationId: '', createdAt: 1, updatedAt: 2, messages: [{ role: 'assistant', content: text, timestamp: 1 }] })

describe('本机画布草稿', () => {
  it('刷新后可恢复内容及锁定片段，不会读到其他账号、档案、作品的草稿', () => {
    const disk = storage()
    const key = canvasDraftKey('user A', 'profile A', 'work 1')
    const draft = { content: '改了一半', baseContent: '原稿', baseAt: 1, updatedAt: 2, lockedTexts: ['原稿事实'] }
    expect(writeCanvasDraft(disk, key, draft)).toBe(true)
    expect(readCanvasDraft(disk, key)).toEqual(draft)
    expect(readCanvasDraft(disk, canvasDraftKey('user B', 'profile A', 'work 1'))).toBeNull()
    expect(readCanvasDraft(disk, canvasDraftKey('user A', 'profile B', 'work 1'))).toBeNull()
    expect(readCanvasDraft(disk, canvasDraftKey('user A', 'profile A', 'work 2'))).toBeNull()
    expect(clearCanvasDraft(disk, key)).toBe(true)
    expect(readCanvasDraft(disk, key)).toBeNull()
  })
  it('存储空间不足明确返回失败，损坏数据不会影响打开画布', () => {
    const disk = storage()
    disk.setItem('bad', '{')
    expect(readCanvasDraft(disk, 'bad')).toBeNull()
    const unavailable = { ...disk, setItem: () => { throw new Error('quota exceeded') } }
    expect(writeCanvasDraft(unavailable, 'x', { content: '稿', baseContent: '', baseAt: 0, updatedAt: 1, lockedTexts: [] })).toBe(false)
  })
})

describe('云端保存与恢复', () => {
  it('断网时保留完整快照，刷新恢复；重试成功才清除', async () => {
    const disk = storage()
    const update = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const status = vi.fn()
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: 'profile', storage: disk, canSync: async () => true, create: async () => 'remote', update, onStatus: status, retryDelays: [] })
    expect(await queue.enqueue(snapshot())).toBe(false)
    expect(readPendingChats(disk, 'owner', 'profile')).toEqual([snapshot()])
    expect(readPendingChats(disk, 'other', 'profile')).toEqual([])
    expect(readPendingChats(disk, 'owner', 'other')).toEqual([])
    expect(status).toHaveBeenLastCalledWith(snapshot().id, { state: 'failed', localProtected: true })
    expect(await queue.enqueue(snapshot())).toBe(true)
    expect(readPendingChats(disk, 'owner', 'profile')).toEqual([])
    expect(status).toHaveBeenLastCalledWith(snapshot().id, { state: 'saved', localProtected: true })
  })
  it('连续写入串行执行，旧请求成功不会提前删除更新的草稿', async () => {
    const disk = storage()
    let finishFirst!: (ok: boolean) => void
    const update = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finishFirst = resolve })).mockResolvedValueOnce(true)
    const create = vi.fn(async () => 'remote')
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: disk, canSync: async () => true, create, update })
    const first = queue.enqueue(snapshot('第一版'))
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const second = queue.enqueue(snapshot('第二版'))
    expect(update).toHaveBeenCalledTimes(1)
    finishFirst(true)
    await first
    expect(readPendingChats(disk, 'owner', null)[0]?.messages[0].content).toBe('第二版')
    await second
    expect(update.mock.calls.map(call => call[1].messages[0].content)).toEqual(['第一版', '第二版'])
    expect(create).toHaveBeenCalledTimes(1)
    expect(disk.length).toBe(0)
  })
  it('流式本机保护不调用云端，消息对象后续改变不会污染已排队快照', async () => {
    const disk = storage()
    const update = vi.fn(async (_id: string, _snapshot: ChatSnapshot) => true)
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: disk, canSync: async () => true, create: async () => 'remote', update })
    const data = snapshot('已有半篇')
    expect(queue.protect(data)).toBe(true)
    expect(update).not.toHaveBeenCalled()
    const result = queue.enqueue(data)
    data.messages[0].content = '下一次 state 修改'
    await result
    expect(update.mock.calls[0][1].messages[0].content).toBe('已有半篇')
  })
  it('换账号后不写入新账号，失败草稿仍属于原账号', async () => {
    const disk = storage()
    const create = vi.fn(async () => 'remote')
    const queue = new ChatSyncQueue({ ownerId: 'original', profileId: null, storage: disk, canSync: async () => false, create, update: async () => true })
    expect(await queue.enqueue(snapshot())).toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(readPendingChats(disk, 'original', null)).toHaveLength(1)
    expect(readPendingChats(disk, 'new account', null)).toHaveLength(0)
  })
  it('用户明确删除后，排队任务不会重新创建对话', async () => {
    const disk = storage()
    const create = vi.fn(async () => 'remote')
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: disk, canSync: async () => true, create, update: async () => true })
    const job = queue.enqueue(snapshot())
    queue.forget(snapshot().id)
    expect(await job).toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(disk.length).toBe(0)
  })
  it('浏览器禁止本机存储时，仍可云端保存；失败时不宣称本机已备份', async () => {
    const disk = { ...storage(), setItem: () => { throw new Error('storage denied') } }
    const status = vi.fn()
    const update = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: disk, canSync: async () => true, create: async () => 'remote', update, onStatus: status, retryDelays: [] })
    expect(await queue.enqueue(snapshot())).toBe(false)
    expect(status).toHaveBeenLastCalledWith(snapshot().id, { state: 'failed', localProtected: false })
    expect(await queue.enqueue(snapshot())).toBe(true)
    expect(status).toHaveBeenLastCalledWith(snapshot().id, { state: 'saved', localProtected: false })
  })
  // 2026-10-05 线上：长对话发消息时线路抖了一下，保存失败就一直亮「云端同步失败」，要用户自己点重试
  it('保存失败先自己重试，重试成功就不报失败', async () => {
    const disk = storage()
    const status = vi.fn()
    const update = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: disk, canSync: async () => true, create: async () => 'remote', update, onStatus: status, retryDelays: [5, 5, 5] })
    expect(await queue.enqueue(snapshot())).toBe(true)
    expect(update).toHaveBeenCalledTimes(3)
    expect(status.mock.calls.map(c => c[1].state)).toEqual(['saving', 'saved'])
    expect(disk.length).toBe(0)
  })
  it('重试次数用完才报失败', async () => {
    const status = vi.fn()
    const update = vi.fn(async () => false)
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: storage(), canSync: async () => true, create: async () => 'remote', update, onStatus: status, retryDelays: [5, 5] })
    expect(await queue.enqueue(snapshot())).toBe(false)
    expect(update).toHaveBeenCalledTimes(3)
    expect(status).toHaveBeenLastCalledWith(snapshot().id, { state: 'failed', localProtected: true })
  })
  it('等着重试时来了新快照：旧的不再重试，马上让新的保存', async () => {
    const update = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const queue = new ChatSyncQueue({ ownerId: 'owner', profileId: null, storage: storage(), canSync: async () => true, create: async () => 'remote', update, retryDelays: [60_000] })
    const first = queue.enqueue(snapshot('第一版'))
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const started = Date.now()
    expect(await queue.enqueue(snapshot('第二版'))).toBe(true)
    expect(await first).toBe(false)
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(update.mock.calls.map(call => call[1].messages[0].content)).toEqual(['第一版', '第二版'])
  })
  it('页面接线：自由对话用的保存队列没有关掉自动重试', () => {
    expect(readCode('app/dashboard/free-chat/page.tsx')).toMatch(/new ChatSyncQueue\(/)
    expect(readCode('app/dashboard/free-chat/page.tsx')).not.toMatch(/retryDelays:\s*\[\]/)
  })
})
