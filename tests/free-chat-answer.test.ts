import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchFreeChatWeb } from '@/lib/free-chat-web';

const state = vi.hoisted(() => ({ fetch: vi.fn(), enabled: false }));
vi.mock('@/lib/free-chat-web', () => ({ searchFreeChatWeb: vi.fn(async () => null) }));
vi.mock('@/lib/api-guard', () => ({
  requireUserWithQuota: vi.fn(async () => ({ ok: true, userId: 'test-user' })),
  incrementUsageServer: vi.fn(async () => {}),
}));
vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'test-user', feature: 'freeChat', requestId: 'test-request-id-12345' } })),
  releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})),
}));
vi.mock('@/lib/dify-conversation', () => ({
  getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(),
  clearDifyConversationId: vi.fn(), startNewWindow: vi.fn(), isInvalidConversationError: () => false,
}));
vi.mock('@/lib/topic-library-server', () => ({ loadPriorTopicTitles: vi.fn(async () => []), saveFollowUpTopics: vi.fn() }));
vi.mock('@/lib/web-search-quota', () => ({ prepareWebSearch: vi.fn(async () => ({
  enabled: state.enabled, inputs: { web_search_enabled: state.enabled ? '1' : '0' },
  initialEvent: null, observe: vi.fn(), finish: vi.fn(), rejected: vi.fn(), markStarted: vi.fn(),
})) }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); state.enabled = false;
  vi.stubEnv('DIFY_API_KEY', 'test-only-key'); vi.stubGlobal('fetch', state.fetch);
  state.fetch.mockImplementation(async () => new Response('data: {"event":"message","answer":"正文"}\n\ndata: {"event":"message_end"}\n\n'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function send(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/dify/chat/route');
  await (await POST(new Request('http://localhost/api/dify/chat', { method: 'POST', body: JSON.stringify(body) }) as any)).text();
  return JSON.parse(state.fetch.mock.calls[0][1].body);
}

describe('自由对话详细回答策略接入真实请求路径', () => {
  it('联网获准时，两处模型输入携带详细分析及证据规则，搜索仍只用原问题', async () => {
    state.enabled = true;
    const payload = await send({ freeChat: true, query: '【档案】衣柜老板\n【我的问题】查一下短视频运营方法', question: '查一下短视频运营方法', webSearchMode: 'on' });
    expect(payload.query).toBe(payload.inputs.query);
    expect(payload.query).toContain('详细展开');
    expect(payload.query).toContain('只引用本轮真实返回的来源链接');
    expect(payload.query).toContain('优先遵守');
    expect(payload.inputs.search_query).not.toContain('详细展开');
    expect(payload.inputs.web_search_enabled).toBe('1');
  });

  it('用户请求联网但额度未获准时，不能声称本轮已搜索', async () => {
    const payload = await send({ freeChat: true, query: '查一下当前规则', webSearchMode: 'on' });
    expect(payload.query).toContain('本轮没有获得联网授权');
    expect(payload.query).not.toContain('系统已允许本轮联网');
    expect(payload.inputs.web_search_enabled).toBe('0');
  });

  it('非自由对话的局部追问保持原要求，不被长报告规则覆盖', async () => {
    const payload = await send({ query: '只改这一句，输出20字以内', taskType: '画布改写' });
    expect(payload.query).toBe('只改这一句，输出20字以内');
    expect(payload.query).not.toContain('详细展开');
  });

  it('服务端已联网时关闭工作流二次搜索，真实来源同时传给模型和页面', async () => {
    state.enabled = true;
    vi.mocked(searchFreeChatWeb).mockResolvedValueOnce({
      status: { status: 'done', sources: [{ title: '官方文档', url: 'https://docs.dify.ai/en/llm' }] },
      context: '【本轮联网原始资料】真实网页正文', query: 'Dify LLM', strategy: 'pro-fetch', readCount: 1,
    });
    const { POST } = await import('@/app/api/dify/chat/route');
    const res = await POST(new Request('http://localhost/api/dify/chat', { method: 'POST', body: JSON.stringify({ query: '查Dify文档', freeChat: true, webSearchMode: 'on' }) }) as any);
    const text = await res.text(), payload = JSON.parse(state.fetch.mock.calls[0][1].body);
    expect(payload.query).toContain('真实网页正文'); expect(payload.query).toContain('详细展开');
    expect(payload.inputs.web_search_enabled).toBe('0');
    expect(payload.inputs.web_search_note).toContain('已由开物服务端执行');
    expect(payload.inputs.search_query).toBe('');
    expect(text).toContain('"status":"done"'); expect(text).toContain('https://docs.dify.ai/en/llm');
  });
});
