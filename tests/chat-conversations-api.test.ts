import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => {
  const calls: Array<[string, ...unknown[]]> = []
  const query: any = {}
  const results: any[] = []
  for (const method of ['select', 'eq', 'order', 'limit', 'range', 'is', 'insert', 'update', 'single', 'maybeSingle', 'delete']) {
    query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query }
  }
  query.then = (resolve: any) => Promise.resolve(results.shift() ?? { data: [], error: null }).then(resolve)
  const guard = { ok: true, userId: 'owner', response: undefined as Response | undefined }
  return { calls, query, results, guard, db: { from: vi.fn(() => query) } }
})
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => mock.guard }))
vi.mock('@/lib/admin-auth', () => ({ getServerSupabase: async () => mock.db }))
import { GET, POST, PUT } from '@/app/api/chat-conversations/route'

const ID = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'
const request = (method: string, body: unknown) => new Request(`https://local/api/chat-conversations?id=${ID}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => { mock.calls.length = 0; mock.results.length = 0; mock.guard.ok = true; mock.guard.response = undefined })

describe('对话历史真实路由行为', () => {
  it('更早历史支持分页，查询始终限制当前账号和目标档案', async () => {
    const rows = [{ id: 'old conversation' }]
    mock.results.push({ data: rows, error: null })
    const result = await GET(new Request(`https://local/api?kind=free_chat&profileId=${PROFILE}&offset=30&limit=30`))
    expect(await result.json()).toEqual(rows)
    expect(mock.calls).toContainEqual(['range', 30, 59])
    expect(mock.calls).toContainEqual(['eq', 'user_id', 'owner'])
    expect(mock.calls).toContainEqual(['eq', 'profile_id', PROFILE])
    expect(mock.calls).toContainEqual(['order', 'id', { ascending: false }])
  })
  it('超出旧阈值的消息和版本完整进入数据库，创建ID可用于重试', async () => {
    mock.results.push({ data: { id: ID }, error: null })
    const messages = Array.from({ length: 550 }, (_, i) => ({ role: 'assistant', content: `正文${i}`, timestamp: i,
      ...(i === 0 ? { canvas: Array.from({ length: 35 }, (_, n) => ({ content: `版本${n}`, at: n, note: '编辑' })) } : {}) }))
    expect((await POST(request('POST', { id: ID, kind: 'free_chat', profileId: PROFILE, messages }))).status).toBe(200)
    const record = mock.calls.find(([name]) => name === 'insert')?.[1] as any
    expect(record.id).toBe(ID)
    expect(record.user_id).toBe('owner')
    expect(record.messages).toHaveLength(550)
    expect(record.messages[0].canvas).toHaveLength(35)
    expect(record.messages[0].content).toBe('正文0')
  })
  it('创建请求超时重试时认回原记录，并再次限制账号权限', async () => {
    mock.results.push({ data: null, error: { code: '23505', message: 'duplicate' } }, { data: { id: ID, messages: [] }, error: null })
    const result = await POST(request('POST', { id: ID, kind: 'free_chat', messages: [] }))
    expect(result.status).toBe(200)
    expect((await result.json()).id).toBe(ID)
    expect(mock.calls).toContainEqual(['eq', 'user_id', 'owner'])
    expect(mock.calls).toContainEqual(['eq', 'id', ID])
  })
  it('不能认回其他账号同ID记录，重复创建仍返回失败', async () => {
    mock.results.push({ data: null, error: { code: '23505', message: 'duplicate' } }, { data: null, error: null })
    expect((await POST(request('POST', { id: ID, kind: 'free_chat', messages: [] }))).status).toBe(500)
    expect(mock.calls).toContainEqual(['eq', 'user_id', 'owner'])
  })
  it('超大历史明确拒绝写入，不偷偷裁切正文或旧记录', async () => {
    const body = { kind: 'free_chat', messages: [{ role: 'assistant', content: 'x'.repeat(8 * 1024 * 1024 + 1) }] }
    expect((await POST(request('POST', body))).status).toBe(413)
    expect(mock.calls.some(([name]) => name === 'insert')).toBe(false)
    expect((await PUT(request('PUT', body))).status).toBe(413)
    expect(mock.calls.some(([name]) => name === 'update')).toBe(false)
  })
  it('保存旧记录只更新明确字段，不抹掉附件、会话ID等未提供字段', async () => {
    mock.results.push({ data: { id: ID }, error: null })
    const result = await PUT(request('PUT', { title: '新标题' }))
    expect(result.status).toBe(200)
    const patch = mock.calls.find(([name]) => name === 'update')?.[1] as any
    expect(patch.title).toBe('新标题')
    expect(patch).not.toHaveProperty('messages')
    expect(patch).not.toHaveProperty('dify_conversation_id')
    expect(mock.calls).toContainEqual(['eq', 'user_id', 'owner'])
  })
  it('未授权更新返回404；损坏请求不会造成未捕获错误', async () => {
    mock.results.push({ data: null, error: null })
    expect((await PUT(request('PUT', { messages: [] }))).status).toBe(404)
    expect((await POST(request('POST', null))).status).toBe(400)
    expect((await PUT(new Request(`https://local/api?id=${ID}`, { method: 'PUT', body: '{' }))).status).toBe(400)
  })
  it('未登录不访问历史；非法档案和对话编号不能进入数据库', async () => {
    expect((await POST(request('POST', { id: 'malformed', kind: 'free_chat' }))).status).toBe(400)
    expect((await PUT(request('PUT', { profileId: 'bad' }))).status).toBe(400)
    expect(mock.calls).toEqual([])
    mock.guard.ok = false; mock.guard.response = new Response('unauthorized', { status: 401 })
    expect((await GET(new Request('https://local/api'))).status).toBe(401)
    expect(mock.calls).toEqual([])
  })
  it('后台保存期间切换登录账号，旧快照不会被写入新账号', async () => {
    expect((await POST(request('POST', { id: ID, ownerId: 'previous owner', kind: 'free_chat', messages: [] }))).status).toBe(409)
    expect((await PUT(request('PUT', { ownerId: 'previous owner', messages: [] }))).status).toBe(409)
    expect(mock.calls).toEqual([])
  })
})
