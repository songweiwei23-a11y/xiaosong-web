/**
 * 管理员派活的新部分（2026-10-23）：七个板块、必填项、上一步产出的传递、多步计划、模型验收、派活工具的拒绝。
 * 全部用假接口和假模型，不调用真实模型，结果每次一样。
 */
import { describe, it, expect, vi } from 'vitest';
import { missingFields, summaryOf, withUpstream, type BoardAny } from '@/lib/assistant/board-dispatch';
import { runAnyBoard } from '@/lib/assistant/board-dispatch';
import { judgeBoardOutput, checkBoardOutput } from '@/lib/assistant/manager';
import { runPlanJob } from '@/lib/assistant/board-job';
import { createJob } from '@/lib/assistant/jobs';
import { createAssistantTools } from '@/lib/assistant/tools';
import type { AssistantConfig } from '@/lib/assistant/config';
import type { LlmResponse } from '@/lib/assistant/llm';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const LONG = `这是一段足够长、足够具体的板块产出。${'内容包含场景、冲突和结果，可以直接拿去用。'.repeat(8)}`;

/** 假接口：板块请求记下来（按 taskType），其它接口返回空 */
function fakeStream(answer = LONG) {
  const bodies: Record<string, Record<string, unknown>[]> = {};
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('/api/dify/stream')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const type = String(body.taskType);
      (bodies[type] ??= []).push(body);
      return sse(answer);
    }
    return json([]);
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

const CTX = { userId: 'u-dispatch', cookie: 'c=1', internalBase: 'http://x' };

describe('七个派活板块：必填项与摘要', () => {
  it('每个板块缺了关键信息都要先问，填了就不问', () => {
    const cases: [BoardAny, string][] = [
      [{ kind: 'topic', input: { request: '' } } as BoardAny, '要拍的方向或主题'],
      [{ kind: 'script', input: { request: '' } } as BoardAny, '要拍的主题或内容'],
      [{ kind: 'review', input: { draft: '太短' } } as BoardAny, '完整的稿子原文'],
      [{ kind: 'title', input: { topic: '' } } as BoardAny, '要起标题的主题'],
      [{ kind: 'storyboard', input: { script: '短' } } as BoardAny, '完整的脚本原文'],
      [{ kind: 'direction', input: { goal: '' } } as BoardAny, '这次想达到的目的'],
      [{ kind: 'content-plan', input: { goal: '' } } as BoardAny, '这个月想主攻什么'],
    ];
    for (const [board, expected] of cases) expect(missingFields(board).join('')).toContain(expected);
    expect(missingFields({ kind: 'title', input: { topic: '老板的新品' } })).toEqual([]);
    expect(missingFields({ kind: 'direction', input: { goal: '涨粉' } })).toEqual([]);
  });

  it('摘要写清楚这一步是什么', () => {
    expect(summaryOf({ kind: 'title', input: { topic: '新品', count: 5 } })).toContain('标题 5 个');
    expect(summaryOf({ kind: 'direction', input: { goal: '涨粉', count: 4 } })).toContain('方向 4 个');
    expect(summaryOf({ kind: 'content-plan', input: { goal: '主攻复购' } })).toContain('主攻复购');
  });
});

describe('上一步的产出交给下一步', () => {
  it('有主要输入的接在后面；审稿、分镜直接换成上一步的产出', () => {
    const topic = withUpstream({ kind: 'script', input: { request: '拍菜市场' } }, '选题1：老板的一天');
    expect(topic.kind === 'script' && topic.input.request).toContain('【参考：上一步的产出】');
    const review = withUpstream({ kind: 'review', input: { draft: '旧稿' } }, '新脚本的全文');
    expect(review.kind === 'review' && review.input.draft).toBe('新脚本的全文');
    const storyboard = withUpstream({ kind: 'storyboard', input: { script: '旧脚本' } }, '新脚本');
    expect(storyboard.kind === 'storyboard' && storyboard.input.script).toBe('新脚本');
  });
});

describe('七个板块都能跑，并且用各自的任务类型去生成', () => {
  const cases: [BoardAny, string][] = [
    [{ kind: 'title', input: { topic: '老板的新品', count: 5 } }, '标题封面'],
    [{ kind: 'storyboard', input: { script: '这是一段足够长的脚本原文，用来拆分镜，要超过三十个字，内容随便写写就行。' } }, '分镜脚本'],
    [{ kind: 'direction', input: { goal: '涨粉', count: 5 } }, '创作方向'],
    [{ kind: 'content-plan', input: { goal: '主攻复购', count: 12 } }, '内容规划'],
  ];
  for (const [board, taskType] of cases) {
    it(`${board.kind} 走 /api/dify/stream，taskType 是「${taskType}」`, async () => {
      const { fetchImpl, bodies } = fakeStream();
      const r = await runAnyBoard({ ...CTX, fetchImpl }, board);
      expect(r.ok).toBe(true);
      expect(r.text).toContain('足够长');
      expect(bodies[taskType]).toHaveLength(1);
      expect(String(bodies[taskType][0].query).length).toBeGreaterThan(50);
    });
  }
});

describe('多步计划：按顺序执行，前一步的产出交给后一步', () => {
  it('两步都跑完，答案按步骤列出；第二步的请求里带着第一步的产出', async () => {
    const { fetchImpl, bodies } = fakeStream();
    const job = createJob('u-plan');
    await runPlanJob(job, {
      ctx: { ...CTX, fetchImpl },
      plan: {
        kind: 'plan',
        steps: [
          { kind: 'topic', input: { request: '拍菜市场的真实故事', count: 5, role: '按配比' } },
          { kind: 'script', input: { request: '把第一条选题写成脚本' } },
        ],
      },
      maxRuns: 1,
    });
    expect(job.status).toBe('done');
    expect(job.answer).toContain('## 1. 选题策划');
    expect(job.answer).toContain('## 2. 脚本生成');
    expect(bodies['选题策划']).toHaveLength(1);
    expect(bodies['脚本生成']).toHaveLength(1);
    expect(JSON.stringify(bodies['脚本生成'][0])).toContain('上一步的产出');
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.startsWith('第 2/2 步'))).toBe(true);
  });

  it('某一步没有完成：停下来，后面的步骤不做，已完成的照常交付', async () => {
    // 只有脚本那一步额度用完；前面的方向照常出
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (!String(url).includes('/api/dify/stream')) return json([]);
      const body = JSON.parse(String(init?.body)) as { taskType: string };
      return body.taskType === '脚本生成' ? json({ error: '本期脚本额度已用完' }, 402) : sse(LONG);
    }) as unknown as typeof fetch;
    const job = createJob('u-plan-2');
    await runPlanJob(job, {
      ctx: { ...CTX, fetchImpl },
      plan: {
        kind: 'plan',
        steps: [
          { kind: 'direction', input: { goal: '涨粉', count: 5 } },
          { kind: 'script', input: { request: '拍一条脚本' } },
        ],
      },
      maxRuns: 1,
    });
    const errors = job.events.filter((e) => e.type === 'error').map((e) => (e as { text: string }).text);
    expect(errors[0]).toContain('第 2/2 步');
    expect(errors[0]).toContain('本期脚本额度已用完');
  });
});

describe('模型验收：对照派活要求读一遍产出', () => {
  const cfg: AssistantConfig = { baseUrl: 'https://relay.example', apiKey: 'k', model: 'm' };
  const reply = (text: string) => vi.fn(async (): Promise<LlmResponse> => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }));

  it('模型说不合格：给出问题，判不过', async () => {
    const llm = reply('{"pass": false, "problems": ["只有三条，没到要求的五条"]}');
    const r = await judgeBoardOutput(cfg, 'topic', '选题 5 条', LONG, { llm });
    expect(r).toEqual({ ok: false, problems: ['只有三条，没到要求的五条'] });
  });

  it('模型说合格：通过', async () => {
    const r = await judgeBoardOutput(cfg, 'topic', '选题 5 条', LONG, { llm: reply('{"pass": true, "problems": []}') });
    expect(r).toEqual({ ok: true, problems: [] });
  });

  it('模型回答读不懂，或者调用出错：返回 null，流程照常（只用规则结果）', async () => {
    expect(await judgeBoardOutput(cfg, 'topic', '选题', LONG, { llm: reply('我觉得还行') })).toBeNull();
    const broken = vi.fn(async () => { throw new Error('模型服务返回 503'); });
    expect(await judgeBoardOutput(cfg, 'topic', '选题', LONG, { llm: broken as never })).toBeNull();
  });

  it('规则：脚本才查事实依据，其它板块不查', () => {
    expect(checkBoardOutput('title', '标题'.repeat(40), '').ok).toBe(true);
    expect(checkBoardOutput('storyboard', LONG + LONG, '').ok).toBe(true);
    // 太短的分镜不合格
    expect(checkBoardOutput('storyboard', LONG, '').ok).toBe(false);
  });
});

describe('派活工具：缺信息、步数不对、板块不认识，都不列任务', () => {
  it('标题没有主题：先问，不列任务', async () => {
    const actions: unknown[] = [];
    const tools = createAssistantTools({ userId: 'u-tool', cookie: 'c=1', internalBase: 'http://x', onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_title')!.run({ topic: '' });
    expect(out).toContain('还缺');
    expect(actions).toHaveLength(0);
  });

  it('计划超过 5 步：拒绝', async () => {
    const tools = createAssistantTools({ userId: 'u-tool-2', cookie: 'c=1', internalBase: 'http://x' });
    const steps = Array.from({ length: 6 }, () => ({ board: 'topic', text: '选题' }));
    expect(await tools.find((t) => t.name === 'propose_plan')!.run({ steps })).toContain('计划要 1 到 5 步');
  });

  it('计划里有不认识的板块：拒绝，并说出板块范围', async () => {
    const tools = createAssistantTools({ userId: 'u-tool-3', cookie: 'c=1', internalBase: 'http://x' });
    const out = await tools.find((t) => t.name === 'propose_plan')!.run({ steps: [{ board: 'podcast', text: '播客' }] });
    expect(out).toContain('板块不认识');
  });

  it('一个完整的计划：列出来，等老板确认（没有直接执行）', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const fetchImpl = vi.fn(async () => json([]));
    const tools = createAssistantTools({ userId: 'u-tool-4', cookie: 'c=1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_plan')!.run({
      steps: [{ board: 'topic', text: '菜市场的故事' }, { board: 'script', text: '把第一条写成脚本' }],
    });
    expect(out).toContain('等他点确认');
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'plan', maxRuns: 3 } });
    expect(String(actions[0].args.summary)).toContain('1. 选题');
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining('/api/dify/stream'), expect.anything());
  });
});
