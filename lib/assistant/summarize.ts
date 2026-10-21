import type { AssistantConfig } from './config';
import { callAssistantLlm, type LlmResponse } from './llm';

/**
 * 长期对话的压缩：把较早的消息压成一段摘要，之后的对话只带摘要和最近的原文。
 * 摘要要保留的是：用户的目标和需求、已经确定的事实和偏好、做过什么、结果在哪、还没完成的事。
 */

export type SummaryCall = (cfg: AssistantConfig, req: Parameters<typeof callAssistantLlm>[1], opts: Parameters<typeof callAssistantLlm>[2]) => Promise<LlmResponse>;

const SUMMARY_SYSTEM = [
  '你在压缩一段开物助理和用户的对话，供之后继续聊天时参考。',
  '保留：用户的目标和需求；已经确定的事实、偏好和约束；助理做过的事（做了什么、结果在哪里）；还没完成的事和说好要提醒的事。',
  '去掉：寒暄、重复的话、已经被推翻的内容。不要编造对话里没有的信息。',
  '用中文，不超过 600 字，只输出摘要本身，不要标题和解释。',
].join('\n');

export async function summarizeMessages(
  cfg: AssistantConfig,
  prior: string,
  messages: { role: 'user' | 'assistant'; text: string }[],
  call: SummaryCall = callAssistantLlm,
): Promise<string> {
  const transcript = messages.map((m) => `${m.role === 'user' ? '用户' : '助理'}：${m.text.slice(0, 1200)}`).join('\n');
  const user = [prior.trim() ? `已有的摘要：\n${prior.trim()}\n` : '', '需要并入摘要的对话：', transcript].join('\n');
  const res = await call(
    cfg,
    { system: SUMMARY_SYSTEM, messages: [{ role: 'user', content: user }], tools: [], maxTokens: 900 },
    { signal: AbortSignal.timeout(60_000) },
  );
  return res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
    .slice(0, 1500);
}
