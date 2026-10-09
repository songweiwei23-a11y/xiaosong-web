vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'test-user', feature: 'script', requestId: 'test-request-id-12345' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn(), usage: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: () => state.guard(), incrementUsageServer: state.usage }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(), clearDifyConversationId: vi.fn(), startNewWindow: vi.fn(), isInvalidConversationError: () => false }));
vi.mock('@/lib/topic-library-server', () => ({ loadPriorTopicTitles: vi.fn(async () => []), saveFollowUpTopics: vi.fn() }));
import { signAttachment } from '@/lib/chat-attachments-server';
import { releaseCreation } from '@/lib/creation-quota';
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
  it('审稿首次追问用当前稿件开独立会话，后续使用调用方的审稿会话', async () => {
    const { getDifyConversationId, saveDifyConversationId } = await import('@/lib/dify-conversation');
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"保留原稿细节"}\n\ndata: {"event":"message_end","conversation_id":"review-own"}\n\n'));
    const response = await POST(new Request('https://local/api/dify/chat', { method: 'POST', body: JSON.stringify({ taskType: '审稿优化', query: '把第二段改自然一点', initialContent: '凌晨4点。她在揉面。', conversationId: 'review-own' }) }) as any);
    await response.text();
    expect(getDifyConversationId).not.toHaveBeenCalled();
    expect(saveDifyConversationId).not.toHaveBeenCalled();
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).conversation_id).toBe('review-own');
  });
  it('带选定方案不读取或覆盖档案旧窗口，但仍可延续调用方自己的对话', async () => {
    const { getDifyConversationId, saveDifyConversationId } = await import('@/lib/dify-conversation');
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"国庆后县城消费观察"}\n\ndata: {"event":"message_end","conversation_id":"new-focus-thread"}\n\n'));
    const response = await POST(new Request('http://localhost/api/dify/chat', { method: 'POST', body: JSON.stringify({ query: '拓展这个方向', freeChat: true, conversationId: 'own-focus-thread', creationSettings: { focusContent: '国庆后县城消费观察', userIntent: '做流量讨论' } }) }) as any);
    await response.text();
    expect(getDifyConversationId).not.toHaveBeenCalled();
    expect(saveDifyConversationId).not.toHaveBeenCalled();
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).conversation_id).toBe('own-focus-thread');
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).query).toContain('国庆后县城消费观察');
  });
  it('浏览器关页后继续读取完整上游并确认次数，不误释放', async () => {
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { upstream = c; } });
    state.fetch.mockResolvedValue(new Response(body));
    const response = await call(undefined);
    await response.body!.cancel();
    upstream.enqueue(new TextEncoder().encode('data: {"event":"message","answer":"完整正文"}\n\ndata: {"event":"message_end"}\n\n'));
    upstream.close();
    await vi.waitFor(() => expect(state.usage).toHaveBeenCalledTimes(1));
    expect(releaseCreation).not.toHaveBeenCalled();
  });
  it('部分文字后出现上游错误，不扣成功次数并释放预占', async () => {
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"半段"}\n\ndata: {"event":"error","message":"failed"}\n\ndata: {"event":"message_end"}\n\n'));
    expect(await (await call(undefined)).text()).toContain('"event":"error"');
    expect(state.usage).not.toHaveBeenCalled();
    expect(releaseCreation).toHaveBeenCalledTimes(1);
  });

  it('没有结束标记的半截回答不算成功', async () => {
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"半段"}\n\n'));
    expect(await (await call(undefined)).text()).toContain('没有完整结束');
    expect(state.usage).not.toHaveBeenCalled();
    expect(releaseCreation).toHaveBeenCalledTimes(1);
  });
  it('真实账号上传的文件进入模型，搜索使用问题而非档案背景', async () => {
    const raw = { id: '22222222-2222-2222-2222-222222222222', name: '资料.pdf', type: 'document' as const, size: 123, storagePath: `${userId}/33333333-3333-3333-3333-333333333333/file.pdf` };
    const events = [{ event: 'node_started', data: { title: 'Tavily Search' } }, { event: 'node_finished', data: { title: 'Tavily Search', status: 'succeeded', outputs: { json: [{ results: [{ title: '新闻', url: 'https://example.com/news' }] }] } } }, { event: 'message', answer: '文件已分析', conversation_id: 'c1' }];
    state.fetch.mockResolvedValue(new Response([...events, { event: 'message_end' }].map(e => `data: ${JSON.stringify(e)}\n\n`).join('')));
    const response = await call([{ ...raw, token: signAttachment(userId, raw) }]);
    const stream = await response.text();
    expect(stream).toContain('"event":"web_search","status":"done"');
    expect(stream).toContain('https://example.com/news');
    const payload = JSON.parse(state.fetch.mock.calls[0][1].body);
    expect(payload.user).toBe(userId); expect(payload.files[0].upload_file_id).toBe(raw.id);
    // 检索词用问题，不用档案背景。知识库分流（lib/kb-routing）开关打开后，和短视频无关又没联网的问题会传空
    const { KB_ROUTING_ENABLED } = await import('@/lib/kb-routing');
    expect(payload.inputs.search_query).toBe(KB_ROUTING_ENABLED ? '' : '今天有什么科技新闻？');
    expect(payload.inputs.search_query).not.toContain('餐饮账号');
    expect(payload.query).toContain('【高阶自由对话】');
  });
  it('问短视频相关的事：检索词用用户的问题，而不是档案背景', async () => {
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"好"}\n\ndata: {"event":"message_end"}\n\n'));
    await POST(new Request('http://localhost/api/dify/chat', { method: 'POST', body: JSON.stringify({ query: '【档案背景】餐饮账号\n【我的问题】帮我写一条探店口播脚本', question: '帮我写一条探店口播脚本', freeChat: true }) }) as any);
    const payload = JSON.parse(state.fetch.mock.calls[0][1].body);
    expect(payload.inputs.search_query).toBe('帮我写一条探店口播脚本');
  });
  it('伪造附件不调用模型，文字对话仍然可用', async () => {
    expect((await call([{ id: 'forged' }])).status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"正常回答"}\n\ndata: {"event":"message_end"}\n\n'));
    expect(await (await call(undefined)).text()).toContain('正常回答');
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).files).toBeUndefined();
  });
  it('替换答复后，计次记录保存最终正文而非重复拼接', async () => {
    state.fetch.mockResolvedValue(new Response('data: {"event":"message","answer":"半段"}\n\ndata: {"event":"message_replace","answer":"最终完整答复"}\n\ndata: {"event":"message_end"}\n\n'));
    await (await call(undefined)).text();
    expect(state.usage.mock.calls[0][3].answer).toBe('最终完整答复');
  });
});
