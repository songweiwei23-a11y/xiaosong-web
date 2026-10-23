/**
 * 多步计划：每一步都按页面「带去下一步」的规则接上一步（2026-10-23）。
 * 第一步存下来的创作（完整内容、原方向、设置）交给第二步；存不下来才退回文字传递。全部用假接口。
 */
import { describe, it, expect } from 'vitest';
import { runPlanJob } from '@/lib/assistant/board-job';
import { createJob } from '@/lib/assistant/jobs';
import type { BoardAny } from '@/lib/assistant/board-dispatch';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (answer: string) =>
  new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const DIRECTION_RESULT = [
  '## 方向一：凌晨收摊的烧烤摊',
  '- 视频目的：流量型',
  '- 核心思路：拍老板凌晨收摊、算账的真实场景',
  '- 怎么拍：口播加后厨镜头，不摆拍',
  '',
  `这个方向讲的是一个真实的夜班故事，老板每天凌晨三点还在腌肉。${'这里是这个方向的展开说明。'.repeat(10)}`,
].join('\n');

const TOPIC_RESULT = `选题一：老板凌晨三点的夜班，${'这里是选题的展开说明，从这份内容里的具体场景出发。'.repeat(8)}`;

/** 按任务类型给回答；创作会话的保存原样回显内容（和服务端一样返回编号和内容） */
function stub(bodies: Record<string, unknown>[], saved: { n: number }) {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/dify/stream')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      return sse(body.taskType === '创作方向' ? DIRECTION_RESULT : TOPIC_RESULT);
    }
    if (u.includes('/api/creation-sessions') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { payload: unknown };
      saved.n += 1;
      return json({ id: `6b1d6e1e-6f7a-4c2b-9a51-2f0c1d2e3f4${saved.n}`, payload: body.payload });
    }
    return json([]);
  }) as unknown as typeof fetch;
}

const TOPIC_INPUT = {
  request: '写 3 个选题',
  count: 3,
  role: '按配比' as const,
  platform: '',
  keywords: [],
  tracks: [],
  styles: [],
  elements: [],
  benchmarkAccounts: '',
  viralCases: '',
  difficulty: '中等创意',
};

describe('多步计划：第一步的创作交给第二步', () => {
  it('第二步的选题提示词带着第一步的完整内容，并标明从这份内容出发', async () => {
    const bodies: Record<string, unknown>[] = [];
    const saved = { n: 0 };
    const steps: BoardAny[] = [
      { kind: 'direction', input: { goal: '讲老板的夜班', count: 3 } },
      { kind: 'topic', input: TOPIC_INPUT },
    ];
    const job = createJob('u-plan-carry');
    await runPlanJob(job, { ctx: { userId: 'u-plan-carry', cookie: 'c=1', internalBase: 'http://x', fetchImpl: stub(bodies, saved) }, plan: { kind: 'plan', steps }, maxRuns: 1 });

    expect(bodies).toHaveLength(2);
    expect(bodies[0].taskType).toBe('创作方向');
    const topicQuery = String(bodies[1].query);
    expect(topicQuery).toContain('这批选题从带来的内容出发');
    expect(topicQuery).toContain('凌晨收摊的烧烤摊');
    expect(saved.n).toBeGreaterThanOrEqual(1);
  });
});
