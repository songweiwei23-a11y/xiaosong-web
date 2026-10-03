import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn(), usage: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: () => state.guard(), incrementUsageServer: state.usage }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(), clearDifyConversationId: vi.fn(), startNewWindow: vi.fn(), isInvalidConversationError: () => false }));
vi.mock('@/lib/topic-library-server', () => ({ loadPriorTopicTitles: vi.fn(async () => []), saveFollowUpTopics: vi.fn() }));
import { signAttachment } from '@/lib/chat-attachments-server';
const userId = '11111111-1111-1111-1111-111111111111';
let POST: typeof import('@/app/api/dify/chat/route').POST;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('DIFY_API_KEY', 'test-only-key');
  vi.stubGlobal('fetch', state.fetch); state.guard.mockResolvedValue({ ok: true, userId });
  POST = (await import('@/app/api/dify/chat/route')).POST;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function call(files: unknown) {
  return POST(new Request('http://localhost/api/dify/chat', { method: 'POST', body: JSON.stringify({ query: '【档案背景】餐饮账号\n【我的问题】今天有什么科技新闻？', question: '今天有什么科技新闻？', freeChat: true, files }) }) as any);
}
describe('自由对话将附件与联网状态传给页面', () => {
  it('真实账号上传的文件进入模型，搜索使用问题而非档案背景', async () => {
    const raw = { id: '22222222-2222-2222-2222-222222222222', name: '资料.pdf', type: 'document' as const, size: 123, storagePath: `${userId}/33333333-3333-3333-3333-333333333333/file.pdf` };
    const events = [{ event: 'node_started', data: { title: 'Tavily Search' } }, { event: 'node_finished', data: { title: 'Tavily Search', status: 'succeeded', outputs: { json: [{ results: [{ title: '新闻', url: 'https://example.com/news' }] }] } } }, { event: 'message', answer: '文件已分析', conversation_id: 'c1' }];
    state.fetch.mockResolvedValue(new Response(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')));
    const response = await call([{ ...raw, token: signAttachment(userId, raw) }]);
    const stream = await response.text();
    expect(stream).toContain('"event":"web_search","status":"done"');
    expect(stream).toContain('https://example.com/news');
    const payload = JSON.parse(state.fetch.mock.calls[0][1].body);
    expect(payload.user).toBe(userId); expect(payload.files[0].upload_file_id).toBe(raw.id);
    expect(payload.inputs.search_query).toBe('今天有什么科技新闻？');
    expect(payload.query).toContain('【高阶自由对话】');
  });
  it('伪造附件不调用模型，文字对话仍然可用', async () => {
    expect((await call([{ id: 'forged' }])).status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"正常回答"}\n\n'));
    expect(await (await call(undefined)).text()).toContain('正常回答');
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).files).toBeUndefined();
  });
  it('替换答复后，计次记录保存最终正文而非重复拼接', async () => {
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"半段"}\n\ndata: {"event":"message_replace","answer":"最终完整答复"}\n\n'));
    await (await call(undefined)).text();
    expect(state.usage.mock.calls[0][3].answer).toBe('最终完整答复');
  });
});
