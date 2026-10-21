/**
 * 助理的对话循环（lib/assistant/agent.ts）。用脚本化的假模型，不调用真实中转。
 */
import { describe, it, expect } from 'vitest';
import { runAssistantAgent, type AssistantEvent, type AssistantTool, type LlmFn } from '@/lib/assistant/agent';
import type { LlmResponse } from '@/lib/assistant/llm';

const CFG = { baseUrl: 'https://relay.example.com', apiKey: 'k', model: 'claude-sonnet-5-5' };

/** 按顺序返回预设的模型回复，并记下每次收到的消息数量 */
function scriptedLlm(replies: LlmResponse[]) {
  const seen: number[] = [];
  const fn: LlmFn = async (_cfg, req) => {
    seen.push(req.messages.length);
    const next = replies.shift();
    if (!next) throw new Error('模型被调用的次数超过预设');
    return next;
  };
  return { fn, seen };
}

const text = (t: string): LlmResponse => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
const toolUse = (id: string, name: string, input: Record<string, unknown> = {}): LlmResponse => ({
  content: [{ type: 'tool_use', id, name, input }],
  stop_reason: 'tool_use',
});

const tool = (name: string, run: AssistantTool['run'], label = `正在执行${name}`): AssistantTool => ({
  name,
  description: name,
  input_schema: { type: 'object' },
  label,
  run,
});

function harness(extra: Partial<Parameters<typeof runAssistantAgent>[0]> = {}) {
  const events: AssistantEvent[] = [];
  let stopped = false;
  return {
    events,
    stop() {
      stopped = true;
    },
    options: {
      cfg: CFG,
      system: 's',
      userText: '我该拍什么',
      history: [],
      tools: [],
      emit: (e: AssistantEvent) => events.push(e),
      isStopped: () => stopped,
      ...extra,
    },
  };
}

describe('直接回答（不用工具）', () => {
  it('模型一次就给出回复：直接返回，不报步骤', async () => {
    const h = harness();
    const { fn } = scriptedLlm([text('先看看你的作品进度')]);
    const answer = await runAssistantAgent({ ...h.options, llm: fn });
    expect(answer).toBe('先看看你的作品进度');
    expect(h.events).toEqual([]);
  });

  it('历史对话会按顺序带进去', async () => {
    const h = harness({ history: [{ role: 'user', text: '上一句' }, { role: 'assistant', text: '上一句的回复' }] });
    const { fn, seen } = scriptedLlm([text('好')]);
    await runAssistantAgent({ ...h.options, llm: fn });
    expect(seen[0]).toBe(3); // 两条历史 + 这一句
  });
});

describe('调用工具', () => {
  it('模型要工具：先报告步骤，执行，把结果交回去，再给最终回复', async () => {
    const h = harness({ tools: [tool('read_quota', async () => '套餐：基础会员', '正在查你的额度')] });
    const { fn, seen } = scriptedLlm([toolUse('tu_1', 'read_quota'), text('你还有 5 次')]);
    const answer = await runAssistantAgent({ ...h.options, llm: fn });
    expect(answer).toBe('你还有 5 次');
    expect(h.events).toEqual([{ type: 'step', text: '正在查你的额度' }]);
    // 第二次调用时，消息里多了：模型的工具请求 + 工具结果
    expect(seen).toEqual([1, 3]);
  });

  it('工具结果里带着工具的编号，模型才知道对应哪一次调用', async () => {
    let captured: unknown = null;
    const h = harness({ tools: [tool('read_quota', async () => '结果A')] });
    const fn: LlmFn = async (_c, req) => {
      if (req.messages.length === 3) captured = req.messages[2].content;
      return req.messages.length === 1 ? toolUse('tu_9', 'read_quota') : text('完');
    };
    await runAssistantAgent({ ...h.options, llm: fn });
    expect(captured).toEqual([{ type: 'tool_result', tool_use_id: 'tu_9', content: '结果A' }]);
  });

  it('模型点名了一个不存在的工具：告诉模型没有这个工具，不崩溃', async () => {
    const h = harness({ tools: [] });
    let result: unknown = null;
    const fn: LlmFn = async (_c, req) => {
      if (req.messages.length === 3) result = req.messages[2].content;
      return req.messages.length === 1 ? toolUse('tu_2', 'nope') : text('好的');
    };
    const answer = await runAssistantAgent({ ...h.options, llm: fn });
    expect(answer).toBe('好的');
    expect(result).toEqual([{ type: 'tool_result', tool_use_id: 'tu_2', content: '没有这个工具：nope', is_error: true }]);
  });

  it('工具执行出错：把原因交给模型，由它如实说明，循环继续', async () => {
    const h = harness({ tools: [tool('search_web', async () => { throw new Error('联网超时'); })] });
    let result: unknown = null;
    const fn: LlmFn = async (_c, req) => {
      if (req.messages.length === 3) result = req.messages[2].content;
      return req.messages.length === 1 ? toolUse('tu_3', 'search_web', { question: '热点' }) : text('暂时没查到');
    };
    const answer = await runAssistantAgent({ ...h.options, llm: fn });
    expect(answer).toBe('暂时没查到');
    expect(result).toEqual([{ type: 'tool_result', tool_use_id: 'tu_3', content: '执行失败：联网超时', is_error: true }]);
  });

  it('工具的输出太长：截断，不把整段内容塞进上下文', async () => {
    const huge = 'x'.repeat(20_000);
    const h = harness({ tools: [tool('read_account', async () => huge)] });
    let size = 0;
    const fn: LlmFn = async (_c, req) => {
      if (req.messages.length === 3) size = (req.messages[2].content as { content: string }[])[0].content.length;
      return req.messages.length === 1 ? toolUse('tu_4', 'read_account') : text('完');
    };
    await runAssistantAgent({ ...h.options, llm: fn });
    expect(size).toBeLessThan(7000);
  });
});

describe('步数上限与停止', () => {
  it('模型一直要工具：到上限就停，告诉用户步骤太多没做完，不会无限循环', async () => {
    const h = harness({ tools: [tool('read_quota', async () => 'ok')], maxSteps: 3 });
    const fn: LlmFn = async () => toolUse('tu', 'read_quota');
    const answer = await runAssistantAgent({ ...h.options, llm: fn });
    expect(answer).toBe('');
    expect(h.events.at(-1)).toMatchObject({ type: 'error' });
    expect(h.events.filter((e) => e.type === 'step')).toHaveLength(3);
  });

  it('用户点了停止：下一步之前就停，不再调用模型', async () => {
    const h = harness({ tools: [tool('read_quota', async () => 'ok')] });
    let calls = 0;
    const fn: LlmFn = async () => {
      calls++;
      h.stop();
      return toolUse('tu', 'read_quota');
    };
    await runAssistantAgent({ ...h.options, llm: fn });
    expect(calls).toBe(1);
    expect(h.events.at(-1)).toEqual({ type: 'error', text: '已经停下来了' });
  });
});
