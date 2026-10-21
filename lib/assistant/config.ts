/**
 * 开物助理的模型配置。只在服务端读取，密钥不出现在任何返回值或日志里。
 *
 * 在服务器的环境变量里配置（中转 API，Anthropic 原生格式）：
 *   ASSISTANT_API_KEY       中转密钥（必须；密钥只放服务器，不进代码）
 *   ASSISTANT_API_BASE_URL  中转地址（可选；默认 https://apiclaude.cc，它是公开地址，不是密钥）
 *   ASSISTANT_MODEL         模型名（可选；默认 claude-sonnet-5-5）
 *   ASSISTANT_CHEAP_MODEL   简单意图用的便宜模型（可选；不填就全部用 ASSISTANT_MODEL，见 lib/assistant/routing.ts）
 *   ASSISTANT_PROMPT_CACHE  填 1 打开系统提示的缓存（可选；中转要支持，默认关）
 * 没有密钥，助理整体关闭（页面不显示入口，接口返回 503）。
 */

/** 中转地址的默认值。地址不是密钥，写在代码里，服务器上不用再改环境文件 */
export const DEFAULT_ASSISTANT_BASE_URL = 'https://apiclaude.cc';
export const DEFAULT_ASSISTANT_MODEL = 'claude-sonnet-5-5';

export interface AssistantConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 只有打开时才有这一项（默认没有） */
  promptCache?: boolean;
}

export function readAssistantConfig(env: Record<string, string | undefined> = process.env): AssistantConfig | null {
  const apiKey = env.ASSISTANT_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    baseUrl: env.ASSISTANT_API_BASE_URL?.trim() || DEFAULT_ASSISTANT_BASE_URL,
    apiKey,
    model: env.ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL,
    ...(env.ASSISTANT_PROMPT_CACHE?.trim() === '1' ? { promptCache: true } : {}),
  };
}

/** 便宜模型名；没配就是 null（不分流） */
export function readCheapModel(env: Record<string, string | undefined> = process.env): string | null {
  return env.ASSISTANT_CHEAP_MODEL?.trim() || null;
}
