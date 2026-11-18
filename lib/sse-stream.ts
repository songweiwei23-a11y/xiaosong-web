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

export interface TopicBatchStatus {
  requested: number;
  count: number;
  checked: boolean;
  removed: number;
  replaced: number;
}

export function topicBatchNotice(batch: TopicBatchStatus): string {
  const notes: string[] = [];
  if (batch.count < batch.requested) notes.push(`本次交付 ${batch.count}/${batch.requested} 条。其余选题撞题或补写未通过核对。`);
  if (!batch.checked) notes.push('本次完成了字面查重，内容查重暂不可用。');
  return notes.join(' ');
}

export interface ReadDifyStreamOptions {
  /** 每收到一段新文本时调用，piece 是增量，full 是累计全文 */
  onChunk?: (piece: string, full: string) => void;
  /** 首次取得 conversation_id 时调用，用于后续多轮对话 */
  onConversationId?: (id: string) => void;
  /** 断线后开始取回全文时调用，页面可以据此提示一句 */
  onRecovering?: () => void;
  /** 生成完以后服务端还在处理（比如脚本打磨：体检、第几轮打磨）时调用，message 是给用户看的一句话 */
  onStatus?: (message: string) => void;
  onTopicBatch?: (batch: TopicBatchStatus) => void;
  /** 服务端创建或恢复了可查询的生成任务。 */
  onTaskAccepted?: (task: { taskId: string; requestId?: string; status: string; stage: string }) => void;
  /** 任务进入新的执行阶段。 */
  onTaskStage?: (task: { taskId: string; status: string; stage: string; message?: string }) => void;
  /** 服务端已经尝试保存正文草稿；saved=false 时正文仍然保留在页面 */
  onDraftSaved?: (saved: boolean) => void;
  /** 后处理失败但页面仍保留可复制的草稿 */
  onPartialSaved?: (message: string) => void;
  /** 最终版本已经保存 */
  onFinalSaved?: (saved: boolean) => void;
  /**
   * 正文写完了、服务端开始核对修正时调用（2026-11-03）：页面据此停转圈，改成一行「正在核对」的小字。
   * 流还会继续读，核对改了稿会整篇替换，读到结束标记才返回。
   */
  onDraftDone?: (full: string) => void;
}

/** 正文出来、还在核对润色时，结果下面那行小字 */
export const FINISHING_NOTE = '正文已写完，正在核对细节、润色标题，做完会自动更新这份内容';

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

const processingLabels: Record<string, string> = {
  editorial_review: '正在校对正文', script_repair: '正在检查脚本结构', script_polish: '正在润色脚本',
  fact_check: '正在核对事实', detail_check: '正在核对细节', speaker_check: '正在核对说话人',
  years_repair: '正在核对年限', reality_repair: '正在核对现实依据', structure_check: '正在检查结构',
  topic_review: '正在检查重复选题并补题', worker_finalize: '正在保存最终稿', worker_ready: '草稿已保存，等待后处理',
};

export function generationStageLabel(stage: string) {
  return processingLabels[stage.replace(/^running_/, '')] || '正在处理已保存的草稿';
}

async function finishSavedTask(taskId: string, options: ReadDifyStreamOptions): Promise<string> {
  const deadline = Date.now() + 20 * 60_000;
  let version = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('/api/generation-tasks/' + encodeURIComponent(taskId), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if ([401, 403, 404].includes(response.status)) throw new DifyStreamError('无法读取当前任务，请确认登录账号并重新打开页面');
      if (response.ok) {
        const task = await response.json();
        if (task.id !== taskId) throw new DifyStreamError('返回的任务编号不匹配');
        options.onTaskStage?.({ taskId, stage: task.stage, status: task.status, message: task.error_message || undefined });
        if (task.status === 'post_processing') options.onStatus?.(generationStageLabel(task.stage));
        if (task.latest?.result && task.latest.version > version) {
          version = task.latest.version;
          options.onChunk?.('', task.latest.result);
        }
        if (task.status === 'completed' && task.latest?.kind === 'final') {
          if (task.latest.metadata?.topicBatch) options.onTopicBatch?.(task.latest.metadata.topicBatch);
          options.onFinalSaved?.(true);
          return task.latest.result;
        }
        if (['partial_saved', 'recoverable_failed', 'permanent_failed', 'canceled'].includes(task.status)) {
          const message = task.error_message || '后处理未完成，可以重新查看已保存的草稿';
          options.onPartialSaved?.(message);
          throw new DifyStreamError(message);
        }
        options.onStatus?.(generationStageLabel(task.stage));
      }
    } catch (error) {
      if (error instanceof DifyStreamError) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new DifyStreamError('后台处理尚未完成，可稍后返回本页查看已保存的版本');
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
  let topicDraft = false;
  let detachedId = '';
  let acceptedId = '';
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
        if (data.topic_draft === true) topicDraft = true;

        if (data.event === 'error') {
          throw new DifyStreamError(String(data.message || '生成失败，请稍后重试'), typeof data.code === 'string' ? data.code : undefined);
        }
        if (data.event === 'message_end') {
          ended = true;
          continue;
        }
        if (data.event === 'task_accepted' && typeof data.taskId === 'string') {
          acceptedId = data.taskId;
          options.onTaskAccepted?.({ taskId: data.taskId, requestId: typeof data.requestId === 'string' ? data.requestId : undefined, status: String(data.status || 'accepted'), stage: String(data.stage || 'accepted') });
          continue;
        }
        if (data.event === 'processing_detached' && data.taskId === acceptedId && acceptedId) {
          detachedId = acceptedId;
          options.onDraftDone?.(full);
          continue;
        }
        if (data.event === 'stage' && typeof data.taskId === 'string') {
          options.onTaskStage?.({ taskId: data.taskId, status: String(data.status || 'post_processing'), stage: String(data.stage || 'post_processing'), ...(typeof data.message === 'string' ? { message: data.message } : {}) });
          continue;
        }
        if (typeof data.taskId === 'string') {
          let status: string | undefined;
          if (data.event === 'final_saved' && data.saved) status = 'completed';
          if (data.event === 'draft_saved' && data.saved) status = 'draft_saved';
          if (data.event === 'partial_saved' || data.event === 'recoverable_failed') status = data.event;
          if (status) options.onTaskStage?.({ taskId: data.taskId, status, stage: data.stage || status, message: data.message });
        }
        if (data.event === 'draft_saved') {
          options.onDraftSaved?.(data.saved === true);
          continue;
        }
        if (data.event === 'partial_saved') {
          options.onPartialSaved?.(typeof data.message === 'string' ? data.message : '后续核对暂未完成，当前草稿已保留');
          continue;
        }
        if ((!data.taskId && data.event === 'history_saved') || data.event === 'final_saved') {
          options.onFinalSaved?.(data.saved === true);
          continue;
        }
        if (data.event === 'draft_done') {
          options.onDraftDone?.(full);
          continue;
        }
        if (data.event === 'status') {
          if (typeof data.message === 'string') options.onStatus?.(data.message);
          continue;
        }
        if (data.event === 'topic_batch') {
          options.onTopicBatch?.(data as TopicBatchStatus);
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
  if (detachedId || (!ended && acceptedId)) return finishSavedTask(detachedId || acceptedId, options);
  if (!ended && topicDraft) {
    throw new DifyStreamError('选题尚未完成核对，连接已中断。可稍后查看历史或重试。');
  }
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
