/**
 * 助理的联网：和自由对话同一套搜索服务，但每条消息只联网一次、只扣一次联网额度，
 * 资料全文交给模型，来源和状态推给界面。搜索服务用假的，不碰真实额度和阿里云。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const search = vi.hoisted(() => ({
  prepareWebSearch: vi.fn(),
  searchFreeChatWeb: vi.fn(),
}));

vi.mock('@/lib/web-search-quota', () => ({ prepareWebSearch: search.prepareWebSearch }));
vi.mock('@/lib/free-chat-web', () => ({ searchFreeChatWeb: search.searchFreeChatWeb }));

import { createAssistantTools, type AssistantToolContext } from '@/lib/assistant/tools';
import { freeChatAnswerRules } from '@/lib/free-chat-answer';
import type { WebFeedback } from '@/lib/assistant/agent';

const granted = () => ({
  enabled: true,
  inputs: { web_search_note: '本轮可执行一次联网搜索' },
  quota: { allowed: true, reason: 'reserved' },
  markStarted: vi.fn(async () => undefined),
});

const found = {
  status: { status: 'done', sources: [{ title: '国家统计局', url: 'https://www.stats.gov.cn/a' }] },
  context: '【本轮联网原始资料】资料全文 A',
  query: 'q',
  strategy: 'pro-fetch',
  readCount: 1,
};

function tools(extra: Partial<AssistantToolContext> = {}) {
  const ctx: AssistantToolContext = { userId: 'u1', cookie: 'c=1', internalBase: 'http://x', ...extra };
  return createAssistantTools(ctx);
}

const searchTool = (list: ReturnType<typeof tools>) => list.find((t) => t.name === 'search_web')!;

beforeEach(() => {
  search.prepareWebSearch.mockReset();
  search.searchFreeChatWeb.mockReset();
});

describe('助理联网：一条消息只联网一次', () => {
  it('模型连续调用两次 search_web，只做一次搜索、只扣一次额度，两次拿到同一批资料', async () => {
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockResolvedValue(found);
    const list = tools();
    const first = await searchTool(list).run({ question: '国庆门店客流' });
    const second = await searchTool(list).run({ question: '国庆门店客流' });
    expect(search.prepareWebSearch).toHaveBeenCalledTimes(1);
    expect(search.searchFreeChatWeb).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first).toContain('资料全文 A');
  });

  it('新的一条消息（新的工具组）会重新联网，不沿用上一条的资料', async () => {
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockResolvedValue(found);
    await searchTool(tools()).run({ question: '一个问题' });
    await searchTool(tools()).run({ question: '另一个问题' });
    expect(search.prepareWebSearch).toHaveBeenCalledTimes(2);
  });
});

describe('助理联网：资料全文和引用要求交给模型', () => {
  it('资料全文不被 1500 字截断，工具结果上限放宽到 16000 字', async () => {
    const long = '资料'.repeat(4000);
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockResolvedValue({ ...found, context: long });
    const out = await searchTool(tools()).run({ question: '问题' });
    expect(out.startsWith(long)).toBe(true);
    expect(searchTool(tools()).maxResultChars).toBe(16000);
  });

  it('带上和自由对话同一套「联网资料使用要求」（只取资料段，不带长篇展开规则）', async () => {
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockResolvedValue(found);
    const out = await searchTool(tools()).run({ question: '问题' });
    expect(out).toContain(freeChatAnswerRules(true, { evidenceOnly: true }));
    expect(out).not.toContain('【本轮回答标准：详细展开】');
  });
});

describe('助理联网：质量反馈推给界面', () => {
  it('搜到了：状态 done，来源列表（标题和链接）推给界面', async () => {
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockResolvedValue(found);
    const seen: WebFeedback[] = [];
    await searchTool(tools({ onWeb: (f) => seen.push(f) })).run({ question: '问题' });
    expect(seen).toEqual([{ status: 'done', message: undefined, sources: [{ title: '国家统计局', url: 'https://www.stats.gov.cn/a' }] }]);
  });

  it('额度用完：状态 quota_exhausted，如实告诉模型没有联网，不编造来源', async () => {
    search.prepareWebSearch.mockResolvedValue({
      enabled: false,
      inputs: { web_search_note: '本期联网额度已用完，本轮未执行联网搜索。' },
      quota: { allowed: false, reason: 'quota_exhausted' },
    });
    const seen: WebFeedback[] = [];
    const out = await searchTool(tools({ onWeb: (f) => seen.push(f) })).run({ question: '问题' });
    expect(search.searchFreeChatWeb).not.toHaveBeenCalled();
    expect(seen[0].status).toBe('quota_exhausted');
    expect(out).toContain('本期联网额度已用完');
  });

  it('搜索服务出错：状态 unavailable，不让整条消息失败', async () => {
    search.prepareWebSearch.mockResolvedValue(granted());
    search.searchFreeChatWeb.mockRejectedValue(new Error('upstream down'));
    const seen: WebFeedback[] = [];
    const out = await searchTool(tools({ onWeb: (f) => seen.push(f) })).run({ question: '问题' });
    expect(seen[0].status).toBe('unavailable');
    expect(out).toContain('没有核实');
  });

  it('界面的任务卡会把来源渲染成可点的链接，并标明状态', () => {
    const widget = fs.readFileSync(path.join(process.cwd(), 'components/assistant/AssistantWidget.tsx'), 'utf8');
    expect(widget).toContain('target="_blank" rel="noopener noreferrer"');
    expect(widget).toContain('已联网核实');
    expect(widget).toContain('本期联网额度已用完');
    expect(widget).toMatch(/e\.type === "web"/);
  });
});
