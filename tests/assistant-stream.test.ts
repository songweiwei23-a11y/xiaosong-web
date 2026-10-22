/**
 * 助理进度的流式接口（2026-10-22，升级方案 C2）：按行推送，结束后关闭；界面断了会退回轮询。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api-guard', () => ({
  requireUser: async () => ({ ok: true, userId: 'u-stream' }),
}));

import { GET } from '@/app/api/assistant/route';
import { createJob, pushEvent, finishJob } from '@/lib/assistant/jobs';

describe('流式进度：事件按行推送，结束后关闭', () => {
  it('已经结束的任务：推送已有的事件和最终答案，然后关闭', async () => {
    const job = createJob('u-stream');
    pushEvent(job, { type: 'step', text: '正在查你的待办' });
    pushEvent(job, { type: 'receipt', receipt: { kind: 'todo.add', ok: true, text: '已新增待办：「交稿」' } });
    finishJob(job, 'done', '已记下。');

    const res = await GET(new Request(`http://localhost/api/assistant?job=${job.id}&since=0&stream=1`));
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as { status: string; answer: string; events: { type: string }[] });
    const last = lines[lines.length - 1];
    expect(last).toMatchObject({ status: 'done', answer: '已记下。' });
    const types = lines.flatMap((l) => l.events.map((e) => e.type));
    expect(types).toEqual(['step', 'receipt']);
  });

  it('从 since 开始：只推后面的事件，前面的不重复', async () => {
    const job = createJob('u-stream');
    pushEvent(job, { type: 'step', text: '第一步' });
    pushEvent(job, { type: 'step', text: '第二步' });
    finishJob(job, 'done', '好');

    const res = await GET(new Request(`http://localhost/api/assistant?job=${job.id}&since=1&stream=1`));
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as { events: { text?: string }[] });
    const texts = lines.flatMap((l) => l.events.map((e) => e.text));
    expect(texts).toEqual(['第二步']);
  });

  it('别人的任务或不存在的任务：仍然是 404（流式和普通取进度一样）', async () => {
    const res = await GET(new Request('http://localhost/api/assistant?job=00000000-0000-4000-8000-000000000000&stream=1'));
    expect(res.status).toBe(404);
  });
});
