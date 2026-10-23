// 地基门槛（2026-10-23）有专门的测试（tests/foundation-gate*.test.ts）。这里只测本文件的功能，地基一律放行。
vi.mock('@/lib/foundation-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foundation-gate')>()),
  foundationGate: async () => null,
}));
/**
 * 助理作为管理员（2026-10-23）：派活要先确认；板块产出由管理员验收，不合格就返工，最多返工两次。
 * 内容由板块（Dify）生成，这里全部用假接口，不调用真实模型。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: 'u-route' }),
}));

import { applyRevisionEdits, checkBoardOutput, managerAnswer, parseRevisionEdits, reviseBoardOutput, MAX_REVISIONS } from '@/lib/assistant/manager';
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

  it('小改：按编辑精确替换，只动原文里出现一次的那句；其余原样保留', () => {
    // 正文够长，一处小改不超过三成
    const filler = '这是一段用来占位的正文内容。'.repeat(6);
    const body = filler + '第二句有问题。' + filler;
    const out = applyRevisionEdits(body, [{ old: '第二句有问题。', new: '第二句改好了。' }]);
    expect(out?.text).toBe(body.replace('第二句有问题。', '第二句改好了。'));
    expect(out?.applied).toBe(1);
  });

  it('小改：原文找不到或出现不止一处的编辑跳过，不猜位置；一处都改不了就整体不采用', () => {
    expect(applyRevisionEdits('甲。甲。乙。', [{ old: '甲。', new: '丙。' }])).toBeNull();
    expect(applyRevisionEdits('甲乙丙丁戊己庚辛壬癸'.repeat(3), [{ old: '不存在的句子', new: '改' }])).toBeNull();
    const mixed = applyRevisionEdits('甲乙丙丁戊己庚辛壬癸'.repeat(3) + '占位内容'.repeat(40) + '独一句。', [{ old: '甲乙', new: '甲乙改' }, { old: '独一句。', new: '独一句（已改）。' }]);
    expect(mixed?.applied).toBe(1);
    expect(mixed?.skipped).toBe(1);
  });

  it('小改：改动超过全文三成就是大改，整体不采用', () => {
    // 每段都不一样，保证这里测的是「比例」而不是「找不到」
    const body = Array.from({ length: 5 }, (_, i) => `第${i}段正文内容，用来测试改动的比例。`).join('');
    expect(applyRevisionEdits(body, [{ old: body.slice(0, 40), new: '替换' }])).toBeNull();
  });

  it('小改：模型把跨行的一句原样换行写进了 JSON 字符串里，也能解析出来', () => {
    const raw = '好的，修改如下：\n{"edits": [{"old": "3. 早上七点的晨跑攻略\n：三个动作", "new": "3. 老板晚上收摊后的复盘"}]}';
    const edits = parseRevisionEdits(raw);
    expect(edits).toEqual([{ old: '3. 早上七点的晨跑攻略\n：三个动作', new: '3. 老板晚上收摊后的复盘' }]);
    expect(parseRevisionEdits('不是 JSON')).toBeNull();
  });

  it('小改：第一次引用了整段原文（超出改动上限），再要一次，要求每处只写一句', async () => {
    const output = '第一句原文。第二句有问题。第三句原文。' + '占位'.repeat(60);
    const longOld = output.slice(0, 80);
    let calls = 0;
    const llm = (async () => {
      calls++;
      const text = calls === 1
        ? JSON.stringify({ edits: [{ old: longOld, new: '改' }] })
        : JSON.stringify({ edits: [{ old: '第二句有问题。', new: '第二句改好了。' }] });
      return { content: [{ type: 'text', text }], stopReason: 'end_turn' };
    }) as never;
    const r = await reviseBoardOutput({ apiKey: 'k' } as never, 'script', output, ['有问题'], { llm });
    expect(calls).toBe(2);
    expect(r?.text).toContain('第二句改好了');
  });

  it('小改：模型的回答必须是编辑列表，否则不修改', async () => {
    const output = Array.from({ length: 10 }, (_, i) => `第${i}句原文。`).join('') + '原文第二句有问题。';
    const good = (async () => ({ content: [{ type: 'text', text: '{"edits": [{"old": "原文第二句有问题。", "new": "改后第二句。"}]}' }], stopReason: 'end_turn' })) as never;
    const r = await reviseBoardOutput({ apiKey: 'k' } as never, 'script', output, ['有没有依据的说法'], { llm: good, requirement: '写一条脚本' });
    expect(r?.text).toContain('改后第二句');
    const bad = (async () => ({ content: [{ type: 'text', text: '好的，我改好了：……' }], stopReason: 'end_turn' })) as never;
    expect(await reviseBoardOutput({ apiKey: 'k' } as never, 'script', output, ['有问题'], { llm: bad })).toBeNull();
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
    const streamAnswers = [LONG_TOPIC];
    let boardCalls = 0;
    const fetchImpl = (async (url: string) => {
      if (String(url).includes('/api/dify/stream')) {
        boardCalls++;
        return sse(streamAnswers.shift() ?? LONG_TOPIC);
      }
      return json([]);
    }) as unknown as typeof fetch;
    // 管理员模型：第一次验收判不合格；管理员用一处小改编辑修好（只换开头那几个字）；复核通过
    let judgeCalls = 0;
    const llm = (async (_cfg: unknown, req: { system: string }) => {
      if (req.system.includes('管理员')) {
        const edits = { edits: [{ old: '凌晨四点的菜市场', new: '凌晨五点的菜市场' }] };
        return { content: [{ type: 'text', text: JSON.stringify(edits) }], stopReason: 'end_turn' };
      }
      judgeCalls++;
      const verdict = judgeCalls === 1 ? { pass: false, problems: ['第 2 条没有回应派活要求'] } : { pass: true, problems: [] };
      return { content: [{ type: 'text', text: JSON.stringify(verdict) }], stopReason: 'end_turn' };
    }) as never;

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
    expect(job.answer).toContain('凌晨五点的菜市场');
    expect(job.answer).not.toContain('凌晨四点的菜市场');
    expect(boardCalls).toBe(1);
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.includes('我直接改（第 1 次）'))).toBe(true);
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
    expect(steps.some((s) => s.includes('这几处改动太大或对不上原文'))).toBe(true);
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
