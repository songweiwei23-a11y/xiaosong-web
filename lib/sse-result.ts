/**
 * 读一个"跑几十秒、最后给一个结果"的 SSE 回复（服务端见 lib/dify-task 的 sseTask）：
 * 心跳行跳过，等最后那条 {event:'result'} 或 {event:'error'}。浏览器端用。
 */
export async function readSseResult<T extends Record<string, unknown>>(res: Response): Promise<T> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('读取结果失败，请重试');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const ev of events) {
      const line = ev.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.event === 'error') throw new Error(data.message || '失败了，请重试');
      if (data.event === 'result') return data as T;
    }
    if (done) break;
  }
  throw new Error('和服务器的连接断了，请重试');
}
