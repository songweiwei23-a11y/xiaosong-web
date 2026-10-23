/**
 * 页面上生成的结果也能接着做（历史表里的记录）；历史没存成功必须提示老板（2026-10-23）。全部用假接口。
 */
import { describe, it, expect } from 'vitest';
import { listRecentResults, loadCarry } from '@/lib/assistant/carry';
import { runBoardJob } from '@/lib/assistant/board-job';
import { createJob } from '@/lib/assistant/jobs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const SCRIPT = [
  '## 脚本：老板凌晨三点的夜班',
  '台词：凌晨三点还在腌肉，每一串都是他自己一根一根穿出来的。',
  `${'这里是脚本的展开，讲收摊后算账、第二天一早又开火的过程。'.repeat(8)}`,
].join('\n');
const TOPICS = `选题一：老板凌晨三点的夜班，${'这里是选题的展开说明，从这份内容里的具体场景出发。'.repeat(10)}`;

describe('页面上生成的结果，也能按编号接着做', () => {
  it('最近的创作里有历史表的结果（编号以 h: 开头），取回时按页面规则组装', async () => {
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.includes('/api/script-history')) {
        return json([{ id: 'row-7', task_type: '脚本生成', input_data: { originContent: '最初的大方向：讲夜班' }, result: SCRIPT, created_at: '2026-10-23T03:00:00Z' }]);
      }
      return json([]);
    }) as unknown as typeof fetch;
    const ctx = { userId: 'u-hist', cookie: 'c=1', internalBase: 'http://x', fetchImpl };
    const list = await listRecentResults(ctx, 5);
    expect(list[0]).toMatchObject({ id: 'h:row-7', from: '脚本生成' });
    const carry = await loadCarry(ctx, 'h:row-7');
    expect(carry?.from).toBe('脚本生成');
    expect(carry?.sourceContent).toContain('凌晨三点还在腌肉');
    expect(carry?.originContent).toBe('最初的大方向：讲夜班');
  });

  it('历史表里没有这一条：取不到，返回 null', async () => {
    const fetchImpl = (async () => json([])) as unknown as typeof fetch;
    expect(await loadCarry({ userId: 'u-hist-2', cookie: 'c=1', internalBase: 'http://x', fetchImpl }, 'h:missing')).toBeNull();
  });
});

describe('历史没存成功，必须提示老板', () => {
  function stub(historyStatus: number) {
    return (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/dify/stream')) return sse(TOPICS);
      if (u.includes('/api/topics') && init?.method === 'POST') return json({ error: 'x' }, historyStatus);
      if (u.includes('/api/creation-sessions') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { payload: unknown };
        return json({ id: '6b1d6e1e-6f7a-4c2b-9a51-2f0c1d2e3f41', payload: body.payload });
      }
      return json([]);
    }) as unknown as typeof fetch;
  }
  const board = { kind: 'topic' as const, input: { request: '拍老板的夜班', count: 3, role: '按配比' as const, platform: '', keywords: [], tracks: [], styles: [], elements: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意' } };

  it('历史两次都保存失败：回答里明确提示先复制保存', async () => {
    const job = createJob('u-hist-3');
    await runBoardJob(job, { ctx: { userId: 'u-hist-3', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub(500) }, board, maxRuns: 2 });
    expect(job.status).toBe('done');
    expect(job.answer).toContain('没能存进历史');
    expect(job.answer).toContain('请先复制保存');
    const steps = job.events.filter((e) => e.type === 'step').map((e) => (e as { text: string }).text);
    expect(steps.some((t) => t.includes('没能存进历史'))).toBe(true);
  });

  it('历史保存成功：回答里没有这条提示', async () => {
    const job = createJob('u-hist-4');
    await runBoardJob(job, { ctx: { userId: 'u-hist-4', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub(200) }, board, maxRuns: 2 });
    expect(job.answer).not.toContain('没能存进历史');
  });
});
