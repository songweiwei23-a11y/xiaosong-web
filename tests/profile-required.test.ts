// 地基门槛（2026-10-23）有专门的测试（tests/foundation-gate*.test.ts）。这里只测本文件的功能，地基一律放行。
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
// 有档案的用户，创作请求必须带档案 id（企业商用检测 P5：103 条记录没有档案 id，可能串档）。
// 没有任何档案的用户、知识库和自由对话不受影响。
const mockProfiles = vi.hoisted(() => ({ rows: [] as Array<{ id: string }> }));

vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'owner', feature: 'script', requestId: 'profile-req' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: async () => ({ ok: true, userId: 'owner' }), requireUser: async () => ({ ok: true, userId: 'owner' }), incrementUsageServer: vi.fn(async () => {}) }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(async () => {}), clearDifyConversationId: vi.fn(async () => {}), isInvalidConversationError: () => false }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({
  from: (table: string) => {
    const rows = table === 'user_profiles' ? mockProfiles.rows : [];
    const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, or: () => q, maybeSingle: async () => ({ data: null, error: null }), then: (r: any) => Promise.resolve({ data: rows, error: null }).then(r), insert: async () => ({ error: null }) };
    return q;
  },
}) }));

import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from '@/app/api/dify/stream/route';

const PROFILE = '3c1f4a52-8b7e-4d2a-9f10-5a6b7c8d9e0f';
const sse = (answer: string) => `data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })}\n\n`;

function mockDify(answer: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(sse(answer))));
}

const request = (body: Record<string, unknown>) =>
  POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify(body) }) as any);

afterEach(() => {
  vi.unstubAllGlobals();
  mockProfiles.rows = [];
});

describe('创作请求必须归属到具体档案', () => {
  it('用户有档案，脚本生成没带档案 id：400，不调用模型、不扣次数', async () => {
    mockProfiles.rows = [{ id: PROFILE }];
    const fetchSpy = vi.fn(async () => new Response(sse('不应该调用')));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await request({ taskType: '脚本生成', query: '写一条脚本' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('请先选择一个账号档案');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('用户有档案，带了档案 id：正常生成', async () => {
    mockProfiles.rows = [{ id: PROFILE }];
    mockDify('## 开头\n一元一串，老板亲手烤。');
    const res = await request({ taskType: '脚本生成', query: '写一条脚本', profileId: PROFILE });
    expect(res.status).toBe(200);
  });

  it('用户没有任何档案：不拦（没建档也能生成，见 2026-10-05 的说明）', async () => {
    mockProfiles.rows = [];
    mockDify('## 开头\n一元一串，老板亲手烤。');
    const res = await request({ taskType: '脚本生成', query: '写一条脚本' });
    expect(res.status).toBe(200);
  });

  it('知识库查询、自由对话不属于某个档案，有档案也不拦', async () => {
    mockProfiles.rows = [{ id: PROFILE }];
    mockDify('可以这样做。');
    expect((await request({ taskType: '知识库查询', topic: '怎么拍' })).status).toBe(200);
    expect((await request({ taskType: '自由对话', query: '你好' })).status).toBe(200);
  });
});
