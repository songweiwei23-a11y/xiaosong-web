/**
 * 助理作为管理员（2026-10-23）：派活要先确认；板块产出由管理员验收，不合格就返工，最多返工两次。
 * 内容由板块（Dify）生成，这里全部用假接口，不调用真实模型。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: 'u-route' }),
}));

import { checkBoardOutput, managerAnswer, reviseBoardOutput, MAX_REVISIONS } from '@/lib/assistant/manager';
import { createPendingRun, takePendingRun } from '@/lib/assistant/pending-runs';
import { createAssistantTools } from '@/lib/assistant/tools';
import { runBoardJob } from '@/lib/assistant/board-job';
import { createJob } from '@/lib/assistant/jobs';
import { POST as boardRunPOST } from '@/app/api/assistant/board-run/route';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const LONG_TOPIC = `选题1：菜市场老板的真实一天\n开场钩子：凌晨四点的菜市场，老板第一句话就是……\n${'这是一条写得够具体的选题，有场景、有冲突、有结果。'.repeat(8)}`;

describe('验收：板块的产出合不合格', () => {
  it('产出太短：不合格，并写出字数', () => {
    const r = checkBoardOutput('topic', '太短', '');
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('产出太短');
  });

  it('选题：够长、没有其它问题，合格；不查事实（选题本来就引用原文）', () => {
    expect(checkBoardOutput('topic', LONG_TOPIC, '别的需求').ok).toBe(true);
  });

  it('脚本：废话开场不合格（用脚本质量规则）', () => {
    const script = `大家好，欢迎来到我的频道，今天我们来聊一聊门店生意。${'这里是正文内容，讲一讲具体做法。'.repeat(20)}`;
    const r = checkBoardOutput('script', script, '');
    expect(r.ok).toBe(false);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('审稿：够长就合格', () => {
    expect(checkBoardOutput('review', '审稿结论：开头可以更直接。'.repeat(10), '').ok).toBe(true);
  });

  it('直接修改：把验收的问题交给管理员模型，只改有问题的地方；修改后的稿子不能缩水太多', async () => {
    const seen: string[] = [];
    const llm = (async (_cfg: unknown, req: { system: string; messages: { content: string }[] }) => {
      seen.push(req.messages[0].content);
      return { content: [{ type: 'text', text: '修改后的完整稿子：'.repeat(20) }], stopReason: 'end_turn' };
    }) as never;
    const out = await reviseBoardOutput({ apiKey: 'k' } as never, 'script', '原稿：有一处说法需要改。'.repeat(10), ['有没有依据的说法'], { llm });
    expect(out).toContain('修改后的完整稿子');
    expect(seen[0]).toContain('有没有依据的说法');
    // 模型把稿子删到剩不下多少：不算修改，返回 null，保留原稿
    const shrink = (async () => ({ content: [{ type: 'text', text: '太短' }], stopReason: 'end_turn' })) as never;
    expect(await reviseBoardOutput({ apiKey: 'k' } as never, 'script', '原稿'.repeat(100), ['有问题'], { llm: shrink })).toBeNull();
  });

  it('最终回答：通过就写明直接修改了几次；仍有问题就交给用户判断', () => {
    expect(managerAnswer('正文', 3, [])).toContain('已直接修改 2 次');
    expect(managerAnswer('正文', 1, [])).toBe('正文\n\n——管理员验收：通过。');
    expect(managerAnswer('正文', 3, ['产出太短'])).toContain('请你判断是否采用');
    expect(managerAnswer('', 1, [])).toBe('');
  });

  it('直接修改的上限是两次', () => {
    expect(MAX_REVISIONS).toBe(2);
  });
});

describe('派活：先列出来，用户确认后才开跑', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('派活工具只列出任务，不调用板块，并告诉界面等确认', async () => {
    const fetchSpy = vi.fn(async () => json([]));
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({
      userId: 'u-propose',
      cookie: 'c=1',
      profileId: 'p1',
      internalBase: 'http://x',
      fetchImpl: fetchSpy as unknown as typeof fetch,
      onAction: (a) => actions.push(a),
    });
    const out = await tools.find((t) => t.name === 'propose_topic')!.run({ request: '拍菜市场的真实故事', count: 5, keywords: ['菜市场', '老板'] });
    expect(out).toContain('等他点确认后才开跑');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'topic', label: '选题策划', maxRuns: 2, feature: '选题' } });
    expect(String(actions[0].args.summary)).toContain('关键词：菜市场、老板');
    // 列出的任务可以被取走一次，取走后就没了（防重复开跑）
    const runId = String(actions[0].args.runId);
    expect(takePendingRun('u-propose', runId)).not.toBeNull();
    expect(takePendingRun('u-propose', runId)).toBeNull();
  });

  it('派活的需求不完整：不列出任务，先去问清楚', async () => {
    const actions: unknown[] = [];
    const tools = createAssistantTools({ userId: 'u-empty', cookie: 'c=1', internalBase: 'http://x', onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_script')!.run({ request: '  ' });
    expect(out).toContain('还不知道用户想拍什么');
    expect(actions).toHaveLength(0);
  });

  it('待确认的任务只属于本人；超过 30 分钟就作废', () => {
    const run = createPendingRun({
      userId: 'u-owner', board: { kind: 'review', input: { draft: '稿子' } }, kind: 'review', label: '审稿优化', summary: '审稿', maxRuns: 3, profileId: null, memoryOn: true,
    }, 1_000);
    expect(takePendingRun('u-other', run.id, 1_000)).toBeNull();
    expect(takePendingRun('u-owner', run.id, 1_000 + 31 * 60_000)).toBeNull();
    const again = createPendingRun({
      userId: 'u-owner', board: { kind: 'review', input: { draft: '稿子' } }, kind: 'review', label: '审稿优化', summary: '审稿', maxRuns: 3, profileId: null, memoryOn: true,
    }, 1_000);
    expect(takePendingRun('u-owner', again.id, 2_000)).not.toBeNull();
  });
});

describe('管理员执行：板块只跑一次，不合格由管理员直接修改', () => {
  it('第一版太短，管理员直接修改，改好后交付；板块只被调用一次，不整份重跑', async () => {
    const streamAnswers = ['太短'];
    let boardCalls = 0;
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('/api/dify/stream')) {
        boardCalls++;
        return sse(streamAnswers.shift() ?? LONG_TOPIC);
      }
      return json([]);
    }) as unknown as typeof fetch;
    // 管理员模型：验收员的判断照常放行；修改请求返回一版够长的稿子
    const llm = (async (_cfg: unknown, req: { system: string }) =>
      req.system.includes('管理员')
        ? { content: [{ type: 'text', text: LONG_TOPIC }], stopReason: 'end_turn' }
        : { content: [{ type: 'text', text: '{"pass": true, "problems": []}' }], stopReason: 'end_turn' }) as never;

    const job = createJob('u-job-1');
    await runBoardJob(job, {
      ctx: { userId: 'u-job-1', cookie: 'c=1', internalBase: 'http://x', fetchImpl },
      board: { kind: 'topic', input: { request: '拍菜市场的真实故事', count: 5, role: '按配比' } },
      maxRuns: MAX_REVISIONS,
      cfg: { apiKey: 'k' } as never,
      llm,
    });

    expect(job.status).toBe('done');
    expect(job.answer).toContain('菜市场老板的真实一天');
    expect(job.answer).toContain('已直接修改 1 次');
    expect(boardCalls).toBe(1);
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.includes('我直接修改（第 1 次）'))).toBe(true);
    expect(steps.some((s) => s.includes('验收通过'))).toBe(true);
    expect(steps.some((s) => s.includes('返工'))).toBe(false);
  });

  it('直接修改也改不好：保留原稿，交给用户判断，不假装已经合格', async () => {
    let boardCalls = 0;
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('/api/dify/stream')) boardCalls++;
      return String(url).includes('/api/dify/stream') ? sse('太短') : json([]);
    }) as unknown as typeof fetch;
    // 管理员模型修改不出来（出错）：保留原稿
    const llm = (async (_cfg: unknown, req: { system: string }) => {
      if (req.system.includes('管理员')) throw new Error('模型暂时不可用');
      return { content: [{ type: 'text', text: '{"pass": true, "problems": []}' }], stopReason: 'end_turn' };
    }) as never;
    const job = createJob('u-job-2');
    await runBoardJob(job, {
      ctx: { userId: 'u-job-2', cookie: 'c=1', internalBase: 'http://x', fetchImpl },
      board: { kind: 'topic', input: { request: '拍菜市场的真实故事', count: 5, role: '按配比' } },
      maxRuns: MAX_REVISIONS,
      cfg: { apiKey: 'k' } as never,
      llm,
    });
    expect(job.status).toBe('done');
    expect(job.answer).toContain('请你判断是否采用');
    expect(job.answer).not.toContain('验收：通过');
    expect(boardCalls).toBe(1);
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.includes('这几处没能改好'))).toBe(true);
  });

  it('板块报错（比如额度用完）：停下来，不再返工，把原因告诉用户', async () => {
    const fetchImpl = (async (url: string) => (String(url).includes('/api/dify/stream') ? json({ error: '本期选题额度已用完' }, 402) : json([]))) as unknown as typeof fetch;
    const job = createJob('u-job-3');
    await runBoardJob(job, {
      ctx: { userId: 'u-job-3', cookie: 'c=1', internalBase: 'http://x', fetchImpl },
      board: { kind: 'topic', input: { request: '拍菜市场的真实故事', count: 5, role: '按配比' } },
      maxRuns: MAX_REVISIONS,
    });
    expect(job.status).toBe('error');
    const errors = job.events.filter((e) => e.type === 'error').map((e) => (e as { text: string }).text);
    expect(errors[0]).toContain('本期选题额度已用完');
  });
});

describe('确认开跑的接口', () => {
  it('未知或过期的任务编号：404，不开跑', async () => {
    const res = await boardRunPOST(new Request('http://localhost/api/assistant/board-run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: '00000000-0000-4000-8000-000000000000' }),
    }));
    expect(res.status).toBe(404);
  });

  it('编号格式不对：400', async () => {
    const res = await boardRunPOST(new Request('http://localhost/api/assistant/board-run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'x' }),
    }));
    expect(res.status).toBe(400);
  });
});
