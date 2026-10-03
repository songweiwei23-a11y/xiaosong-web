import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ inserted: [] as any[], onPersist: (() => {}) as () => void, allowed: true }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: async () => state.allowed ? { ok: true, userId: 'owner' } : { ok: false, response: Response.json({}, { status: 401 }) }, incrementUsageServer: vi.fn(async () => {}) }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: async () => null, saveDifyConversationId: vi.fn(), clearDifyConversationId: vi.fn(), isInvalidConversationError: () => false }));
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
const A = '11111111-1111-4111-8111-111111111111';
const H = '33333333-3333-4333-8333-333333333333';
const request = () => new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '跨行业二创', query: '本轮原片', profileId: A, historyId: H, historyInput: { source: '汽修' } }) }) as NextRequest;
const encoder = new TextEncoder();
const complete = 'data: {"event":"message","answer":"完整二创方案"}\n\ndata: {"event":"message_end"}\n\n';
afterEach(() => { vi.unstubAllGlobals(); state.allowed = true; state.onPersist = () => {}; state.inserted.length = 0; });

describe('生成由服务端存档', () => {
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
