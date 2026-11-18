import { describe, expect, it, vi } from 'vitest';
import { streamAcceptedGeneration } from '@/lib/generation-response';

const task = { id: 'test-task', status: 'accepted', stage: 'accepted' };

describe('生成响应先发可恢复任务，再等待上游', () => {
  it('上游尚未返回，即可读到任务；随后照常读取正文', async () => {
    let start!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { start = resolve; });
    const response = streamAcceptedGeneration(task, 'test-request', () => pending);
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain('"event":"task_accepted"');
    expect(first).toContain('"taskId":"test-task"');
    start(new Response('data: {"event":"message","answer":"测试正文"}\n\n'));
    expect(decoder.decode((await reader.read()).value)).toContain('测试正文');
    expect((await reader.read()).done).toBe(true);
  });

  it('等待时有进度，排队失败时把可见错误放进事件流', async () => {
    vi.useFakeTimers();
    try {
      let start!: (response: Response) => void;
      const pending = new Promise<Response>(resolve => { start = resolve; });
      const reader = streamAcceptedGeneration(task, 'test-request', () => pending).body!.getReader();
      const decoder = new TextDecoder();
      await reader.read();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(decoder.decode((await reader.read()).value)).toContain('正在等待生成服务响应');
      start(Response.json({ error: '这个档案的上一轮创作还在进行' }, { status: 503 }));
      expect(decoder.decode((await reader.read()).value)).toContain('这个档案的上一轮创作还在进行');
      expect((await reader.read()).done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('页面刷新断开时，仍消费上游响应以完成保存', async () => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const server = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.close();
        finish();
      },
    }, { highWaterMark: 0 });
    const response = streamAcceptedGeneration(task, 'test-request', async () => new Response(server));
    await response.body!.cancel();
    await finished;
  });
});
