import type { AssistantConfig } from './config';

/**
 * 调用中转 API（Anthropic Messages 格式，支持工具调用）。只在服务端使用。
 *
 * 错误信息只说状态码，不回显响应体，避免把中转方的报错原文（可能带着密钥相关信息）给用户。
 */

export type LlmBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  /** 发给模型看的图片（创作进度导入的截图） */
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | LlmBlock[];
}

export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmResponse {
  content: LlmBlock[];
  stop_reason: string | null;
}

export class AssistantLlmError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AssistantLlmError';
  }
}

/** 中转地址可以写到 /v1 结尾，也可以只写域名；两种都要能用 */
export function messagesUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;
}

export async function callAssistantLlm(
  cfg: AssistantConfig,
  req: { system: string; messages: LlmMessage[]; tools: LlmToolDef[]; maxTokens?: number },
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<LlmResponse> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(messagesUrl(cfg.baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 2048,
      system: req.system,
      messages: req.messages,
      ...(req.tools.length ? { tools: req.tools } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new AssistantLlmError(`模型服务返回 ${res.status}`, res.status);
  const data = (await res.json().catch(() => null)) as { content?: unknown; stop_reason?: unknown } | null;
  if (!data || !Array.isArray(data.content)) throw new AssistantLlmError('模型返回的格式不对', 502);
  return {
    content: data.content as LlmBlock[],
    stop_reason: typeof data.stop_reason === 'string' ? data.stop_reason : null,
  };
}
