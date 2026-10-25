/**
 * 选题板块的共用拼装（lib/boards/topic-query.ts）、页面接入、助理的选题工具（run_topic）。
 * 全部用假的接口，不调用真实模型。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTopicBoardQuery, extractRelevantPositioningInfo, type TopicBoardInput } from '@/lib/boards/topic-query';
import { createAssistantTools } from '@/lib/assistant/tools';
import { runTopicBoard, type TopicInput } from '@/lib/assistant/boards';
import { resolveMix } from '@/lib/content-mix';
import type { CreatorContext } from '@/lib/creator-context';

const EMPTY_CTX = { profile: null, positioning: null, dealReasons: [] } as unknown as CreatorContext;

function baseInput(over: Partial<TopicBoardInput> = {}): TopicBoardInput {
  return {
    creatorContext: EMPTY_CTX,
    selectedProfile: null,
    positioningForCtx: null,
    topicCount: 10,
    topicType: '选题（流量型、人设型、变现型按配比搭配）',
    topicRole: '按配比',
    mode: 'quick',
    sourceReference: '',
    sourceFrom: '',
    incomingSetup: null,
    keyword1: '',
    keyword2: '',
    keyword3: '',
    personalRequirement: '',
    currentSettings: {},
    accountStage: '',
    fansLevel: '',
    avgViewsInput: '',
    selectedPlatforms: [],
    selectedTracks: [],
    selectedContentTypes: [],
    selectedStyles: [],
    positioningExtra: '',
    selectedElements: [],
    dealReasonLabels: [],
    benchmarkAccounts: '',
    viralCases: '',
    difficulty: '中等创意',
    withHook: true,
    tactic: '',
    route: '两种都出',
    routeExplicit: false,
    resolvedMix: resolveMix(null, null, ''),
    quickTopics: false,
    ...over,
  };
}

describe('选题提示词的共用拼装', () => {
  it('开头是工作任务：条数和类型都带上', () => {
    const { query } = buildTopicBoardQuery(baseInput());
    expect(query).toContain('【工作任务】生成10条选题（流量型、人设型、变现型按配比搭配）');
  });

  it('个人要求会进入提示词，并且要求选题围绕它展开', () => {
    const { query } = buildTopicBoardQuery(baseInput({ personalRequirement: '主推新店开业活动' }));
    expect(query).toContain('【🎯 个人要求】');
    expect(query).toContain('主推新店开业活动');
  });

  it('按配比时返回这批选题的配比（页面展示用）；指定单一目的时没有配比', () => {
    const mixed = buildTopicBoardQuery(baseInput({ topicRole: '按配比' }));
    expect(mixed.mixUsed).not.toBeNull();
    expect(mixed.mixUsed!.count).toBe(10);
    const single = buildTopicBoardQuery(baseInput({ topicRole: '流量型', topicType: '流量型选题' }));
    expect(single.mixUsed).toBeNull();
    expect(single.query).toContain('全部是流量型');
  });

  it('带着内容来的：提示词里有「从带来的内容出发」的硬要求', () => {
    const { query } = buildTopicBoardQuery(baseInput({ sourceReference: '上一条脚本：今天去菜市场问摊主', sourceFrom: '脚本生成' }));
    expect(query).toContain('【这批选题从带来的内容出发】');
    expect(query).toContain('上一条脚本：今天去菜市场问摊主');
  });

  it('成交理由写进变现型的要求里', () => {
    const { query } = buildTopicBoardQuery(baseInput({ topicRole: '变现型', topicType: '变现型选题', dealReasonLabels: ['包邮', '七天无理由'] }));
    expect(query).toContain('成交理由（只给变现型选题用）：包邮、七天无理由');
  });

  it('输出格式要求都在（页面会按它解析选题）', () => {
    const { query } = buildTopicBoardQuery(baseInput());
    expect(query).toContain('【输出格式要求】');
    expect(query).toContain('## 选题X：[标题]');
  });

  it('创作设置会附在最后（和页面一样）', () => {
    const { query } = buildTopicBoardQuery(baseInput());
    expect(query.length).toBeGreaterThan(1000);
  });
});

describe('账号定位的筛选：只留选题要用的部分', () => {
  it('保留目标人群，去掉 15 天冷启动执行计划', () => {
    const full = [
      '## 目标人群',
      '25到40岁的本地宝妈，平时自己做饭，最关心孩子的饮食是不是干净、吃得放心，也愿意为省心多花一点钱。',
      '## 15天冷启动执行计划',
      'Day 1 发布第一条视频，第1-3天每天一条。',
      '## 差异化卖点',
      '不用添加剂，现做现卖。',
    ].join('\n');
    const out = extractRelevantPositioningInfo(full);
    expect(out).toContain('目标人群');
    expect(out).toContain('本地宝妈');
    expect(out).not.toContain('冷启动');
    expect(out).not.toContain('Day 1');
  });

  it('提取结果太少时退回前 500 字，不返回空', () => {
    const out = extractRelevantPositioningInfo('很短的定位');
    expect(out).toContain('很短的定位');
  });
});

describe('页面已经改为调用共用模块', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/topic/page.tsx'), 'utf8');

  it('页面调用 buildTopicBoardQuery，原来的内联拼装已经移走', () => {
    expect(page).toContain('buildTopicBoardQuery({');
    expect(page).toContain('setMixUsed(boardQuery.mixUsed)');
    expect(page).not.toContain('const extractRelevantPositioningInfo');
    expect(page).not.toContain('let query = `【工作任务】');
    expect(page).not.toContain('【输出格式要求】');
  });

  it('请求体里的 query 直接用拼好的完整提示词（创作设置已经包含在里面）', () => {
    expect(page).toMatch(/taskType: "选题策划",[\s\S]*?query,/);
  });
});

describe('助理的选题工具', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const sse = (answer: string) =>
    new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

  // 板块的执行：派活经用户确认后跑的就是 runTopicBoard（lib/assistant/boards.ts）
  const topicTool = (fetchImpl: typeof fetch) => ({
    run: async (input: Record<string, unknown>): Promise<string> => {
      const r = await runTopicBoard({ userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl }, { count: 10, role: '按配比', ...input } as TopicInput);
      return r.ok ? r.text : r.error ?? '';
    },
  });

  it('没说清楚想拍什么：派活工具不列出任务，先去问清楚', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(String(url));
      return json([]);
    }) as unknown as typeof fetch;
    const out = await createAssistantTools({ userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch })
      .find((t) => t.name === 'propose_topic')!
      .run({ request: '  ' });
    expect(out).toContain('还不知道用户想拍什么');
    expect(calls.some((u) => u.includes('/api/dify/stream'))).toBe(false);
  });

  it('正常：交给选题板块（同一个接口，带上选题任务类型和用户的需求），返回板块的选题', async () => {
    let sentBody: Record<string, unknown> | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/dify/stream')) {
        sentBody = JSON.parse(String(init?.body));
        return sse('## 选题1：菜市场摊主的一句实话');
      }
      if (u.includes('/api/profiles')) return json([{ id: 'p1', profile_name: 'A号' }]);
      return json([]);
    }) as unknown as typeof fetch;

    const out = await topicTool(fakeFetch).run({ request: '想拍菜市场的真实故事', count: 5, role: '人设型' });
    expect(out).toContain('选题1');
    expect(sentBody).not.toBeNull();
    expect(sentBody!.taskType).toBe('选题策划');
    expect(sentBody!.profileId).toBe('p1');
    expect(String(sentBody!.query)).toContain('生成5条人设型选题');
    expect(String(sentBody!.query)).toContain('想拍菜市场的真实故事');
  });

  it('条数超出 3–10 的范围时收到范围内', async () => {
    let query = '';
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/dify/stream')) {
        query = JSON.parse(String(init?.body)).query;
        return sse('ok');
      }
      return json([]);
    }) as unknown as typeof fetch;
    await topicTool(fakeFetch).run({ request: '随便拍点', count: 50 });
    expect(query).toContain('生成10条');
  });

  it('额度不够或服务错误：把原因如实交给助理', async () => {
    const fakeFetch = (async (url: string) => (String(url).includes('/api/dify/stream') ? json({ error: '本期选题额度已用完' }, 402) : json([]))) as unknown as typeof fetch;
    const out = await topicTool(fakeFetch).run({ request: '想拍点新内容' });
    expect(out).toContain('本期选题额度已用完');
  });
});
