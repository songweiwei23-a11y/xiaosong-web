/**
 * 真实中转的端到端检查：助理循环能调用工具，再把结果说给用户。
 * 只在设置了 ASSISTANT_LIVE=1 且有中转配置时运行；平时跳过，不花钱、不依赖网络。
 */
import { describe, it, expect } from 'vitest';
import { runAssistantAgent, type AssistantEvent, type AssistantTool } from '@/lib/assistant/agent';

const LIVE = process.env.ASSISTANT_LIVE === '1' && !!process.env.ASSISTANT_API_KEY && !!process.env.ASSISTANT_API_BASE_URL;

describe.skipIf(!LIVE)('真实中转：助理循环调用工具并给出回复', () => {
  it('模型先查额度，再用一句中文告诉用户还能生成几次', async () => {
    const cfg = {
      baseUrl: process.env.ASSISTANT_API_BASE_URL!,
      apiKey: process.env.ASSISTANT_API_KEY!,
      model: process.env.ASSISTANT_MODEL || 'claude-sonnet-5-5',
    };
    const events: AssistantEvent[] = [];
    const quotaTool: AssistantTool = {
      name: 'read_quota',
      label: '正在查你的额度',
      description: 'Read the current user quota. Use this before answering questions about remaining generations.',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        return '套餐：基础会员；脚本生成剩余 3 次';
      },
    };
    const answer = await runAssistantAgent({
      cfg,
      system: '你是开物的助理。涉及额度时先调用 read_quota 工具，然后用一句中文回答。',
      userText: '我还能生成几次脚本？',
      history: [],
      tools: [quotaTool],
      emit: (e) => events.push(e),
      isStopped: () => false,
      maxSteps: 4,
    });
    expect(events.some((e) => e.type === 'step' && e.text === '正在查你的额度')).toBe(true);
    expect(answer).toMatch(/3/);
  }, 180_000);
});
