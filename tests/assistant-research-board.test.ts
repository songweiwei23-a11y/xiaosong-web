/**
 * 深度研究接入派活（2026-10-23）：主题必填、创建 → 等计划 → 开跑 → 轮询 → 报告交给验收，
 * 超时、失败、被停下时的结果，以及派活工具只列不跑。
 * 全部用假的研究接口和假时钟：不调用真实研究接口，不真等，结果每次一样。
 */
import { describe, it, expect, vi } from 'vitest';
import { maxRunsOf, missingFields, requirementOf, summaryOf, withUpstream, runAnyBoard, type BoardAny } from '@/lib/assistant/board-dispatch';
import { runResearchBoard, RESEARCH_TIMEOUT_MS, RESEARCH_POLL_MS } from '@/lib/assistant/boards-research';
import { runBoardJob, runPlanJob } from '@/lib/assistant/board-job';
import { createJob } from '@/lib/assistant/jobs';
import { createAssistantTools } from '@/lib/assistant/tools';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const JOB_ID = '6b1f0c2e-3d4a-4b5c-8d6e-7f8091a2b3c4';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN = { title: '本地烧烤店客流', questions: [{ q: '城北烧烤的客流有什么变化', queries: ['城北 烧烤 客流 2026'] }] };
const REPORT = '# 本地烧烤店客流\n\n## 核心结论\n\n- 周末客流高于工作日[[1]](https://example.com/a)';
const TOPIC = '本地烧烤店客流变化';
const CTX = { userId: 'u-research', cookie: 'c=1', internalBase: 'http://x' };

interface Call { method: string; url: string; body: Record<string, unknown> | null }

/**
 * 假的研究接口：POST 返回计划中；GET 按顺序返回 reads（最后一个一直重复）；PATCH 开跑或取消。
 * 其它地址（档案等）返回空，和助理其它板块的测试一样。
 */
function fakeResearch(reads: Record<string, unknown>[], opts: { onPost?: () => void; startError?: string } = {}) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes('/api/research')) return json([]);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method, url: u, body });
    if (method === 'POST') {
      opts.onPost?.();
      return json({ id: JOB_ID, status: 'planning' });
    }
    if (method === 'PATCH') {
      if (body?.action === 'start' && opts.startError) return json({ error: opts.startError }, 409);
      return json({ ok: true, status: 'running' });
    }
    return json(reads[Math.min(i++, reads.length - 1)]);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

/** 假时钟：sleep 不真等，只把时间往前推 */
function clock(timeoutMs = RESEARCH_TIMEOUT_MS) {
  let t = 0;
  return { timeoutMs, pollMs: RESEARCH_POLL_MS, now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe('主题必填：太短或太长，先挡住，不调用研究接口', () => {
  it('主题不到 4 个字：必填项先问，研究接口一次都不调用', async () => {
    expect(missingFields({ kind: 'research', input: { topic: '烧烤' } })).toEqual(['研究主题（至少 4 字）']);
    expect(missingFields({ kind: 'research', input: { topic: TOPIC } })).toEqual([]);
    const { fetchImpl, calls } = fakeResearch([]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: 'abc' }, clock());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('至少 4 个字');
    expect(calls).toHaveLength(0);
  });

  it('主题超过 500 字：也挡住', async () => {
    const long = '研'.repeat(501);
    expect(missingFields({ kind: 'research', input: { topic: long } })).toEqual(['研究主题（最多 500 字）']);
    const { fetchImpl, calls } = fakeResearch([]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: long }, clock());
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('完整流程：创建 → 等计划 → 开跑 → 轮询到 done，报告原文交回', () => {
  it('请求顺序和内容都对，报告原文原样交回', async () => {
    const { fetchImpl, calls } = fakeResearch([
      { id: JOB_ID, status: 'planning' },
      { id: JOB_ID, status: 'plan_ready', plan: PLAN },
      { id: JOB_ID, status: 'running' },
      { id: JOB_ID, status: 'writing' },
      { id: JOB_ID, status: 'done', report: REPORT },
    ]);
    const r = await runResearchBoard(
      { ...CTX, fetchImpl, profileId: null },
      { topic: TOPIC, depth: 'quick', material: '上一步：老板的店在城北' },
      clock(),
    );
    expect(r).toEqual({ ok: true, text: REPORT });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'GET', 'PATCH', 'GET', 'GET', 'GET']);
    expect(calls[0].url).toBe('http://x/api/research');
    expect(calls[0].body).toMatchObject({ topic: TOPIC, depth: 'quick', profileId: null, material: '上一步：老板的店在城北' });
    expect(String(calls[0].body?.requestId)).toMatch(UUID);
    // 开跑时带的是研究计划本身，动作是 start
    expect(calls[3].body).toEqual({ id: JOB_ID, action: 'start', plan: PLAN });
    expect(calls[1].url).toBe(`http://x/api/research?id=${JOB_ID}`);
  });

  it('不填深度按标准；没有背景资料就不带 material', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: REPORT }]);
    await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(calls[0].body?.depth).toBe('standard');
    expect(calls[0].body).not.toHaveProperty('material');
  });

  it('开跑后马上看一次进度，不白等一个间隔', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: REPORT }]);
    const sleeps: number[] = [];
    const t = clock();
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, { ...t, sleep: async (ms) => { sleeps.push(ms); await t.sleep(ms); } });
    expect(r.ok).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'PATCH', 'GET']);
    expect(sleeps).toHaveLength(0);
  });
});

describe('结束的各种情况：失败、停止、开跑被拒、报告是空的、超时', () => {
  it('研究失败：返回研究给的原因', async () => {
    const { fetchImpl } = fakeResearch([{ id: JOB_ID, status: 'failed', error: '联网搜索额度用完了' }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r).toEqual({ ok: false, text: '', error: '联网搜索额度用完了' });
  });

  it('研究失败但没给原因：用通用的说法', async () => {
    const { fetchImpl } = fakeResearch([{ id: JOB_ID, status: 'failed', error: null }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r.ok).toBe(false);
    expect(r.error).toBe('深度研究没有完成');
  });

  it('研究已停止（canceled）：返回已经停止', async () => {
    const { fetchImpl } = fakeResearch([{ id: JOB_ID, status: 'canceled' }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('已经停止');
  });

  it('计划拟好了但开跑被拒（比如次数用完）：返回接口的原因，不再继续等', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }], { startError: '本期深度研究次数已用完' });
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r).toEqual({ ok: false, text: '', error: '本期深度研究次数已用完' });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'PATCH']);
  });

  it('done 但报告是空的：不当成功', async () => {
    const { fetchImpl } = fakeResearch([{ id: JOB_ID, status: 'done', report: '' }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('报告是空的');
  });

  it('超过时间上限：不一直等，返回超时的说明', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'running' }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock(60_000));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('超过 1 分钟');
    // 60 秒、每 15 秒看一次：有限的几次，不会一直轮询
    expect(calls.filter((c) => c.method === 'GET').length).toBeLessThanOrEqual(5);
  });

  it('默认上限是 25 分钟，轮询间隔 15 秒', () => {
    expect(RESEARCH_TIMEOUT_MS).toBe(25 * 60_000);
    expect(RESEARCH_POLL_MS).toBe(15_000);
  });

  it('接口连续几次查不到进度：放弃并说明', async () => {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (!String(url).includes('/api/research')) return json([]);
      if (init?.method === 'POST') return json({ id: JOB_ID, status: 'planning' });
      return json({ error: '深度研究暂时不可用' }, 503);
    }) as unknown as typeof fetch;
    const r = await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC }, clock());
    expect(r.ok).toBe(false);
    expect(r.error).toContain('查不到深度研究的进度');
  });
});

describe('老板停下助理：不再等，后台的研究也取消', () => {
  it('停止标记为真：取消研究，返回已经停下来了', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'running' }]);
    const r = await runResearchBoard({ ...CTX, fetchImpl, isStopped: () => calls.length >= 3 }, { topic: TOPIC }, clock());
    expect(r).toEqual({ ok: false, text: '', error: '已经停下来了' });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'GET', 'PATCH']);
    expect(calls[3].body).toEqual({ id: JOB_ID, action: 'cancel' });
  });

  it('经派活框架停下：runBoardJob 里的停止标记接到研究上，任务以出错结束', async () => {
    const job = createJob('u-research-stop');
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'running' }], { onPost: () => { job.stopRequested = true; } });
    await runBoardJob(job, { ctx: { ...CTX, fetchImpl }, board: { kind: 'research', input: { topic: TOPIC } }, maxRuns: 1 });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
    expect(calls[1].body).toEqual({ id: JOB_ID, action: 'cancel' });
    expect(job.status).toBe('error');
    const errors = job.events.filter((e) => e.type === 'error').map((e) => (e as { text: string }).text);
    expect(errors[0]).toContain('深度研究');
    expect(errors[0]).toContain('已经停下来了');
  });
});

describe('派活框架：研究板块的各项登记', () => {
  it('通过派活入口跑完整流程（计划直接开跑，报告交回）', async () => {
    const { fetchImpl } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: REPORT }]);
    const r = await runAnyBoard({ ...CTX, fetchImpl }, { kind: 'research', input: { topic: TOPIC } });
    expect(r).toEqual({ ok: true, text: REPORT });
  });

  it('上一步的产出放进 material，主题不变', () => {
    const next = withUpstream({ kind: 'research', input: { topic: TOPIC } }, '选题1：城北烧烤的一天');
    expect(next).toMatchObject({ kind: 'research', input: { topic: TOPIC } });
    expect(next.kind === 'research' && next.input.material).toContain('【参考：上一步的产出】');
    expect(next.kind === 'research' && next.input.material).toContain('选题1：城北烧烤的一天');
  });

  it('返工意见（管理员写的）放进 material', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: REPORT }]);
    await runResearchBoard({ ...CTX, fetchImpl }, { topic: TOPIC, extraNote: '要有城北的数据' }, clock());
    expect(String(calls[0].body?.material)).toContain('【管理员返工意见】要有城北的数据');
  });

  it('摘要写清楚主题和深度；要求里带着主题', () => {
    const board: BoardAny = { kind: 'research', input: { topic: TOPIC, depth: 'deep' } };
    expect(summaryOf(board)).toContain('深入研究');
    expect(summaryOf(board)).toContain(TOPIC);
    expect(requirementOf(board)).toContain(TOPIC);
  });
});

describe('验收不过也不返工：深度研究只跑一次，报告和问题交给老板判断', () => {
  it('maxRunsOf：深度研究是 1，其它板块按传入的上限', () => {
    expect(maxRunsOf({ kind: 'research' }, 3)).toBe(1);
    expect(maxRunsOf({ kind: 'topic' }, 3)).toBe(3);
    expect(maxRunsOf({ kind: 'plan' }, 3)).toBe(3);
  });

  it('报告太短，验收不过：只派一次，报告和问题一起交给老板', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: '很短的报告' }]);
    const job = createJob('u-research-once');
    await runBoardJob(job, { ctx: { ...CTX, fetchImpl }, board: { kind: 'research', input: { topic: TOPIC } } });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(job.status).toBe('done');
    expect(job.answer).toContain('很短的报告');
    expect(job.answer).toContain('返工 0 次后仍有问题');
    expect(job.answer).toContain('产出太短');
  });

  it('计划里的深度研究也只跑一次，计划照常交付', async () => {
    const { fetchImpl, calls } = fakeResearch([{ id: JOB_ID, status: 'plan_ready', plan: PLAN }, { id: JOB_ID, status: 'done', report: '很短的报告' }]);
    const job = createJob('u-research-once-plan');
    await runPlanJob(job, { ctx: { ...CTX, fetchImpl }, plan: { kind: 'plan', steps: [{ kind: 'research', input: { topic: TOPIC } }] }, maxRuns: 3 });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(job.status).toBe('done');
    expect(job.answer).toContain('产出太短');
  });
});

describe('派活工具：只列给老板，不调用研究接口', () => {
  it('主题太短：先问，不列任务', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const fetchImpl = vi.fn(async () => json([]));
    const tools = createAssistantTools({ userId: 'u-research-tool', cookie: 'c=1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_research')!.run({ topic: '烧烤' });
    expect(out).toContain('还缺');
    expect(actions).toHaveLength(0);
  });

  it('主题够了：列给老板确认，带上深度和摘要；没有直接调用研究接口', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const fetchImpl = vi.fn(async () => json([]));
    const tools = createAssistantTools({ userId: 'u-research-tool-2', cookie: 'c=1', internalBase: 'http://x', fetchImpl: fetchImpl as never, onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_research')!.run({ topic: TOPIC, depth: 'deep' });
    expect(out).toContain('等他点确认');
    expect(out).toContain('只跑一次');
    expect(actions[0]).toMatchObject({ name: 'board.run', args: { board: 'research', maxRuns: 1 } });
    expect(String(actions[0].args.summary)).toContain('深入研究');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('深度填了不认识的值：按标准', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-research-tool-3', cookie: 'c=1', internalBase: 'http://x', onAction: (a) => actions.push(a) });
    await tools.find((t) => t.name === 'propose_research')!.run({ topic: TOPIC, depth: 'ultra' });
    expect(String(actions[0].args.summary)).toContain('标准研究');
  });

  it('多步计划里的深度研究：认得出，列给老板确认', async () => {
    const actions: { name: string; args: Record<string, unknown> }[] = [];
    const tools = createAssistantTools({ userId: 'u-research-tool-4', cookie: 'c=1', internalBase: 'http://x', onAction: (a) => actions.push(a) });
    const out = await tools.find((t) => t.name === 'propose_plan')!.run({
      steps: [{ board: 'research', text: TOPIC }, { board: 'brief', text: '把研究结论写成简报' }],
    });
    expect(out).toContain('等他点确认');
    expect(String(actions[0].args.summary)).toContain('1. 深度研究');
  });
});
