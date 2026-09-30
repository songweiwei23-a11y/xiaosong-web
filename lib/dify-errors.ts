/**
 * Dify 报错的识别与转述。纯函数，服务端和测试共用。
 *
 * 【为什么要有】Dify 在流里用 event: error 报错（HTTP 状态照样是 200）。
 * 原来的流式接口只转发正文，报错事件被直接丢掉——页面收到一个空流，
 * 什么提示都没有，用户看到的就是"点了没反应"。
 */

/**
 * 输入超出模型上下文。
 *
 * 线上实测（9/24 内容定位连续三次）：所有板块共用一个会话，Dify 记忆窗口 100 轮，
 * 会话里攒了 60 条、单条两三万字的问答，再加上一份两万多字的提示词，直接超限。
 * 这种错换一个新会话就好，所以要能认出来。
 */
export function isContextOverflowError(message: string): boolean {
  return /context (window|length)|maximum context|too many tokens|prompt is too long|input (is )?too long|exceeds the model/i.test(
    message || ''
  );
}

/** 从 Dify 的事件里取出报错文字；不是报错事件返回 null */
export function difyEventError(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  if (data.event === 'error') return String(data.message || data.code || '生成失败');
  // Chatflow 里某个节点失败时，工作流以 failed 收尾
  if (data.event === 'workflow_finished' && data.data?.status === 'failed') {
    return String(data.data?.error || '工作流运行失败');
  }
  return null;
}

/** 给用户看的说法。原文是英文堆栈，用户看不懂也没法处理 */
export function friendlyDifyError(message: string): string {
  if (isContextOverflowError(message)) return '这次要处理的内容太长了，已经为你换了一个新窗口，请再点一次生成';
  // 拆解爆款的截图太大：Dify 云端一次调用 5MB 上限（线上实测踩过）
  if (/PayloadTooLarge|payload_bytes|request entity too large|413/i.test(message)) return '这次发给 AI 的截图太大了，请点「重新拆解」再试一次';
  if (/rate limit|429|overloaded|529|too many requests/i.test(message)) return 'AI 这会儿太忙了，请过半分钟再试';
  if (/timeout|timed out/i.test(message)) return 'AI 响应超时了，请再试一次';
  return '生成失败，请稍后重试';
}
