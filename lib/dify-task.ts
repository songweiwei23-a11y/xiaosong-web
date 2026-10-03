/**
 * 一次性的 Dify 任务：把整段回复收齐再处理（不是边生成边给用户看）。
 * 前采建档的提取、对话修改都是这种——要的是一份 JSON，不是一段流式文字。
 * 只在服务端用。
 */
import { difyEventError, friendlyDifyError } from './dify-errors';

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';

/**
 * 调一次「开物」，把整段回复收齐。
 * 不带 conversation_id：这类任务和前后的创作没有关系，接进共用会话只会把会话撑满、
 * 还可能被上一轮的文案带偏。
 */
export async function askDify(
  query: string,
  userId: string,
  searchQuery: string
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query, search_query: searchQuery, conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮仅整理和核对用户提供的前采资料，不执行联网搜索。' },
      query,
      response_mode: 'streaming',
      user: userId,
    }),
  });
  if (!res.ok || !res.body) {
    console.error('[dify-task] Dify 调用失败:', res.status, (await res.text().catch(() => '')).slice(0, 200));
    return { ok: false, message: 'AI 服务暂时不可用，请稍后再试' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const failure = difyEventError(data);
      if (failure) return { ok: false, message: friendlyDifyError(failure) };
      const chunk = (data.answer || data.text || '') as string;
      if ((data.event === 'message' || data.event === 'text_chunk') && chunk) text += chunk;
    }
  }
  return text ? { ok: true, text } : { ok: false, message: '这次没读出结果，请重试' };
}

/**
 * 把一个要跑几十秒的任务包成 SSE 回给浏览器：每 5 秒一个心跳，
 * 免得链路上哪一层（Nginx、运营商、浏览器）见连接长时间没动静就掐掉；
 * 最后一条是 task 返回的那个事件（{event:'result', …} 或 {event:'error', message}）。
 */
export function sseTask(task: () => Promise<Record<string, unknown>>, label: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => write(': ping\n\n'), 5_000);
      try {
        write(`data: ${JSON.stringify(await task())}\n\n`);
      } catch (e) {
        console.error(`[${label}] 失败:`, e);
        write(`data: ${JSON.stringify({ event: 'error', message: '和 AI 的连接断了，请重试' })}\n\n`);
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* 对面已经关了 */
          }
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      // 必须是 event-stream：Nginx 的 gzip 会把 text/plain 攒起来压缩，攒够了才往下发
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
