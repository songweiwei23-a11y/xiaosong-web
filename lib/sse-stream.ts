// Dify 流式响应读取
//
// 后端 /api/dify/stream 以 SSE 格式逐块下发：
//   data: {"answer":"片段文本","conversation_id":"..."}\n\n
// 必须逐行取出 data: 后的 JSON 再拼 answer 字段。若直接把解码出的原始
// 字节累加显示，用户会看到满屏的 data: {"answer":...} 而不是正文。
//
// 另需按行缓冲：一次 read() 得到的块不保证正好落在行边界上，
// 直接按 \n 切分会把最后一行截断成非法 JSON。

export interface ReadDifyStreamOptions {
  /** 每收到一段新文本时调用，piece 是增量，full 是累计全文 */
  onChunk?: (piece: string, full: string) => void;
  /** 首次取得 conversation_id 时调用，用于后续多轮对话 */
  onConversationId?: (id: string) => void;
}

/**
 * 读取 Dify 流式响应，返回拼接后的完整文本。
 * 解析失败的行会被跳过而不是中断整个流——流末尾常有不完整的残块。
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
  let sentConversationId = false;

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
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (!sentConversationId && data.conversation_id && options.onConversationId) {
            sentConversationId = true;
            options.onConversationId(data.conversation_id);
          }
          const piece: string = data.answer ?? data.text ?? '';
          if (piece) {
            full += piece;
            options.onChunk?.(piece, full);
          }
        } catch {
          // 非 JSON 或不完整的行直接忽略，不影响后续内容
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return full;
}
