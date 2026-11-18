/** Send a durable task reference while the queue and model connection are pending. */
export const UPSTREAM_GENERATION_TIMEOUT_MS = 8 * 60_000;

export function streamAcceptedGeneration(
  task: { id: string; status: string; stage: string },
  requestId: string,
  run: () => Promise<Response>,
  refreshTask?: () => void,
): Response {
  const encoder = new TextEncoder();
  const event = (value: Record<string, unknown>) => encoder.encode(
    'data: ' + JSON.stringify({ ...value, taskId: task.id, requestId }) + '\n\n',
  );
  let receiverGone = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: Uint8Array) => { if (!receiverGone) controller.enqueue(data); };
      send(event({ event: 'task_accepted', status: task.status, stage: task.stage }));
      let pending = true;
      let ticks = 0;
      const heartbeat = setInterval(() => {
        if (!pending) return;
        send(event({ event: 'status', message: '任务已提交，正在等待生成服务响应' }));
        if (++ticks % 5 === 0) refreshTask?.();
      }, 8_000);
      try {
        const response = await run();
        pending = false;
        if (!response.ok) {
          const details = await response.json().catch(() => null);
          send(event({ event: 'error', message: details?.error || '生成服务暂时不可用，请稍后重试' }));
          return;
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('生成服务未返回正文');
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            send(value);
          }
        } finally {
          reader.releaseLock();
        }
      } catch {
        send(event({ event: 'error', message: '生成连接已中断，可查看已保存内容或稍后重试' }));
      } finally {
        clearInterval(heartbeat);
        if (!receiverGone) controller.close();
      }
    },
    cancel() { receiverGone = true; },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Generation-Id': requestId,
    },
  });
}
