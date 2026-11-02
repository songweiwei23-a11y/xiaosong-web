// 地基门槛有专门的测试；这里一律放行
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
/**
 * 助理调动整个开物（2026-11-02 产品方：「会调动整个开物，多维度、站在用户角度为用户办事」）：
 * 商业定位、内容定位能派；能读作品数据和月报；能记热点线索、加对标账号。全部用假接口，不调用真实模型。
 */
import { describe, expect, it, vi } from 'vitest';
import { missingFields, runAnyBoard, summaryOf, withUpstream } from '@/lib/assistant/board-dispatch';
import { createAssistantTools } from '@/lib/assistant/tools';
import { checkClaims } from '@/lib/assistant/receipts';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });

const PROFILE = { id: 'p1', profile_name: '老张烧烤', account_platform: ['抖音'], product_category: ['川味烧烤'], content_restrictions: '不说最低价' };
const POSITIONING = { profile_id: 'p1', positioning_type: '账号定位', full_content: '六维地基：老张烧烤，说给本地上班族听，主打川味烧烤。' };

function stub(routes: { profiles?: unknown[]; positioning?: unknown[]; saveOk?: boolean }, log: { url: string; body?: Record<string, unknown> }[]) {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    log.push({ url: u, body });
    if (u.includes('/api/dify/stream')) return sse('# 老张烧烤的商业定位\n' + '成交路径写得很清楚。'.repeat(40));
    if (u.includes('/api/positioning') && init?.method === 'POST') return routes.saveOk === false ? json({ error: 'x' }, 500) : json({ id: 'row1' });
    if (u.includes('/api/profiles')) return json(routes.profiles ?? []);
    if (u.includes('/api/positioning')) return json(routes.positioning ?? []);
    return json([]);
  }) as unknown as typeof fetch;
}
const ctxOf = (routes: Parameters<typeof stub>[0], log: Parameters<typeof stub>[1]) => ({ userId: 'u-w', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub(routes, log) });

describe('商业定位、内容定位能派', () => {
  it('以账号定位为地基生成，taskType 和页面一致；生成完存进定位表（不动当前生效的地基）', async () => {
    const log: { url: string; body?: Record<string, unknown> }[] = [];
    const r = await runAnyBoard(ctxOf({ profiles: [PROFILE], positioning: [POSITIONING] }, log), { kind: 'business-positioning', input: { notes: '主推夜宵套餐' } });
    expect(r.ok).toBe(true);
    const gen = log.find((x) => x.url.includes('/api/dify/stream'))!.body!;
    expect(gen.taskType).toBe('商业定位');
    expect(String(gen.query)).toContain('老张烧烤，说给本地上班族听');
    expect(String(gen.query)).toContain('主推夜宵套餐');
    const save = log.find((x) => x.url.endsWith('/api/positioning') && x.body)!.body!;
    expect(save).toMatchObject({ profile_id: 'p1', positioning_type: '商业定位', is_active: false, positioning_name: '老张烧烤的商业定位' });
    expect(r.historySaved).toBe(true);

    const log2: typeof log = [];
    await runAnyBoard(ctxOf({ profiles: [PROFILE], positioning: [POSITIONING] }, log2), { kind: 'content-positioning', input: {} });
    expect(log2.find((x) => x.url.includes('/api/dify/stream'))!.body!.taskType).toBe('内容定位');
  });

  it('没有账号定位就不生成，说清要先做账号定位；存不进定位表要提醒', async () => {
    const log: { url: string; body?: Record<string, unknown> }[] = [];
    const r = await runAnyBoard(ctxOf({ profiles: [PROFILE], positioning: [] }, log), { kind: 'content-positioning', input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('先做账号定位');
    expect(log.some((x) => x.url.includes('/api/dify/stream'))).toBe(false);

    const r2 = await runAnyBoard(ctxOf({ profiles: [PROFILE], positioning: [POSITIONING], saveOk: false }, []), { kind: 'business-positioning', input: {} });
    expect(r2.ok).toBe(true);
    expect(r2.historySaved).toBe(false);
  });

  it('计划里上一步是账号定位：它就是地基；派活单摘要、必填项', () => {
    const next = withUpstream({ kind: 'business-positioning', input: {} }, '## 账号定位\n六维地基……');
    expect(next).toMatchObject({ kind: 'business-positioning', input: { upstream: '## 账号定位\n六维地基……' } });
    expect(summaryOf({ kind: 'content-positioning', input: { notes: '想做三个系列' } })).toBe('内容定位｜补充：想做三个系列');
    expect(missingFields({ kind: 'business-positioning', input: {} })).toEqual([]);
  });

  it('派活工具：只列出、不开跑；没有档案先请建档', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-w1', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub({ profiles: [PROFILE] }, []), onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_business_positioning')!.run({ notes: '想知道怎么成交' });
    expect(out).toContain('等他点确认后才开跑');
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'business-positioning', label: '商业定位', feature: '定位' } });

    const none = createAssistantTools({ userId: 'u-w2', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub({ profiles: [] }, []) });
    expect(await none.find((t) => t.name === 'propose_content_positioning')!.run({})).toContain('还没有账号档案');
  });
});

describe('读作品数据和月报', () => {
  it('数据汇总 + 上月和本月的月报；没录数据也照实说', async () => {
    const now = new Date();
    const thisMonth = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 7);
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.includes('/api/works/performance')) return json({ count: 0, byPurpose: [], byTactic: [], byCohort: [], comparableCount: 0, comparisonScope: null, best: [], worst: [], insights: [] });
      if (u.includes('/api/works')) return json([{ title: '剪坏了怎么救', shoot_status: 'published', shot_at: `${thisMonth}-01T10:00:00Z`, published_at: `${thisMonth}-01T12:00:00Z`, metrics: { views: 1200, completion: 30 } }]);
      return json([]);
    }) as unknown as typeof fetch;
    const tools = createAssistantTools({ userId: 'u-w3', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl });
    const out = await tools.find((t) => t.name === 'read_performance')!.run({});
    expect(out).toContain('还没有录过发出去的数据');
    expect(out).toMatch(/月月报】拍了 \d+ 条，发了 1 条/);
    expect(out).toContain('总播放 1200');
  });
});

describe('记热点线索、加对标账号', () => {
  it('直接记进对标 & 热点页，出回执；失败照实说', async () => {
    const posted: Record<string, unknown>[] = [];
    const ok = (async (_u: string, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body)));
      return json({ id: 'h1' });
    }) as unknown as typeof fetch;
    const receipts: { kind: string; ok: boolean; text: string }[] = [];
    const tools = createAssistantTools({ userId: 'u-w4', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: ok, onReceipt: (r) => receipts.push(r) });
    expect(await tools.find((t) => t.name === 'add_hot_topic')!.run({ title: '秋天第一杯奶茶', seenOn: '2026-11-02' })).toContain('已记进「对标 & 热点」');
    expect(posted[0]).toMatchObject({ action: 'addHot', title: '秋天第一杯奶茶', seenOn: '2026-11-02' });
    expect(await tools.find((t) => t.name === 'add_benchmark_account')!.run({ name: '县城阿杰剪发' })).toContain('一键采集并拆解');
    expect(posted[1]).toMatchObject({ action: 'addAccount', name: '县城阿杰剪发', platform: '抖音', profileId: 'p1' });
    expect(receipts.map((r) => r.ok)).toEqual([true, true]);

    const bad = (async () => json({ error: '先写下这个热点是什么' }, 400)) as unknown as typeof fetch;
    const tools2 = createAssistantTools({ userId: 'u-w5', cookie: 'c=1', internalBase: 'http://x', fetchImpl: bad });
    expect(await tools2.find((t) => t.name === 'add_hot_topic')!.run({ title: '' })).toContain('没有记下来：先写下这个热点是什么');
  });

  it('说「已记下热点」「已加好对标」却没有回执：改成实话', () => {
    expect(checkClaims('已经帮你记下这个热点了。', []).answer).toContain('还没有记进「对标 & 热点」');
    expect(checkClaims('已经帮你记下这个热点了。', [{ kind: 'benchmark.add', ok: true, text: 'x' }]).answer).toBe('已经帮你记下这个热点了。');
  });
});

describe('提示词知道这些新本事', () => {
  it('商业定位、内容定位、作品数据、热点、对标、前采', () => {
    for (const s of ['propose_business_positioning', 'propose_content_positioning', 'read_performance', 'add_hot_topic', 'add_benchmark_account', 'open_page 打开 interview']) expect(ASSISTANT_SYSTEM, s).toContain(s);
  });
});
