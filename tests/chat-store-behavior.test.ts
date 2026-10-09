import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/safe-post', () => ({ postSafely: (url: string, init: RequestInit) => fetch(url, init) }))
import { createConversation, getConversationSaveError, listConversations, updateConversation } from '@/lib/chat-store'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('云端存取行为', () => {
  it('分页参数及档案过滤传到真实请求，服务端读取失败不冒充空历史', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetcher)
    await listConversations('free_chat', { profileId: 'profile', offset: 30, limit: 30, strict: true })
    const url = new URL(fetcher.mock.calls[0][0], 'https://local')
    expect(url.searchParams.get('profileId')).toBe('profile')
    expect(url.searchParams.get('offset')).toBe('30')
    await expect(listConversations('free_chat', { strict: true })).rejects.toThrow('读取对话失败')
  })

  it('旧ISO时间戳、550条消息和35个版本全部读回，不裁切', async () => {
    const messages = Array.from({ length: 550 }, (_, i) => ({ role: 'assistant', content: String(i), timestamp: '2026-09-30T00:00:00Z',
      ...(i === 0 ? { canvas: Array.from({ length: 35 }, (_, n) => ({ content: `版本${n}`, at: n, note: '编辑', parentAt: n - 1 })) } : {}) }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'old', kind: 'free_chat', messages, created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' }]))))
    const [conv] = await listConversations('free_chat')
    expect(conv.messages).toHaveLength(550)
    expect(conv.messages[0].canvas).toHaveLength(35)
    expect(conv.messages[0].timestamp).toBe(Date.parse('2026-09-30T00:00:00Z'))
    expect(conv.messages[0].canvas?.at(-1)?.parentAt).toBe(33)
  })

  it('保存失败把具体原因留下，成功重试清除错误', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: '此对话过大，历史未裁切；请先导出保存' }), { status: 413 }))
      .mockResolvedValueOnce(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    expect(await updateConversation('size-limit', { title: '标题' })).toBe(false)
    expect(getConversationSaveError('size-limit')).toContain('历史未裁切')
    expect(await updateConversation('size-limit', { title: '标题' })).toBe(true)
    expect(getConversationSaveError('size-limit')).toBe('')
  })

  it('同一会话直接调用两次更新也串行写入，不让旧请求覆盖新版本', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })).mockResolvedValueOnce(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    const first = updateConversation('serial', { title: '旧标题' })
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const second = updateConversation('serial', { title: '新标题' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    finish(new Response('{}'))
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body).title)).toEqual(['旧标题', '新标题'])
  })

  it('创建传稳定ID和账号身份；断网失败明确保留错误可供恢复提示', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'idempotent', kind: 'free_chat', messages: [] })))
    vi.stubGlobal('fetch', fetcher)
    const data = { id: 'idempotent', ownerId: 'owner', kind: 'free_chat' as const, messages: [] }
    expect(await createConversation(data)).toBeNull()
    expect(getConversationSaveError('idempotent')).toContain('网络连接失败')
    expect((await createConversation(data))?.id).toBe('idempotent')
    expect(getConversationSaveError('idempotent')).toBe('')
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ id: 'idempotent', ownerId: 'owner' })
  })
})
