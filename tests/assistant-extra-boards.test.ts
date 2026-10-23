// 地基门槛（2026-10-23）有专门的测试（tests/foundation-gate*.test.ts）。这里只测本文件的功能，地基一律放行。
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
/**
 * 管理员新派的七个板块：账号定位、创作简报、行业建议、起号方案、开篇钩子、跨行业二创、文案拆解。
 * 全部用假接口（档案、定位、生成接口都是桩），不调用真实模型。
 */
import { describe, it, expect, vi } from 'vitest';
import { missingFields, runAnyBoard, summaryOf, withUpstream, type BoardAny } from '@/lib/assistant/board-dispatch';
import { createAssistantTools } from '@/lib/assistant/tools';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const LONG = `这是一段足够长的板块产出，${'用来确认派活的结果能正常返回给管理员，内容本身不重要。'.repeat(12)}`;
const PROFILE = {
  id: 'p1',
  profile_name: '老张烧烤',
  account_platform: ['抖音'],
  account_track: ['本地服务'],
  product_category: ['川味烧烤'],
  content_restrictions: '不说最低价',
};
const POSITIONING = { profile_id: 'p1', positioning_type: '账号定位', positioning_name: '老张烧烤', full_content: '六维地基：老张烧烤，说给本地上班族听，主打川味烧烤。' };

/** 按地址给桩：生成接口记下请求体，档案和定位按传入的返回，其余返回空 */
function stub(routes: { profiles?: unknown[]; positioning?: unknown[] }, bodies: Record<string, unknown>[]) {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/dify/stream')) {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return sse(LONG);
    }
    if (u.includes('/api/profiles')) return json(routes.profiles ?? []);
    if (u.includes('/api/positioning')) return json(routes.positioning ?? []);
    return json([]);
  }) as unknown as typeof fetch;
}

const ctxWith = (routes: { profiles?: unknown[]; positioning?: unknown[] }, bodies: Record<string, unknown>[]) => ({
  userId: 'u-extra',
  cookie: 'c=1',
  internalBase: 'http://x',
  fetchImpl: stub(routes, bodies),
});

describe('账号定位与创作简报', () => {
  it('账号定位：用档案生成，taskType 是「账号定位」，经营品类带进提示词', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [PROFILE] }, bodies), { kind: 'positioning', input: {} });
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('账号定位');
    expect(bodies[0].profileId).toBe('p1');
    expect(String(bodies[0].query)).toContain('川味烧烤');
  });

  it('账号定位：没有档案就不生成，直接说要先建档', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [] }, bodies), { kind: 'positioning', input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('建档');
    expect(bodies).toHaveLength(0);
  });

  it('创作简报：没有定位就不生成，先请老板做定位', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [PROFILE], positioning: [] }, bodies), { kind: 'brief', input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('账号定位');
    expect(bodies).toHaveLength(0);
  });

  it('创作简报：有库里的定位就用它；计划里上一步的定位优先', async () => {
    const bodies: Record<string, unknown>[] = [];
    await runAnyBoard(ctxWith({ profiles: [PROFILE], positioning: [POSITIONING] }, bodies), { kind: 'brief', input: {} });
    expect(bodies[0].taskType).toBe('创作简报');
    expect(String(bodies[0].query)).toContain('老张烧烤，说给本地上班族听');

    const bodies2: Record<string, unknown>[] = [];
    await runAnyBoard(ctxWith({ profiles: [PROFILE], positioning: [] }, bodies2), { kind: 'brief', input: { upstream: '计划里刚做的定位：主打川味烧烤。' } });
    expect(String(bodies2[0].query)).toContain('计划里刚做的定位');
  });

  it('创作简报：上一步产出交给它，作为定位原文', () => {
    const next = withUpstream({ kind: 'brief', input: {} }, '上一步的定位全文');
    expect(next).toMatchObject({ kind: 'brief', input: { upstream: '上一步的定位全文' } });
  });
});

describe('行业建议', () => {
  it('目的或阶段没说清楚：要先问，缺哪个列哪个', () => {
    const missing = missingFields({ kind: 'advice', input: { purpose: '', stage: 'bogus', situation: '' } }).join('');
    expect(missing).toContain('账号目的');
    expect(missing).toContain('当前阶段');
    expect(missingFields({ kind: 'advice', input: { purpose: 'traffic', stage: 'start', situation: '' } })).toEqual([]);
  });

  it('生成：taskType 是「行业建议」，目的写成中文名', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [PROFILE] }, bodies), {
      kind: 'advice',
      input: { purpose: 'traffic', stage: 'start', situation: '发了 10 条，播放都在 500 以下' },
    });
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('行业建议');
    expect(String(bodies[0].query)).toContain('大流量');
    expect(String(bodies[0].query)).toContain('播放都在 500 以下');
  });

  it('摘要里带上目的和阶段', () => {
    expect(summaryOf({ kind: 'advice', input: { purpose: 'monetize', stage: 'scale', situation: '' } })).toContain('monetize');
  });
});

describe('起号方案、开篇钩子', () => {
  it('起号方案：taskType 是「起号方案」，没有档案也能跑（只是少档案那一段）', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [] }, bodies), { kind: 'growth', input: { notes: '想先拍门店' } });
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('起号方案');
    expect(String(bodies[0].query)).toContain('想先拍门店');
  });

  it('开篇钩子：必须有主题；超出条数范围时照常生成', async () => {
    expect(missingFields({ kind: 'opening', input: { topic: '' } })).toEqual(['这条内容讲什么']);
    const bodies: Record<string, unknown>[] = [];
    await runAnyBoard(ctxWith({ profiles: [PROFILE] }, bodies), { kind: 'opening', input: { topic: '招牌烤串怎么腌', count: 20 } });
    expect(bodies[0].taskType).toBe('开篇钩子');
    expect(String(bodies[0].query)).toContain('招牌烤串怎么腌');
  });

  it('上一步产出交给开篇钩子：接在主题后面', () => {
    const next = withUpstream({ kind: 'opening', input: { topic: '招牌烤串' } }, '选题一：腌料的秘密');
    expect(next).toMatchObject({ kind: 'opening', input: { topic: expect.stringContaining('腌料的秘密') } });
  });
});

describe('跨行业二创、文案拆解', () => {
  const SOURCE = '别人家卖豆腐脑的故事：一碗豆腐脑卖了十年，今天我把配方免费教你，你敢不敢学？';

  it('跨行业二创：原文太短就问；够长才派', () => {
    expect(missingFields({ kind: 'remix', input: { text: '太短' } })).toHaveLength(1);
    expect(missingFields({ kind: 'remix', input: { text: SOURCE } })).toEqual([]);
  });

  it('跨行业二创：taskType 是「跨行业二创」，原文和档案的店都带上；方案个数不合法就按 1 个', async () => {
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [PROFILE] }, bodies), { kind: 'remix', input: { text: SOURCE, count: 7 } });
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('跨行业二创');
    const q = String(bodies[0].query);
    expect(q).toContain('豆腐脑');
    expect(q).toContain('老张烧烤');
  });

  it('文案拆解：taskType 是「拆解爆款」（文字版），原文带上', async () => {
    expect(missingFields({ kind: 'breakdown', input: { script: '' } })).toHaveLength(1);
    const bodies: Record<string, unknown>[] = [];
    const r = await runAnyBoard(ctxWith({ profiles: [PROFILE] }, bodies), { kind: 'breakdown', input: { script: SOURCE } });
    expect(r.ok).toBe(true);
    expect(bodies[0].taskType).toBe('拆解爆款');
    expect(String(bodies[0].query)).toContain('豆腐脑');
  });

  it('计划里的拆解结果交给二创：替换原文，不是接在后面', () => {
    const board: BoardAny = { kind: 'remix', input: { text: SOURCE } };
    const next = withUpstream(board, '拆解结论：开头用反问，中段讲故事');
    expect(next).toMatchObject({ kind: 'remix', input: { text: '拆解结论：开头用反问，中段讲故事' } });
  });
});

describe('派活工具：先查前提，再列出来', () => {
  it('没有定位就派创作简报：直接说先做定位，不列任务', async () => {
    const actions: { name: string }[] = [];
    const tools = createAssistantTools({
      userId: 'u-tool-brief',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: stub({ profiles: [PROFILE], positioning: [] }, []),
      onAction: (a) => actions.push(a),
    });
    const out = await tools.find((t) => t.name === 'propose_brief')!.run({});
    expect(out).toContain('先派账号定位');
    expect(actions).toHaveLength(0);
  });

  it('没有档案就派账号定位：请老板先建档，不列任务', async () => {
    const actions: { name: string }[] = [];
    const tools = createAssistantTools({
      userId: 'u-tool-pos',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: stub({ profiles: [] }, []),
      onAction: (a) => actions.push(a),
    });
    const out = await tools.find((t) => t.name === 'propose_positioning')!.run({});
    expect(out).toContain('建一个档案');
    expect(actions).toHaveLength(0);
  });

  it('行业建议没说目的和阶段：列出还缺什么，不列任务', async () => {
    const actions: { name: string }[] = [];
    const tools = createAssistantTools({
      userId: 'u-tool-advice',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: stub({ profiles: [PROFILE] }, []),
      onAction: (a) => actions.push(a),
    });
    const out = await tools.find((t) => t.name === 'propose_industry_advice')!.run({ purpose: '', stage: '' });
    expect(out).toContain('还缺');
    expect(actions).toHaveLength(0);
  });

  it('跨行业二创有原文：列出来等确认，动作是 board.run', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({
      userId: 'u-tool-remix',
      cookie: 'c=1',
      internalBase: 'http://x',
      fetchImpl: stub({ profiles: [PROFILE] }, []),
      onAction: (a) => actions.push(a),
    });
    await tools.find((t) => t.name === 'propose_remix')!.run({ text: '别人家卖豆腐脑的故事：一碗豆腐脑卖了十年，今天我把配方免费教你，你敢不敢学？', count: 3 });
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'remix', feature: '二创' } });
  });
});
