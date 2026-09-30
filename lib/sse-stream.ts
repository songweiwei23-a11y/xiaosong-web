// Dify 流式响应读取
//
// 后端 /api/dify/stream 以 SSE 格式逐块下发：
//   data: {"answer":"片段文本","conversation_id":"...","message_id":"..."}\n\n
// 必须逐行取出 data: 后的 JSON 再拼 answer 字段。若直接把解码出的原始
// 字节累加显示，用户会看到满屏的 data: {"answer":...} 而不是正文。
//
// 另需按行缓冲：一次 read() 得到的块不保证正好落在行边界上，
// 直接按 \n 切分会把最后一行截断成非法 JSON。
//
// 结尾有三种：
//   message_end      写完了
//   error            出错了，message 是给用户看的话——原来这类事件被丢掉，
//                    页面收到空内容、什么都不提示，用户看到的是"点了没反应"
//   什么都没有就断了  半路断线。Dify 那边照样会写完，按消息 id 去取回全文
//                    （账号定位一篇要五分钟，线上真的断过，Dify 里是完整的、我们这边没存上）

export interface ReadDifyStreamOptions {
  /** 每收到一段新文本时调用，piece 是增量，full 是累计全文 */
  onChunk?: (piece: string, full: string) => void;
  /** 首次取得 conversation_id 时调用，用于后续多轮对话 */
  onConversationId?: (id: string) => void;
  /** 断线后开始取回全文时调用，页面可以据此提示一句 */
  onRecovering?: () => void;
}

/**
 * Dify 明确报的错：不再尝试续取，直接把话告诉用户。
 * code 是给页面判断"要不要自动换个办法再试"用的（比如 payload_too_large：拆解爆款会压小截图再试一次）。
 */
export class DifyStreamError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** 断线后最多等多久。账号定位全文约 5 分钟，留足余量 */
export const RECOVER_TIMEOUT_MS = 6 * 60_000;
const RECOVER_INTERVAL_MS = 4000;

type RecoverState =
  | { status: 'done'; answer: string }
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'missing' };

/** 断线后去服务端问那篇写完没有，写完返回全文；取不到返回 null */
export async function recoverDifyAnswer(
  conversationId: string,
  messageId: string,
  { timeoutMs = RECOVER_TIMEOUT_MS, intervalMs = RECOVER_INTERVAL_MS } = {}
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  const url =
    `/api/dify/recover?conversationId=${encodeURIComponent(conversationId)}` +
    `&messageId=${encodeURIComponent(messageId)}`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401 || res.status === 400) return null;
      if (res.ok) {
        const s = (await res.json()) as RecoverState;
        if (s.status === 'done') return s.answer;
        if (s.status === 'error') throw new DifyStreamError('生成失败，请稍后重试');
      }
    } catch (e) {
      if (e instanceof DifyStreamError) throw e;
      // 网络还没恢复，接着等
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * 读取 Dify 流式响应，返回拼接后的完整文本。
 * 解析失败的行会被跳过而不是中断整个流——流末尾常有不完整的残块。
 * 出错、或断线后取不回来时抛错（页面的 catch 会把 message 提示给用户）。
 */
export async function readDifyStream(
  response: Response,
  options: ReadDifyStreamOptions = {}
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let conversationId = '';
  let messageId = '';
  let ended = false;
  let broken: unknown = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 最后一段可能是被切断的半行，留到下一轮再拼
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        // ": ping" 之类的心跳注释行也在这里跳过
        if (!trimmed.startsWith('data: ')) continue;
        let data: any;
        try {
          data = JSON.parse(trimmed.slice(6));
        } catch {
          // 非 JSON 或不完整的行直接忽略，不影响后续内容
          continue;
        }
        if (!conversationId && data.conversation_id) {
          conversationId = data.conversation_id;
          options.onConversationId?.(data.conversation_id);
        }
        if (!messageId && data.message_id) messageId = data.message_id;

        if (data.event === 'error') {
          throw new DifyStreamError(String(data.message || '生成失败，请稍后重试'), typeof data.code === 'string' ? data.code : undefined);
        }
        if (data.event === 'message_end') {
          ended = true;
          continue;
        }
        if (data.event === 'message_replace' && typeof data.answer === 'string') {
          // 服务端断线后取回的全文，整篇替换
          full = data.answer;
          options.onChunk?.('', full);
          continue;
        }
        const piece: string = data.answer ?? data.text ?? '';
        if (piece) {
          full += piece;
          options.onChunk?.(piece, full);
        }
      }
    }
  } catch (e) {
    if (e instanceof DifyStreamError) throw e;
    broken = e;
  } finally {
    reader.releaseLock();
  }

  /*
   * 没收到结束标记就没了下文 = 半路断了。
   * 只在拿到过消息 id 时这样判断：说明对面是会发结束标记的新接口，
   * 老接口不发 message_id，照旧按"流结束就是写完"处理。
   */
  if (!ended && messageId && conversationId) {
    options.onRecovering?.();
    const answer = await recoverDifyAnswer(conversationId, messageId);
    if (answer) {
      options.onChunk?.('', answer);
      return answer;
    }
    throw new Error(
      full
        ? '网络断了一下，这篇没能完整取回。已经显示的部分可以先复制，或者重新生成'
        : '网络断了，请重试'
    );
  }
  if (broken) {
    throw new Error(full ? '网络断了一下，内容没有接收完整，请重新生成' : '网络断了，请重试');
  }
  return full;
}
