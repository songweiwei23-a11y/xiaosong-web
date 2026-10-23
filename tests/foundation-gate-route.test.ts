// 地基门槛（2026-10-23）：没打好建档、账号定位、创作简报，生成接口不调模型、不扣额度，并告诉用户先去做哪一步。
const mockRows = vi.hoisted(() => ({
  profiles: [] as Array<{ id: string }>,
  positioning: [] as Array<{ positioning_type: string }>,
}));

vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'owner', feature: 'script', requestId: 'foundation-req' } })),
  releaseCreation: vi.fn(async () => {}),
  recordCreationCompletion: vi.fn(async () => {}),
  completionUsage: vi.fn(() => ({})),
}));
vi.mock('@/lib/api-guard', () => ({
  requireUserWithQuota: async () => ({ ok: true, userId: 'owner' }),
  requireUser: async () => ({ ok: true, userId: 'owner' }),
  incrementUsageServer: vi.fn(async () => {}),
}));
vi.mock('@/lib/dify-conversation', () => ({
  getDifyConversationId: vi.fn(async () => null),
  saveDifyConversationId: vi.fn(async () => {}),
  clearDifyConversationId: vi.fn(async () => {}),
  isInvalidConversationError: () => false,
}));
vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      const rows = table === 'user_profiles' ? mockRows.profiles : table === 'account_positioning' ? mockRows.positioning : [];
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        or: () => q,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (r: any) => Promise.resolve({ data: rows, error: null }).then(r),
        insert: async () => ({ error: null }),
      };
      return q;
    },
  }),
}));

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { POST } from '@/app/api/dify/stream/route';
import { reserveCreation } from '@/lib/creation-quota';

const PROFILE = '3c1f4a52-8b7e-4d2a-9f10-5a6b7c8d9e0f';
const sse = (answer: string) => `data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })}\n\n`;

const request = (body: Record<string, unknown>) =>
  POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify(body) }) as any);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockRows.profiles = [];
  mockRows.positioning = [];
});

describe('地基门槛：生成接口', () => {
  it('一个档案都没有：脚本生成直接拦下，告诉先建档，不调模型、不占额度', async () => {
    const fetchSpy = vi.fn(async () => new Response(sse('不应该调用')));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await request({ taskType: '脚本生成', query: '写一条脚本', profileId: PROFILE });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('还没有账号档案');
    expect(body.code).toBe('foundation_missing');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(reserveCreation).not.toHaveBeenCalled();
  });

  it('有档案但没做账号定位：选题拦下，提示先做账号定位', async () => {
    mockRows.profiles = [{ id: PROFILE }];
    const fetchSpy = vi.fn(async () => new Response(sse('不应该调用')));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await request({ taskType: '选题策划', query: '选题', profileId: PROFILE });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('还没有做账号定位');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(reserveCreation).not.toHaveBeenCalled();
  });

  it('账号定位做好了、没有创作简报：脚本拦下，提示先生成创作简报', async () => {
    mockRows.profiles = [{ id: PROFILE }];
    mockRows.positioning = [{ positioning_type: '账号定位' }];
    const res = await request({ taskType: '脚本生成', query: '写一条脚本', profileId: PROFILE });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('还没有生成创作简报');
    expect(reserveCreation).not.toHaveBeenCalled();
  });

  it('账号定位做好了：账号定位的深挖（商业定位）放行', async () => {
    mockRows.profiles = [{ id: PROFILE }];
    mockRows.positioning = [{ positioning_type: '账号定位' }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse('## 商业定位\n一元一串，老板亲手烤，主打川味烧烤。'))));
    const res = await request({ taskType: '商业定位', query: '做商业定位', profileId: PROFILE });
    expect(res.status).toBe(200);
  });

  it('三步全做完：脚本生成放行', async () => {
    mockRows.profiles = [{ id: PROFILE }];
    mockRows.positioning = [{ positioning_type: '账号定位' }, { positioning_type: '创作简报' }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse('## 开头\n一元一串，老板亲手烤。'))));
    const res = await request({ taskType: '脚本生成', query: '写一条脚本', profileId: PROFILE });
    expect(res.status).toBe(200);
  });
});
