import type { AssistantConfig } from './config';

/**
 * 调用中转 API（Anthropic Messages 格式，支持工具调用）。只在服务端使用。
 *
 * 错误信息只说状态码，不回显响应体，避免把中转方的报错原文（可能带着密钥相关信息）给用户。
 *
 * 可靠性（升级方案 C3）：单次调用 60 秒超时；超时、网络断开、429 和 5xx 各重试一次（隔 1.2 秒）。
 * 用量（升级方案 G1）：把模型返回的 token 用量带回来，由调用方记录。
 * 提示词缓存（升级方案 G3）：配置打开时，系统提示加上 cache_control，重复的长提示只按缓存价计费。
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

export interface LlmUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface LlmResponse {
  content: LlmBlock[];
  stop_reason: string | null;
  usage?: LlmUsage;
}

export class AssistantLlmError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AssistantLlmError';
  }
}

export const LLM_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1200;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504, 529]);

/** 中转地址可以写到 /v1 结尾，也可以只写域名；两种都要能用 */
export function messagesUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;
}

function parseUsage(raw: unknown): LlmUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cacheRead: n(u.cache_read_input_tokens),
    cacheWrite: n(u.cache_creation_input_tokens),
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function callAssistantLlm(
  cfg: AssistantConfig,
  req: { system: string; messages: LlmMessage[]; tools: LlmToolDef[]; maxTokens?: number },
  opts: { fetch?: typeof fetch; signal?: AbortSignal; retryDelayMs?: number } = {},
): Promise<LlmResponse> {
  const doFetch = opts.fetch ?? fetch;
  const delay = opts.retryDelayMs ?? RETRY_DELAY_MS;
  // 提示词缓存：只有配置打开时才改成分块格式（不是所有中转都支持，默认关）
  const system = cfg.promptCache ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }] : req.system;
  const body = JSON.stringify({
    model: cfg.model,
    max_tokens: req.maxTokens ?? 2048,
    system,
    messages: req.messages,
    ...(req.tools.length ? { tools: req.tools } : {}),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const last = attempt === 1;
    let res: Response;
    try {
      res = await doFetch(messagesUrl(cfg.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        signal: opts.signal ?? AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
    } catch (error) {
      // 调用方主动停止时不重试；超时和网络错误才重试
      if (opts.signal?.aborted) throw error;
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (!last) {
        await sleep(delay);
        continue;
      }
      throw new AssistantLlmError(timedOut ? '模型服务响应超时' : '模型服务连接失败', timedOut ? 504 : 502);
    }

    if (!res.ok) {
      if (!last && RETRY_STATUS.has(res.status)) {
        await sleep(delay);
        continue;
      }
      throw new AssistantLlmError(`模型服务返回 ${res.status}`, res.status);
    }
    const data = (await res.json().catch(() => null)) as { content?: unknown; stop_reason?: unknown; usage?: unknown } | null;
    if (!data || !Array.isArray(data.content)) throw new AssistantLlmError('模型返回的格式不对', 502);
    return {
      content: data.content as LlmBlock[],
      stop_reason: typeof data.stop_reason === 'string' ? data.stop_reason : null,
      usage: parseUsage(data.usage),
    };
  }
  // 循环里每一次都会 return 或 throw，走到这里说明逻辑有误
  throw new AssistantLlmError('模型服务没有返回结果', 502);
}
