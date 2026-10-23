// 地基门槛（2026-10-23）有专门的测试（tests/foundation-gate*.test.ts）。这里只测本文件的功能，地基一律放行。
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'owner', feature: 'script', requestId: 'repair-req' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: async () => ({ ok: true, userId: 'owner' }), requireUser: async () => ({ ok: true, userId: 'owner' }), incrementUsageServer: vi.fn(async () => {}) }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(async () => {}), clearDifyConversationId: vi.fn(async () => {}), isInvalidConversationError: () => false }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({
  from: () => {
    const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, or: () => q, maybeSingle: async () => ({ data: null, error: null }), then: (r: any) => Promise.resolve({ data: [], error: null }).then(r), insert: async () => ({ error: null }) };
    return q;
  },
}) }));

import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from '@/app/api/dify/stream/route';

const sse = (answer: string) => `data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })}\n\n`;

function shownAfterStream(stream: string): string {
  let shown = '';
  for (const block of stream.split('\n\n')) {
    if (!block.startsWith('data:')) continue;
    const e = JSON.parse(block.slice(5));
    if (e.event === 'message_replace') shown = e.answer;
    else if (e.event === undefined && typeof e.answer === 'string') shown += e.answer;
  }
  return shown;
}

function mockDify(...answers: string[]) {
  const queue = [...answers];
  const calls: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(sse(queue.shift() ?? ''));
  }));
  return calls;
}

const step = (spoken: string) => `## 第1步：脚本策略卡\n策略。\n\n## 第2步：纯文字文案\n${spoken}\n\n## 第3步：完整分镜脚本\n镜头一。\n\n## 第4步：执行与优化建议\n建议。`;
const words = (n: number) => '老板说话'.repeat(Math.ceil(n / 4)).slice(0, n);
/** 带句号的口播（裁剪按句进行，真实口播都有标点） */
const sents = (n: number) => '老板说话很实在。'.repeat(Math.ceil(n / 7));

afterEach(() => vi.unstubAllGlobals());

describe('脚本口播超过编导设的时长：生成后压缩一次', () => {
  it('30 秒的脚本口播 307 字：第二次按字数压缩，采用压缩稿', async () => {
    const long = step(words(307));
    const short = step(words(140));
    const calls = mockDify(long, short);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '脚本生成', query: '写一条脚本。', creationSettings: { duration: '30秒' } }) });
    const stream = await (await POST(req as any)).text();
    expect(calls).toHaveLength(2);
    expect(String(calls[1].query)).toContain('150 字以内');
    expect(shownAfterStream(stream)).toBe(short);
  });

  it('压缩稿仍然超长：本地按句裁到 150 字以内（只删句子），第 1、3、4 步原样', async () => {
    const long = step(sents(307));
    const stillLong = step(sents(300));
    mockDify(long, stillLong);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '脚本生成', query: '写一条脚本。', creationSettings: { duration: '30秒' } }) });
    const stream = await (await POST(req as any)).text();
    const shown = shownAfterStream(stream);
    const spoken = shown.match(/第2步[^\n]*纯文字文案\n([\s\S]*?)\n\n## 第3步/);
    expect(spoken).not.toBeNull();
    expect((spoken![1].match(/[一-鿿]/g) ?? []).length).toBeLessThanOrEqual(150);
    expect(shown).toContain('## 第1步：脚本策略卡');
    expect(shown).toContain('## 第4步：执行与优化建议');
  });

  it('AI 推荐时长的脚本不压缩，口播长也不动（内容优先）', async () => {
    const long = step(words(400));
    const calls = mockDify(long);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '脚本生成', query: '写一条脚本。', creationSettings: { duration: 'AI推荐' } }) });
    const stream = await (await POST(req as any)).text();
    expect(calls).toHaveLength(1);
    expect(shownAfterStream(stream)).toBe(long);
  });
});
