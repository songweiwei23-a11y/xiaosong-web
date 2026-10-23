// 助理生成的账号定位：通过验收才写进账号定位表；没通过或写库失败，都要明确告诉老板（2026-10-24）。
import { describe, expect, it, vi } from 'vitest';
import { createJob } from '@/lib/assistant/jobs';
import { runBoardJob } from '@/lib/assistant/board-job';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

/** 账号定位的正文：要过长度要求（400 字以上），内容里带一个能认出来的标记 */
const POSITIONING = `# 川味地摊 · 账号定位\n${'这个号是一个做川味烧烤的小店，讲老板每天凌晨起来腌肉、一串一串穿、真实地卖给街坊。定位清楚：给附近三公里的人看，凭的是实在不坑。'.repeat(12)}`;

/** 假接口：板块请求返回定位正文；档案接口返回一个档案；其它返回空 */
function fakeFetch() {
  return (async (url: string) => {
    if (String(url).includes('/api/dify/stream')) return sse(POSITIONING);
    if (String(url).includes('/api/profiles')) return json([{ id: 'p-1', profile_name: '川味地摊' }]);
    return json([]);
  }) as unknown as typeof fetch;
}

/** 管理员模型：验收结论由 verdict 决定 */
function llmWith(verdict: { pass: boolean; problems: string[] }) {
  return (async () => ({ content: [{ type: 'text', text: JSON.stringify(verdict) }], stopReason: 'end_turn' })) as never;
}

const board = { kind: 'positioning' as const, input: { platform: '', notes: '' } };

describe('助理生成的账号定位写进账号定位表', () => {
  it('通过验收：写进去一次，写的是交付的那份正文', async () => {
    const persist = vi.fn(async (_text: string) => true);
    const job = createJob('u-pos-1');
    await runBoardJob(job, {
      ctx: { userId: 'u-pos-1', cookie: 'c=1', internalBase: 'http://x', profileId: 'p-1', fetchImpl: fakeFetch(), persistPositioning: persist },
      board,
      cfg: { apiKey: 'k' } as never,
      llm: llmWith({ pass: true, problems: [] }),
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(String(persist.mock.calls[0][0])).toContain('川味地摊 · 账号定位');
    expect(job.answer).not.toContain('没有写进账号定位表');
  });

  it('没通过验收：不写，交给老板判断，并且说清楚', async () => {
    const persist = vi.fn(async () => true);
    const job = createJob('u-pos-2');
    await runBoardJob(job, {
      ctx: { userId: 'u-pos-2', cookie: 'c=1', internalBase: 'http://x', profileId: 'p-1', fetchImpl: fakeFetch(), persistPositioning: persist },
      board,
      cfg: { apiKey: 'k' } as never,
      llm: llmWith({ pass: false, problems: ['定位没有说清楚给谁看'] }),
    });
    expect(persist).not.toHaveBeenCalled();
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.includes('没通过验收，没有写进账号定位表'))).toBe(true);
    expect(job.answer).toContain('没有写进账号定位表');
  });

  it('写库失败：过程里提醒，回答末尾也提醒，不假装已经保存', async () => {
    const persist = vi.fn(async () => false);
    const job = createJob('u-pos-3');
    await runBoardJob(job, {
      ctx: { userId: 'u-pos-3', cookie: 'c=1', internalBase: 'http://x', profileId: 'p-1', fetchImpl: fakeFetch(), persistPositioning: persist },
      board,
      cfg: { apiKey: 'k' } as never,
      llm: llmWith({ pass: true, problems: [] }),
    });
    expect(persist).toHaveBeenCalledTimes(1);
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((s) => s.includes('没能写进账号定位表'))).toBe(true);
    expect(job.answer).toContain('没有写进账号定位表');
  });

  it('没有提供写入函数（比如测试或旧调用）：照常运行，不写库', async () => {
    const job = createJob('u-pos-4');
    await runBoardJob(job, {
      ctx: { userId: 'u-pos-4', cookie: 'c=1', internalBase: 'http://x', profileId: 'p-1', fetchImpl: fakeFetch() },
      board,
      cfg: { apiKey: 'k' } as never,
      llm: llmWith({ pass: true, problems: [] }),
    });
    expect(job.status).toBe('done');
    expect(job.answer).not.toContain('没有写进账号定位表');
  });
});
