vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'test-user', feature: 'script', requestId: 'test-request-id-12345' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ inserted: [] as any[], onPersist: (() => {}) as () => void, allowed: true, auditFails: false }));
vi.mock('@/lib/dify-task', () => ({ askDify: vi.fn(async () => state.auditFails ? { ok: false, message: 'audit failed' } : { ok: true, text: '## 纯文字文案\n她在揉面，手上全是白。', completion: { terminal: 'message_end', conversationId: 'verified-review', messageId: 'verified-message', usage: { total_tokens: 20 } } }) }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: async () => state.allowed ? { ok: true, userId: 'owner' } : { ok: false, response: Response.json({}, { status: 401 }) }, incrementUsageServer: vi.fn(async () => {}) }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => 'unrelated-old-window'), saveDifyConversationId: vi.fn(), clearDifyConversationId: vi.fn(), isInvalidConversationError: () => false }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({
  from: () => {
    const query: any = {
      select: () => query, eq: () => query, order: () => query, limit: () => query, or: () => query,
      maybeSingle: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      insert: async (row: any) => { state.inserted.push(row); state.onPersist(); return { error: null }; },
    }; return query;
  },
}) }));
import { POST } from '@/app/api/dify/stream/route';
import { getDifyConversationId, saveDifyConversationId } from '@/lib/dify-conversation';
import { creationSettingsBlock } from '@/lib/creation-settings';
import { askDify } from '@/lib/dify-task';
import { recordCreationCompletion, releaseCreation } from '@/lib/creation-quota';
const A = '11111111-1111-4111-8111-111111111111';
const H = '33333333-3333-4333-8333-333333333333';
const request = () => new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '跨行业二创', query: '本轮原片', profileId: A, historyId: H, historyInput: { source: '汽修' } }) }) as NextRequest;
const encoder = new TextEncoder();
const complete = 'data: {"event":"message","answer":"完整二创方案"}\n\ndata: {"event":"message_end"}\n\n';
afterEach(() => { vi.unstubAllGlobals(); state.allowed = true; state.auditFails = false; state.onPersist = () => {}; state.inserted.length = 0; });

describe('生成由服务端存档', () => {
  it('直接填主题且未传userIntent的旧标题客户端也检查未采访状态', async () => {
    vi.mocked(askDify).mockClear();vi.mocked(recordCreationCompletion).mockClear();
    vi.mocked(askDify).mockResolvedValueOnce({ok:true,text:'### 1. 国庆前后，生意有什么变化？',completion:{terminal:'message_end',usage:{total_tokens:20}}});
    const answer='### 1. 国庆后这条街的生意，我挨家问了一遍';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(`data: {"event":"message","answer":${JSON.stringify(answer)}}\n\ndata: {"event":"message_end"}\n\n`)));
    const req=new Request('https://local/api/dify/stream',{method:'POST',body:JSON.stringify({taskType:'标题封面',query:'标题提示词',creationSettings:{titleCount:1,topic:'尚未采访：国庆前后生意变化'}})}) as NextRequest;
    const stream=await (await POST(req)).text();
    expect(stream).not.toContain('我挨家问了一遍');expect(stream).toContain('生意有什么变化');
    expect(askDify).toHaveBeenCalledTimes(1);expect(recordCreationCompletion).toHaveBeenCalledTimes(1);
  });
  it('主题没有声明未采访时，不把通用提示词里的禁令误作用户状态', async () => {
    vi.mocked(askDify).mockClear();
    const answer='### 1. 我问了三家店';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(`data: {"event":"message","answer":${JSON.stringify(answer)}}\n\ndata: {"event":"message_end"}\n\n`)));
    const req=new Request('https://local/api/dify/stream',{method:'POST',body:JSON.stringify({taskType:'标题封面',query:'通用规则：尚未采访不得预写回答',creationSettings:{titleCount:1,topic:'三家店采访实录'}})}) as NextRequest;
    const stream=await (await POST(req)).text();
    expect(stream).toContain('我问了三家店');expect(askDify).not.toHaveBeenCalled();
  });
  it('标题先通过交付检查再发送，末行无换行也能完成，字数使用实际计数', async () => {
    vi.mocked(askDify).mockClear();
    vi.mocked(recordCreationCompletion).mockClear();
    const answer='### 1. 买衣柜先看开门空间\n- **字数**：99字';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(`data:{"event":"message","answer":${JSON.stringify(answer)}}\n\ndata:{"event":"message_end"}`)));
    const req=new Request('https://local/api/dify/stream',{method:'POST',body:JSON.stringify({taskType:'标题封面',query:'家具标题',creationSettings:{titleCount:1}})}) as NextRequest;
    const stream=await (await POST(req)).text();
    expect(stream).toContain('9 字（不含标点和空格）');
    expect(stream).not.toContain('99字');
    expect(askDify).not.toHaveBeenCalled();
    expect(recordCreationCompletion).toHaveBeenCalledTimes(1);
  });
  it('标题校对仍不合格，不交付初稿、不扣成功次数', async () => {
    vi.mocked(askDify).mockClear();
    vi.mocked(recordCreationCompletion).mockClear();vi.mocked(releaseCreation).mockClear();
    const answer='### 1. 我问了三家店';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(`data: {"event":"message","answer":${JSON.stringify(answer)}}\n\ndata: {"event":"message_end"}\n\n`)));
    const req=new Request('https://local/api/dify/stream',{method:'POST',body:JSON.stringify({taskType:'标题封面',query:'采访标题',creationSettings:{titleCount:1,userIntent:'尚未采访'}})}) as NextRequest;
    const stream=await (await POST(req)).text();
    expect(stream).not.toContain('我问了三家店');
    expect(stream).toContain('结果未满足本轮数量或事实状态要求');
    expect(askDify).toHaveBeenCalledTimes(1);
    expect(recordCreationCompletion).not.toHaveBeenCalled();
    expect(releaseCreation).toHaveBeenCalledTimes(1);
  });
  it('二创数量不符只校对一次，修好后只交付一个方案并合并实际用量', async () => {
    vi.mocked(askDify).mockClear();vi.mocked(recordCreationCompletion).mockClear();
    vi.mocked(askDify).mockResolvedValueOnce({ok:true,text:'### 方案 1：柜门演示',completion:{terminal:'message_end',usage:{total_tokens:20}}});
    const answer='### 方案 1：柜门演示\n### 方案 2：不需要的方案';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(`data: {"event":"message","answer":${JSON.stringify(answer)}}\n\ndata: {"event":"message_end"}\n\n`)));
    const req=new Request('https://local/api/dify/stream',{method:'POST',body:JSON.stringify({taskType:'跨行业二创',query:'二创一个方案',historyInput:{count:1}})}) as NextRequest;
    const stream=await (await POST(req)).text();
    expect(stream).toContain('柜门演示');expect(stream).not.toContain('不需要的方案');
    expect(askDify).toHaveBeenCalledTimes(1);expect(recordCreationCompletion).toHaveBeenCalledTimes(1);
    expect(recordCreationCompletion).toHaveBeenLastCalledWith(expect.anything(),expect.objectContaining({usage:expect.objectContaining({total_tokens:20,result_check_steps:expect.anything()})}),'跨行业二创');
  });
  it('手动粘贴审稿只带档案设置也隔离旧会话，已包含的设置不重复注入', async () => {
    vi.mocked(getDifyConversationId).mockClear(); vi.mocked(saveDifyConversationId).mockClear();
    const settings = { platform: '抖音', personnel: '一人全包' };
    const fetcher = vi.fn(async () => new Response(complete)); vi.stubGlobal('fetch', fetcher);
    const query = '# 短视频脚本审稿与优化\n' + creationSettingsBlock(settings) + '\n她在揉面，手上全是白。';
    const stream = await (await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '审稿优化', query, creationSettings: settings, draftContent: '她在揉面，手上全是白。', profileId: A }) }) as NextRequest)).text();
    const actual = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(actual.conversation_id).toBeUndefined();
    expect(getDifyConversationId).not.toHaveBeenCalled();
    expect(saveDifyConversationId).toHaveBeenCalledWith('owner', 'verified-review', A, '审稿优化');
    expect(actual.query.split('人员：一人全包')).toHaveLength(2);
    expect(stream).not.toContain('完整二创方案');
    expect(stream).toContain('她在揉面');
    expect(askDify).toHaveBeenCalledWith(expect.stringContaining('她在揉面，手上全是白。'), 'owner', '审稿 原稿事实校对', expect.any(Object));
    expect(recordCreationCompletion).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ result: '## 纯文字文案\n她在揉面，手上全是白。', conversationId: 'verified-review', usage: expect.objectContaining({ total_tokens: 20 }) }), '审稿优化');
  });
  it('事实校对失败不交付初稿、不确认次数，并释放本次预占', async () => {
    state.auditFails = true;
    vi.mocked(recordCreationCompletion).mockClear(); vi.mocked(releaseCreation).mockClear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(complete)));
    const stream = await (await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '审稿优化', query: '审稿', draftContent: '她在揉面。' }) }) as NextRequest)).text();
    expect(stream).toContain('审稿校对未完成');
    expect(stream).not.toContain('完整二创方案');
    expect(recordCreationCompletion).not.toHaveBeenCalled();
    expect(releaseCreation).toHaveBeenCalledTimes(1);
  });
  it('当前创作设置在附加历史记忆后锁定，实际发送给 Dify 并随历史保存', async () => {
    const settings = { audience: '本地年轻顾客', structure: 'train', duration: '37秒', purpose: '人设型' };
    const fetcher = vi.fn(async () => new Response(complete)); vi.stubGlobal('fetch', fetcher);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '跨行业二创', query: '本轮原片', profileId: A, historyId: H, historyInput: { creationSettings: settings } }) }) as NextRequest;
    await (await POST(req)).text();
    const actual = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(actual.query).toContain('目标人群：本地年轻顾客');
    expect(actual.query).toContain('37秒');
    expect(actual.query).toContain('历史中的其他选题、方案、人群和时长不得替换本轮选择');
    expect(state.inserted[0].input_data.creationSettings).toEqual(settings);
  });
  it('浏览器已关页也继续保存，上游正文结束后固定保存账号与档案', async () => {
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const saved = new Promise<void>((resolve) => { state.onPersist = resolve; });
    const response = await POST(request());
    await response.body!.cancel();
    upstream.enqueue(encoder.encode(complete)); upstream.close();
    await saved;
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ id: H, user_id: 'owner', task_type: '跨行业二创', result: '完整二创方案', input_data: { profileId: A, profile_id: A } });
  });
  it('完成标记发给浏览器之前，云端保存已经完成', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(complete)));
    const response = await POST(request());
    const stream = await response.text();
    expect(state.inserted).toHaveLength(1);
    expect(stream.indexOf('history_saved')).toBeLessThan(stream.indexOf('message_end'));
    expect(stream).toContain('"saved":true');
  });
  it('上游明确失败时不把半截结果入历史；未登录不调用 AI', async () => {
    const fetcher = vi.fn(async () => new Response('data: {"event":"message","answer":"半截"}\n\ndata: {"event":"error","message":"失败"}\n\n'));
    vi.stubGlobal('fetch', fetcher);
    await (await POST(request())).text();
    expect(state.inserted).toHaveLength(0);
    state.allowed = false; fetcher.mockClear();
    expect((await POST(request())).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
