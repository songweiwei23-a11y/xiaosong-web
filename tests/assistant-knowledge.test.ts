/**
 * 助理查编导知识库（2026-10-21）：检索结果怎么合并、额度怎么预留和结算（每轮一次）、
 * 失败或没查到时怎么如实告诉模型，以及对话进行中不能切换对话的守卫。
 * Dify 的网络请求和额度都用假的，不碰真实知识库和真实额度。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const quota = vi.hoisted(() => ({
  reserveCreation: vi.fn(),
  settleCreation: vi.fn(),
  releaseCreation: vi.fn(),
}));
vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: quota.reserveCreation,
  settleCreation: quota.settleCreation,
  releaseCreation: quota.releaseCreation,
}));

import { createAssistantTools } from '@/lib/assistant/tools';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';
import {
  KNOWLEDGE_HIT_CHARS,
  knowledgeResultText,
  readKnowledgeConfig,
  resetKnowledgeCache,
  searchKnowledge,
} from '@/lib/assistant/knowledge';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const CFG = { base: 'https://dify.test/v1', key: 'dataset-test-key' };
const rec = (doc: string, content: string, score: number) => ({ score, segment: { content, document: { name: doc } } });

/** 假的 Dify：数据集列表、每个库的检索结果（'fail' 表示这个接口报错） */
function fakeDify(datasets: { id: string; name: string }[] | 'fail', retrieve: Record<string, unknown>) {
  const calls: { method: string; endpoint: string; body: { query?: string } | undefined }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const endpoint = url.replace(CFG.base, '');
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { query?: string }) : undefined;
    calls.push({ method: init?.method ?? 'GET', endpoint, body });
    if (endpoint.startsWith('/datasets?')) {
      return datasets === 'fail' ? new Response('boom', { status: 500 }) : Response.json({ data: datasets });
    }
    const id = endpoint.match(/^\/datasets\/([^/]+)\/retrieve$/)?.[1];
    const out = id ? retrieve[id] : undefined;
    if (out === undefined || out === 'fail') return new Response('boom', { status: 500 });
    return Response.json(out);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const granted = { ok: true, reservation: { userId: 'u1', requestId: 'req-1', feature: 'knowledge' } };

function searchTool() {
  const list = createAssistantTools({ userId: 'u1', cookie: 'c=1', internalBase: 'http://x' });
  return list.find((t) => t.name === 'search_knowledge')!;
}

const savedKey = process.env.DIFY_DATASET_API_KEY;
const savedBase = process.env.DIFY_BASE_URL;

beforeEach(() => {
  resetKnowledgeCache();
  quota.reserveCreation.mockReset();
  quota.settleCreation.mockReset().mockResolvedValue(undefined);
  quota.releaseCreation.mockReset().mockResolvedValue(undefined);
  process.env.DIFY_DATASET_API_KEY = CFG.key;
  process.env.DIFY_BASE_URL = CFG.base;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (savedKey === undefined) delete process.env.DIFY_DATASET_API_KEY;
  else process.env.DIFY_DATASET_API_KEY = savedKey;
  if (savedBase === undefined) delete process.env.DIFY_BASE_URL;
  else process.env.DIFY_BASE_URL = savedBase;
});

describe('检索：合并、去重、排序', () => {
  it('没有配置密钥：返回 null，一个请求都不发', async () => {
    const { fetchImpl, calls } = fakeDify([], {});
    expect(await searchKnowledge('开篇怎么写', { fetchImpl, config: null })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('密钥必须是 dataset- 开头（应用密钥不能用来查知识库）', () => {
    process.env.DIFY_DATASET_API_KEY = 'app-不是知识库的密钥';
    expect(readKnowledgeConfig()).toBeNull();
    process.env.DIFY_DATASET_API_KEY = 'dataset-abc';
    expect(readKnowledgeConfig()?.key).toBe('dataset-abc');
  });

  it('多个库合并：按相关度排，同一段只留一条，带上资料名，没有分数的排在最后', async () => {
    const { fetchImpl, calls } = fakeDify(
      [{ id: 'a', name: '定位与选题库' }, { id: 'b', name: '脚本与文案库' }],
      {
        a: { records: [rec('起号36计', '开篇要在三秒内抛出期待', 0.7), rec('拍摄笔记', '无关的拍摄内容', 0)] },
        b: { records: [rec('开篇36计', '开篇要在三秒内抛出期待', 0.7), rec('脚本结构', '脚本按总分总展开', 0.6)] },
      },
    );
    const hits = await searchKnowledge('开篇怎么抓人', { fetchImpl, config: CFG });
    expect(hits!.map((h) => h.doc)).toEqual(['起号36计', '脚本结构', '拍摄笔记']);
    // 每个库都收到同一个问题
    const retrieves = calls.filter((c) => c.endpoint.endsWith('/retrieve'));
    expect(retrieves).toHaveLength(2);
    expect(retrieves.every((c) => c.body?.query === '开篇怎么抓人')).toBe(true);
  });

  it('某一个库报错，其他库照常返回', async () => {
    const { fetchImpl } = fakeDify(
      [{ id: 'a', name: '坏掉的库' }, { id: 'b', name: '脚本与文案库' }],
      { a: 'fail', b: { records: [rec('脚本结构', '脚本按总分总展开', 0.6)] } },
    );
    const hits = await searchKnowledge('脚本怎么写', { fetchImpl, config: CFG });
    expect(hits!.map((h) => h.doc)).toEqual(['脚本结构']);
  });

  it('所有库都报错：返回 null（不是「没有资料」，调用方要如实说查不到）', async () => {
    const { fetchImpl } = fakeDify([{ id: 'a', name: '库A' }, { id: 'b', name: '库B' }], { a: 'fail', b: 'fail' });
    expect(await searchKnowledge('脚本怎么写', { fetchImpl, config: CFG })).toBeNull();
  });

  it('数据集列表读不出来：返回 null，而且不缓存失败结果，下次会重新读', async () => {
    const bad = fakeDify('fail', {});
    expect(await searchKnowledge('问', { fetchImpl: bad.fetchImpl, config: CFG })).toBeNull();
    // 分数要过相关度门槛（0.58），这里只测「失败不缓存」，分数随便给一个够高的
    const good = fakeDify([{ id: 'a', name: '库A' }], { a: { records: [rec('开篇36计', '开篇内容', 0.7)] } });
    const hits = await searchKnowledge('问', { fetchImpl: good.fetchImpl, config: CFG });
    expect(hits!.map((h) => h.doc)).toEqual(['开篇36计']);
  });

  it('数据集列表 10 分钟内只读一次，之后直接用缓存', async () => {
    const { fetchImpl, calls } = fakeDify([{ id: 'a', name: '库A' }], { a: { records: [] } });
    await searchKnowledge('问一', { fetchImpl, config: CFG });
    await searchKnowledge('问二', { fetchImpl, config: CFG });
    expect(calls.filter((c) => c.endpoint.startsWith('/datasets?'))).toHaveLength(1);
  });

  it('问题超过 200 字截断；空白的问题不查', async () => {
    const { fetchImpl, calls } = fakeDify([{ id: 'a', name: '库A' }], { a: { records: [] } });
    await searchKnowledge('问'.repeat(300), { fetchImpl, config: CFG });
    const sent = calls.find((c) => c.endpoint.endsWith('/retrieve'))?.body?.query ?? '';
    expect(sent.length).toBe(200);
    expect(await searchKnowledge('   ', { fetchImpl, config: CFG })).toEqual([]);
    expect(calls.filter((c) => c.endpoint.endsWith('/retrieve'))).toHaveLength(1);
  });
});

describe('给模型看的资料文本', () => {
  it('每段标明出处；超长的段落截到上限', () => {
    const text = knowledgeResultText([{ doc: '开篇36计', content: 'x'.repeat(2000), score: 0.5 }]);
    expect(text).toContain('【资料 1】来源：《开篇36计》');
    expect(text).toContain('x'.repeat(KNOWLEDGE_HIT_CHARS));
    expect(text).not.toContain('x'.repeat(KNOWLEDGE_HIT_CHARS + 1));
    expect(text).toContain('与问题无关的资料不要硬套');
  });
});

describe('工具：每轮一次，计入「知识库查询」额度', () => {
  it('工具的基本信息：名字、结果上限、必须有问题', () => {
    const t = searchTool();
    expect(t.name).toBe('search_knowledge');
    expect(t.maxResultChars).toBe(8000);
    expect(t.input_schema.required).toEqual(['question']);
  });

  it('同一轮连续调用两次：只预留一次、只查一次，两次拿到同一份资料，成功后按「知识库查询」结算', async () => {
    quota.reserveCreation.mockResolvedValue(granted);
    const { fetchImpl, calls } = fakeDify([{ id: 'a', name: '库A' }], { a: { records: [rec('开篇36计', '开篇要在三秒内抛出期待', 0.7)] } });
    vi.stubGlobal('fetch', fetchImpl);
    const t = searchTool();
    const first = await t.run({ question: '开篇怎么抓人' });
    const second = await t.run({ question: '开篇怎么抓人' });
    expect(quota.reserveCreation).toHaveBeenCalledTimes(1);
    expect(quota.reserveCreation.mock.calls[0][1]).toBe('knowledge');
    expect(calls.filter((c) => c.endpoint.endsWith('/retrieve'))).toHaveLength(1);
    expect(first).toBe(second);
    expect(first).toContain('《开篇36计》');
    expect(quota.settleCreation).toHaveBeenCalledWith(granted.reservation, true, '知识库查询');
    expect(quota.releaseCreation).not.toHaveBeenCalled();
  });

  it('新的一条消息（新的工具组）会重新查，不沿用上一条的资料', async () => {
    quota.reserveCreation.mockResolvedValue(granted);
    const { fetchImpl } = fakeDify([{ id: 'a', name: '库A' }], { a: { records: [rec('开篇36计', '开篇内容', 0.7)] } });
    vi.stubGlobal('fetch', fetchImpl);
    await searchTool().run({ question: '问一' });
    await searchTool().run({ question: '问二' });
    expect(quota.reserveCreation).toHaveBeenCalledTimes(2);
  });

  it('额度用完（402）：不去查，如实告诉模型这次没有查知识库', async () => {
    quota.reserveCreation.mockResolvedValue({ ok: false, response: new Response(null, { status: 402 }) });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const out = await searchTool().run({ question: '开篇怎么抓人' });
    expect(out).toContain('次数已用完');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('额度暂时无法确认（503）：也不查，按没查到处理', async () => {
    quota.reserveCreation.mockResolvedValue({ ok: false, response: new Response(null, { status: 503 }) });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const out = await searchTool().run({ question: '开篇怎么抓人' });
    expect(out).toContain('没有查到结果');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('知识库没有接通：工具不出现在列表里（模型不会去查），也不预留额度', () => {
    delete process.env.DIFY_DATASET_API_KEY;
    const names = createAssistantTools({ userId: 'u1', cookie: 'c=1', internalBase: 'http://x' }).map((t) => t.name);
    expect(names).not.toContain('search_knowledge');
    expect(quota.reserveCreation).not.toHaveBeenCalled();
  });

  it('接通了：工具出现在列表里', () => {
    const names = createAssistantTools({ userId: 'u1', cookie: 'c=1', internalBase: 'http://x' }).map((t) => t.name);
    expect(names).toContain('search_knowledge');
  });

  it('工具拿到之后知识库断开：不预留额度，如实说没查到', async () => {
    const t = searchTool();
    delete process.env.DIFY_DATASET_API_KEY;
    expect(await t.run({ question: '开篇怎么抓人' })).toContain('没有查到结果');
    expect(quota.reserveCreation).not.toHaveBeenCalled();
  });

  it('查询失败（列表读不出来，或网络直接报错）：释放预留，不扣额度', async () => {
    quota.reserveCreation.mockResolvedValue(granted);
    vi.stubGlobal('fetch', fakeDify('fail', {}).fetchImpl);
    expect(await searchTool().run({ question: '问一' })).toContain('没有查到结果');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('超时'); }));
    resetKnowledgeCache();
    expect(await searchTool().run({ question: '问二' })).toContain('没有查到结果');
    expect(quota.releaseCreation).toHaveBeenCalledTimes(2);
    expect(quota.settleCreation).not.toHaveBeenCalled();
  });

  it('查到了但没有相关资料：查询本身成功，照常结算，并如实说没有相关资料', async () => {
    quota.reserveCreation.mockResolvedValue(granted);
    vi.stubGlobal('fetch', fakeDify([], {}).fetchImpl);
    const out = await searchTool().run({ question: '今天天气怎么样' });
    expect(out).toContain('没有和这个问题相关的资料');
    expect(quota.settleCreation).toHaveBeenCalledWith(granted.reservation, true, '知识库查询');
  });

  it('问题是空的：直接说缺少问题，不预留额度', async () => {
    const out = await searchTool().run({ question: '   ' });
    expect(out).toBe('缺少要查的问题');
    expect(quota.reserveCreation).not.toHaveBeenCalled();
  });
});

describe('接线与安全', () => {
  it('系统提示告诉助理什么时候查知识库，查不到不能说成知识库的内容', () => {
    expect(ASSISTANT_SYSTEM).toContain('search_knowledge');
    expect(ASSISTANT_SYSTEM).toContain('不能说成知识库的内容');
    expect(ASSISTANT_SYSTEM).toContain('账号情况、待办、额度不用查知识库');
  });

  it('没接通时系统提示加上说明，不让模型说自己查过知识库', () => {
    expect(read('lib/assistant/run.ts')).toContain("knowledgeConfigured() ? '' : KNOWLEDGE_OFF_NOTE");
  });

  it('工具用的是知识库额度；知识库检索不走自由对话接口；密钥不写进代码', () => {
    const tools = read('lib/assistant/tools.ts');
    expect(tools).toContain("reserveCreation(ctx.userId, 'knowledge'");
    expect(tools).toContain("settleCreation(reserved.reservation, true, '知识库查询')");
    const knowledge = read('lib/assistant/knowledge.ts');
    expect(knowledge).not.toMatch(/['"`]\/api\/dify\/chat/);
    expect(knowledge).not.toMatch(/['"`]dataset-[A-Za-z0-9]{6,}/);
  });
});

describe('对话进行中不能切换或新建对话', () => {
  it('新对话按钮在回答中禁用；打开历史、新建、删除当前对话时都有守卫', () => {
    const src = read('components/assistant/AssistantWidget.tsx');
    expect(src).toContain('<HeaderButton label="新对话" disabled={busy} onClick={newConversation}>');
    expect(src.match(/if \(busy\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('if (busy && id === threadId) return setNotice(BUSY_NOTICE);');
    expect(src).toContain('const BUSY_NOTICE');
  });
});
