/**
 * 审稿板块的共用拼装（lib/boards/review-query.ts）、助理的服务端创作上下文（lib/assistant/board-context.ts），
 * 以及助理的审稿工具（run_review）。全部用假的接口，不调用真实模型。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildReviewBoardQuery } from '@/lib/boards/review-query';
import { loadBoardContext } from '@/lib/assistant/board-context';
import { createAssistantTools } from '@/lib/assistant/tools';
import type { CreatorContext } from '@/lib/creator-context';

const EMPTY_CTX = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;

const BASE_INPUT = {
  creatorContext: EMPTY_CTX,
  currentSettings: {},
  sourceReference: '',
  draftContent: '今天我们聊一个很多人踩过的坑，先说结论。',
  platform: '抖音',
  effectiveDuration: '60秒',
  scriptType: '',
  personalRequirements: '',
  reviewDimensions: '',
  optimizationGoals: '',
  benchmarkScript: '',
  compareMode: true,
  severityLabels: true,
};

describe('审稿提示词的共用拼装', () => {
  it('query 里有原稿、平台和时长，原稿本身不进 reviewMaterial（原稿不算事实依据）', () => {
    const { query, reviewMaterial } = buildReviewBoardQuery(BASE_INPUT);
    expect(query).toContain(BASE_INPUT.draftContent);
    expect(query).toContain('抖音');
    expect(reviewMaterial).not.toContain(BASE_INPUT.draftContent);
  });

  it('有相关方案参考时，参考块出现在依据材料里，并说明只审待审脚本', () => {
    const { reviewMaterial } = buildReviewBoardQuery({ ...BASE_INPUT, sourceReference: '上一期的脚本大意' });
    expect(reviewMaterial).toContain('【相关方案参考】');
    expect(reviewMaterial).toContain('上一期的脚本大意');
    expect(reviewMaterial).toContain('只审下方待审脚本');
  });

  it('有个人要求时，提醒附在 query 末尾', () => {
    const plain = buildReviewBoardQuery(BASE_INPUT).query;
    const withReq = buildReviewBoardQuery({ ...BASE_INPUT, personalRequirements: '不要出现价格' }).query;
    expect(withReq.length).toBeGreaterThan(plain.length);
    expect(withReq).toContain('不要出现价格');
  });
});

describe('服务端的创作上下文：和页面一样，只取当前档案自己的定位', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  it('多个档案时，定位只取当前选中的那个档案的，不拿别人的顶上', async () => {
    const fakeFetch = (async (url: string) => {
      const u = String(url);
      if (u.includes('/api/profiles')) return json([{ id: 'pA', profile_name: 'A号' }, { id: 'pB', profile_name: 'B号' }]);
      if (u.includes('/api/positioning?type=') && u.includes(encodeURIComponent('账号定位'))) {
        return json([
          { profile_id: 'pB', positioning_name: 'B的定位', full_content: 'B的定位全文', created_at: '2026-10-01' },
          { profile_id: 'pA', positioning_name: 'A的定位', full_content: 'A的定位全文', created_at: '2026-10-02' },
        ]);
      }
      return json([]);
    }) as unknown as typeof fetch;

    const ctx = await loadBoardContext({ cookie: 'c=1', base: 'http://x', fetchImpl: fakeFetch }, 'pA');
    expect(ctx.profile?.id).toBe('pA');
    expect(ctx.positioning?.full).toBe('A的定位全文');
  });

  it('没有选中的档案时，用第一个档案', async () => {
    const fakeFetch = (async (url: string) => (String(url).includes('/api/profiles') ? json([{ id: 'pFirst' }, { id: 'pSecond' }]) : json([]))) as unknown as typeof fetch;
    const ctx = await loadBoardContext({ cookie: 'c=1', base: 'http://x', fetchImpl: fakeFetch }, null);
    expect(ctx.profile?.id).toBe('pFirst');
  });

  it('某个接口失败：那一块为空，不让整个上下文失败', async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes('/api/profiles')) return json([{ id: 'p1' }]);
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const ctx = await loadBoardContext({ cookie: 'c=1', base: 'http://x', fetchImpl: fakeFetch }, 'p1');
    expect(ctx.profile?.id).toBe('p1');
    expect(ctx.positioning).toBeNull();
    expect(ctx.advice).toBeNull();
  });
});

describe('助理的审稿工具', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const sse = (answer: string) =>
    new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

  const reviewTool = (fetchImpl: typeof fetch) =>
    createAssistantTools({ userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl }).find((t) => t.name === 'run_review')!;

  it('稿子太短或没给原文：不调用板块，直接请用户补全', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(String(url));
      return json([]);
    }) as unknown as typeof fetch;
    const out = await reviewTool(fakeFetch).run({ draft: '太短' });
    expect(out).toContain('稿子太短');
    expect(calls.some((u) => u.includes('/api/dify/stream'))).toBe(false);
  });

  it('正常：把稿子交给审稿板块（和页面同一个接口，带上审稿任务类型），返回板块的审稿结果', async () => {
    let sentBody: Record<string, unknown> | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/dify/stream')) {
        sentBody = JSON.parse(String(init?.body));
        return sse('审稿结论：开头太慢，第一句要直接给结论。');
      }
      if (u.includes('/api/profiles')) return json([{ id: 'p1', profile_name: 'A号' }]);
      return json([]);
    }) as unknown as typeof fetch;

    const draft = '今天我们聊一个很多人踩过的坑，先说结论，然后讲三个原因，最后给一个能马上用的办法。';
    const out = await reviewTool(fakeFetch).run({ draft, platform: '快手' });
    expect(out).toContain('审稿结论');
    expect(sentBody).not.toBeNull();
    expect(sentBody!.taskType).toBe('审稿优化');
    expect(sentBody!.draftContent).toBe(draft);
    expect(sentBody!.platform).toBe('快手');
    expect(sentBody!.profileId).toBe('p1');
  });

  it('板块报了额度或服务错误：把原因如实交给助理', async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes('/api/dify/stream')) return json({ error: '本期审稿额度已用完' }, 402);
      return json([]);
    }) as unknown as typeof fetch;
    const out = await reviewTool(fakeFetch).run({ draft: '这是一段足够长的稿子，用来测试额度不够时的提示内容是否如实返回。' });
    expect(out).toBe('审稿没有完成：本期审稿额度已用完');
  });
});
