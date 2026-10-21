/**
 * 助理的模型客户端（lib/assistant/llm.ts）和配置读取（lib/assistant/config.ts）。
 * 用假的 fetch，不真正调用中转。
 */
import { describe, it, expect } from 'vitest';
import { callAssistantLlm, messagesUrl, AssistantLlmError } from '@/lib/assistant/llm';
import { readAssistantConfig } from '@/lib/assistant/config';

const CFG = { baseUrl: 'https://relay.example.com', apiKey: 'sk-test-secret-value', model: 'claude-sonnet-5-5' };

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('中转地址', () => {
  it('只写域名或写到 /v1，都拼成 /v1/messages', () => {
    expect(messagesUrl('https://apiclaude.cc')).toBe('https://apiclaude.cc/v1/messages');
    expect(messagesUrl('https://apiclaude.cc/')).toBe('https://apiclaude.cc/v1/messages');
    expect(messagesUrl('https://apiclaude.cc/v1')).toBe('https://apiclaude.cc/v1/messages');
    expect(messagesUrl('https://apiclaude.cc/v1/')).toBe('https://apiclaude.cc/v1/messages');
  });
});

describe('请求格式', () => {
  it('用 Anthropic 格式：x-api-key 和版本头，带上模型、系统提示和工具', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenInit = init;
      return jsonRes({ content: [{ type: 'text', text: '好的' }], stop_reason: 'end_turn' });
    }) as unknown as typeof fetch;

    await callAssistantLlm(
      CFG,
      { system: '系统提示', messages: [{ role: 'user', content: '你好' }], tools: [{ name: 't', description: 'd', input_schema: { type: 'object' } }] },
      { fetch: fakeFetch },
    );

    expect(seenUrl).toBe('https://relay.example.com/v1/messages');
    const headers = seenInit!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(CFG.apiKey);
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(seenInit!.body as string);
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.system).toBe('系统提示');
    expect(body.tools[0].name).toBe('t');
  });

  it('没有工具时不发 tools 字段', async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return jsonRes({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' });
    }) as unknown as typeof fetch;
    await callAssistantLlm(CFG, { system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [] }, { fetch: fakeFetch });
    expect('tools' in body).toBe(false);
  });
});

describe('返回内容', () => {
  it('能解析出工具调用块', async () => {
    const fakeFetch = (async () =>
      jsonRes({
        content: [{ type: 'tool_use', id: 'tu_1', name: 'read_quota', input: {} }],
        stop_reason: 'tool_use',
      })) as unknown as typeof fetch;
    const res = await callAssistantLlm(CFG, { system: 's', messages: [], tools: [] }, { fetch: fakeFetch });
    expect(res.stop_reason).toBe('tool_use');
    expect(res.content[0]).toEqual({ type: 'tool_use', id: 'tu_1', name: 'read_quota', input: {} });
  });

  it('返回格式不对时报错，不把乱数据交给对话循环', async () => {
    const fakeFetch = (async () => jsonRes({ nothing: true })) as unknown as typeof fetch;
    await expect(callAssistantLlm(CFG, { system: 's', messages: [], tools: [] }, { fetch: fakeFetch })).rejects.toBeInstanceOf(AssistantLlmError);
  });
});

describe('出错时不泄露密钥和中转的报错原文', () => {
  it('非 2xx：只报状态码，错误信息里没有密钥，也没有响应体', async () => {
    const fakeFetch = (async () => new Response('bad key sk-test-secret-value', { status: 401 })) as unknown as typeof fetch;
    const err = await callAssistantLlm(CFG, { system: 's', messages: [], tools: [] }, { fetch: fakeFetch }).catch((e) => e);
    expect(err).toBeInstanceOf(AssistantLlmError);
    expect(err.status).toBe(401);
    expect(err.message).toContain('401');
    expect(err.message).not.toContain('sk-test-secret-value');
    expect(err.message).not.toContain('bad key');
  });
});

describe('配置读取', () => {
  it('密钥必须有；地址和模型名没写就用默认值（地址 https://apiclaude.cc，模型 claude-sonnet-5-5）', () => {
    expect(readAssistantConfig({ ASSISTANT_API_KEY: 'k' })).toEqual({ baseUrl: 'https://apiclaude.cc', apiKey: 'k', model: 'claude-sonnet-5-5' });
    expect(readAssistantConfig({ ASSISTANT_API_BASE_URL: 'https://a.example', ASSISTANT_API_KEY: 'k' })).toEqual({ baseUrl: 'https://a.example', apiKey: 'k', model: 'claude-sonnet-5-5' });
    expect(readAssistantConfig({ ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm2' })?.model).toBe('m2');
  });

  it('没有密钥就整体关闭，即使写了地址也一样', () => {
    expect(readAssistantConfig({ ASSISTANT_API_BASE_URL: 'https://a.example' })).toBeNull();
    expect(readAssistantConfig({})).toBeNull();
  });
});
