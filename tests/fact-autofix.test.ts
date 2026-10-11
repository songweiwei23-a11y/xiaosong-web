vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'owner', feature: 'script', requestId: 'fix-req' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
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
import { autoFactFixLimited } from '@/lib/fact-fix';

const sse = (answer: string) => `data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end', conversation_id: 'c1', message_id: 'm1' })}\n\n`;

/** 页面看到的正文：answer 追加，message_replace 整篇替换（与 lib/sse-stream.ts 一致） */
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

/** 第一次是生成稿，第二次（如有）是事实修正 */
function mockDify(...answers: string[]) {
  const queue = [...answers];
  const calls: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(sse(queue.shift() ?? ''));
  }));
  return calls;
}

const request = (taskType: string, query: string) =>
  POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType, query }) }) as any);

afterEach(() => vi.unstubAllGlobals());

describe('生成后自动修正没有出处的说法', () => {
  it('脚本里编造的价格被修正，自检块去掉，页面最终显示修正后的稿子', async () => {
    // 脚本是四步结构（第2步才是口播）；没有第2步会被当成结构缺失去修复，那是另一条测试的事
    const draft = '## 第2步：纯文字文案\n一元一串，老板亲手烤。\n这一顿 30 块钱吃到撑。\n## ✅ 发布前自检\n- 无编造数字 ✅';
    const fixed = '## 第2步：纯文字文案\n一元一串，老板亲手烤。\n这一顿吃到撑。';
    const calls = mockDify(draft, fixed);

    const stream = await (await request('脚本生成', '写一条脚本。店里一元一串，老板亲手烤。')).text();

    expect(calls).toHaveLength(2);
    expect(String(calls[1].query)).toContain('只改这几处');
    const shown = shownAfterStream(stream);
    expect(shown).toContain('这一顿吃到撑');
    expect(shown).not.toContain('30 块钱');
    expect(shown).not.toContain('发布前自检');
    expect(stream).toContain('"event":"message_replace"');
  });

  it('修正后仍有问题、或改动超出那几句时，不采用修正稿，保留生成稿（去掉自检块）', async () => {
    const draft = '## 第2步：纯文字文案\n一元一串，老板亲手烤。\n这一顿 30 块钱吃到撑。\n## 完全重写\n别的全部内容都不一样的一段话，和原稿毫无关系。';
    const rewritten = '## 另一篇\n完全不同的新稿子。';
    mockDify(draft, rewritten);

    const stream = await (await request('脚本生成', '写一条脚本。店里一元一串，老板亲手烤。')).text();

    const shown = shownAfterStream(stream);
    expect(shown).not.toContain('另一篇');
    expect(shown).toContain('一元一串，老板亲手烤');
  });

  it('审稿稿里编出的客人原话被修正；原稿里写过的话不算编的，原稿用语不动', async () => {
    const draft = '她在揉面，面团很软。';
    // 第 1 次生成稿、第 2 次审稿校对（也带着这句编出来的话）、第 3 次事实修正
    const reviewed = `## 优化后的完整脚本\n${draft}\n昨天一桌客人说，这里的汤不一样。`;
    const fixed = `## 优化后的完整脚本\n${draft}`;
    const calls = mockDify(reviewed, reviewed, fixed);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '审稿优化', query: '请审稿', draftContent: draft }) });
    const stream = await (await POST(req as any)).text();
    expect(calls).toHaveLength(3);
    expect(String(calls[2].query)).toContain('只改这几处');
    const shown = shownAfterStream(stream);
    expect(shown).toContain(draft);
    expect(shown).not.toContain('一桌客人说');
  });

  it('审稿稿里原稿已经写过的说法，不触发修正', async () => {
    const draft = '昨天一桌客人说，这里的汤不一样。她在揉面。';
    const reviewed = `## 优化后的完整脚本\n${draft}`;
    const calls = mockDify(reviewed, reviewed);
    const req = new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '审稿优化', query: '请审稿', draftContent: draft }) });
    const stream = await (await POST(req as any)).text();
    expect(calls).toHaveLength(2);
    expect(shownAfterStream(stream)).toContain('一桌客人说');
  });

  it('每人每天的自动修正额度用完后，不再多调一次模型', async () => {
    // 同一个测试进程里前面的用例已用掉额度：这里把剩下的次数全部耗尽
    for (let i = 0; i < 25; i++) autoFactFixLimited('owner');
    const calls = mockDify('## 第2步：纯文字文案\n这一顿 30 块钱吃到撑。\n## ✅ 发布前自检\n- 无编造 ✅');

    const stream = await (await request('脚本生成', '写一条脚本。店里一元一串。')).text();

    expect(calls).toHaveLength(1);
    expect(shownAfterStream(stream)).toContain('30 块钱');
    expect(shownAfterStream(stream)).not.toContain('发布前自检');
  });
});
