import { callAssistantLlm, type LlmBlock, type LlmMessage, type LlmResponse, type LlmToolDef, type LlmUsage } from './llm';
import type { AssistantConfig } from './config';
import type { ActionReceipt } from './receipts';

/**
 * 助理的对话循环：模型要什么工具就执行什么，把结果交回去，直到它给出最终回复。
 *
 * 每一步都通过 emit 告诉界面（「正在查你的档案…」），用户能看到它在做什么。
 * 步数有上限，防止模型反复调用工具停不下来；用户可以随时停止（isStopped）。
 */

export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** 给用户看的进度文字，例如「正在查你的档案」 */
  label: string;
  /** 这个工具的结果最多交给模型多少字；不写就是默认的 6000 字（联网资料要更多） */
  maxResultChars?: number;
  run(input: Record<string, unknown>): Promise<string>;
}

/** 联网这一轮的质量反馈：状态、说明和来源（界面上展示给用户看） */
export interface WebFeedback {
  status: 'searching' | 'done' | 'unavailable' | 'quota_exhausted';
  message?: string;
  sources: { title: string; url: string }[];
}

export type AssistantEvent =
  | { type: 'step'; text: string }
  | { type: 'answer'; text: string }
  | { type: 'error'; text: string }
  | ({ type: 'web' } & WebFeedback)
  /** 要在页面上替用户做的事（见 lib/assistant/client-action-spec） */
  | { type: 'action'; name: string; args: Record<string, unknown> }
  /** 写操作的回执（见 lib/assistant/receipts.ts）：界面显示成卡片，能撤销的带撤销按钮 */
  | { type: 'receipt'; receipt: ActionReceipt };

export type LlmFn = (
  cfg: AssistantConfig,
  req: { system: string; messages: LlmMessage[]; tools: LlmToolDef[] },
) => Promise<LlmResponse>;

const MAX_TOOL_RESULT = 6000;

function truncate(text: string, max = MAX_TOOL_RESULT): string {
  return text.length > max ? `${text.slice(0, max)}\n…（内容太长，已截断）` : text;
}

export async function runAssistantAgent(opts: {
  cfg: AssistantConfig;
  system: string;
  userText: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  tools: AssistantTool[];
  emit: (event: AssistantEvent) => void;
  isStopped: () => boolean;
  maxSteps?: number;
  llm?: LlmFn;
  /** 每次模型调用返回的用量（记账用，见 lib/assistant/run.ts） */
  onUsage?: (usage: LlmUsage) => void;
}): Promise<string> {
  const maxSteps = opts.maxSteps ?? 6;
  const llm = opts.llm ?? callAssistantLlm;
  const toolDefs: LlmToolDef[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  const messages: LlmMessage[] = [
    ...opts.history.map((h) => ({ role: h.role, content: h.text })),
    { role: 'user' as const, content: opts.userText },
  ];

  for (let step = 0; step < maxSteps; step++) {
    if (opts.isStopped()) {
      opts.emit({ type: 'error', text: '已经停下来了' });
      return '';
    }
    const res = await llm(opts.cfg, { system: opts.system, messages, tools: toolDefs });
    if (res.usage) opts.onUsage?.(res.usage);
    const text = res.content
      .filter((b): b is Extract<LlmBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const uses = res.content.filter((b): b is Extract<LlmBlock, { type: 'tool_use' }> => b.type === 'tool_use');

    if (uses.length === 0) return text || '（这次没有生成回复，你可以换个说法再问一次）';

    messages.push({ role: 'assistant', content: res.content });
    const results: LlmBlock[] = [];
    for (const use of uses) {
      const tool = opts.tools.find((t) => t.name === use.name);
      if (!tool) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: `没有这个工具：${use.name}`, is_error: true });
        continue;
      }
      opts.emit({ type: 'step', text: tool.label });
      try {
        const out = await tool.run(use.input ?? {});
        results.push({ type: 'tool_result', tool_use_id: use.id, content: truncate(out, tool.maxResultChars) });
      } catch (error) {
        // 工具出错不中断整轮：把原因告诉模型，让它如实跟用户说明，而不是编一个结果
        const message = error instanceof Error ? error.message : '未知错误';
        results.push({ type: 'tool_result', tool_use_id: use.id, content: `执行失败：${message}`, is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  opts.emit({ type: 'error', text: '这次要做的步骤太多，没有全部完成。你可以把问题拆小一点再问' });
  return '';
}
