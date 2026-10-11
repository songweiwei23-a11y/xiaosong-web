vi.mock('@/lib/creation-quota', () => ({ reserveCreation: vi.fn(async () => ({ ok: true, reservation: { userId: 'owner', feature: 'direction', requestId: 'season-req' } })), releaseCreation: vi.fn(async () => {}), recordCreationCompletion: vi.fn(async () => {}), completionUsage: vi.fn(() => ({})) }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: async () => ({ ok: true, userId: 'owner' }), requireUser: async () => ({ ok: true, userId: 'owner' }), incrementUsageServer: vi.fn(async () => {}) }));
vi.mock('@/lib/dify-conversation', () => ({ getDifyConversationId: vi.fn(async () => null), saveDifyConversationId: vi.fn(async () => {}), clearDifyConversationId: vi.fn(async () => {}), isInvalidConversationError: () => false }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({
  from: () => {
    const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, or: () => q, maybeSingle: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }), then: (r: any) => Promise.resolve({ data: [], error: null }).then(r), insert: async () => ({ error: null }) };
    return q;
  },
}) }));

import { describe, it, expect, vi } from 'vitest';
import { seasonOf, timeAnchor } from '@/lib/time-anchor';
import { buildDirectionPrompt } from '@/lib/direction';
import { loadCreativeMemory } from '@/lib/creative-history';
import { POST } from '@/app/api/dify/stream/route';

/** 北京时间某年某月某日 11:00 对应的时间戳（测试里不依赖机器时区） */
const beijing = (y: number, m: number, d: number, h = 11) => Date.UTC(y, m - 1, d, h - 8);

describe('当前时间与季节', () => {
  it('北京时间的季节按月份划分', () => {
    expect([1, 2, 12].map(seasonOf)).toEqual(['冬季', '冬季', '冬季']);
    expect([3, 5].map(seasonOf)).toEqual(['春季', '春季']);
    expect([6, 8].map(seasonOf)).toEqual(['夏季', '夏季']);
    expect([9, 11].map(seasonOf)).toEqual(['秋季', '秋季']);
  });

  it('2026-10-11 写成秋季，日期按北京时间，与服务器时区无关', () => {
    expect(timeAnchor(beijing(2026, 10, 11))).toContain('今天是2026年10月11日（北京时间，秋季）');
    // 北京时间 10-11 00:30 = UTC 10-10 16:30：日期仍应是 10-11
    expect(timeAnchor(Date.UTC(2026, 9, 10, 16, 30))).toContain('今天是2026年10月11日');
  });
});

describe('创作方向：用户写的季节是硬条件', () => {
  it('提示词里有硬条件规则，并点名「秋天」这类写法', () => {
    const prompt = buildDirectionPrompt({ purposes: ['store'], ideas: '秋天了，想拍点店里的新变化', formats: [], count: 3, depth: 'full' });
    expect(prompt).toContain('季节、时间点（如「秋天」）是本轮硬条件');
    expect(prompt).toContain('秋天了，想拍点店里的新变化');
  });
});

/** 只实现 loadCreativeMemory 用到的查询链 */
function fakeDb(rows: Array<{ result: string; input_data: unknown; created_at: string }>) {
  const q: any = {
    select: () => q, eq: () => q, order: () => q, limit: () => q, or: () => q,
    then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return { from: () => q } as any;
}

describe('历史记忆：创作方向只带方向名字，不带正文', () => {
  const rows = [
    { result: '### 方向1：秋天的串串摊\n冬天吃火锅正好，棚子搭好了，冬季新品…\n### 方向2：摊位上的一天\n正文很长…', input_data: {}, created_at: '2026-10-09T00:00:00Z' },
  ];

  it('方向的历史只列名字，正文里的时令不进提示词', async () => {
    const memory = await loadCreativeMemory(fakeDb(rows), 'owner', '创作方向', null);
    expect(memory).toContain('- 秋天的串串摊');
    expect(memory).toContain('- 摊位上的一天');
    expect(memory).not.toContain('冬天吃火锅');
    expect(memory).not.toContain('<creative_history>');
  });

  it('其他板块的历史参考保持原样（带正文节选）', async () => {
    const memory = await loadCreativeMemory(fakeDb(rows), 'owner', '脚本生成', null);
    expect(memory).toContain('<creative_history>');
    expect(memory).toContain('冬天吃火锅');
  });
});

describe('生成请求：拼上当前时间', () => {
  it('发给 Dify 的查询里带「当前时间」', async () => {
    const fetcher = vi.fn(async () => new Response('data: {"event":"message","answer":"好"}\n\ndata: {"event":"message_end"}\n\n'));
    vi.stubGlobal('fetch', fetcher);
    await (await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '脚本生成', query: '写一条脚本', profileId: '11111111-1111-4111-8111-111111111111' }) }) as any)).text();
    const sent = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.query).toContain('【当前时间】今天是');
    vi.unstubAllGlobals();
  });

  it('已经自带「今天是」的板块不重复加', async () => {
    const fetcher = vi.fn(async () => new Response('data: {"event":"message","answer":"好"}\n\ndata: {"event":"message_end"}\n\n'));
    vi.stubGlobal('fetch', fetcher);
    await (await POST(new Request('https://local/api/dify/stream', { method: 'POST', body: JSON.stringify({ taskType: '内容规划', query: '今天是 2026年10月11日。做计划' }) }) as any)).text();
    const sent = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.query.match(/今天是/g)).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
