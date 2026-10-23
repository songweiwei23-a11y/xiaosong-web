/**
 * 脚本板块的共用拼装（lib/boards/script-query.ts）和页面接入。
 * 全部是纯函数和源码检查，不调用真实模型。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildScriptBoardQuery, type ScriptBoardInput } from '@/lib/boards/script-query';
import { creationSettingsBlock, type CreationSettings } from '@/lib/creation-settings';
import { createAssistantTools } from '@/lib/assistant/tools';
import { runScriptBoard, type ScriptInput } from '@/lib/assistant/boards';

const SETTINGS = { purpose: '流量型', audience: '实体店老板' } as unknown as CreationSettings;

function baseInput(over: Partial<ScriptBoardInput> = {}): ScriptBoardInput {
  return {
    topic: '门店节前节后对比',
    platform: '抖音',
    scriptType: 'teach',
    autoScriptType: false,
    effectiveRole: '流量型',
    isAd: false,
    industry: '本地服务',
    customIndustry: '',
    targetGroup: '实体店老板',
    customTargetGroup: '',
    style: '朴素',
    customStyle: '',
    durationMode: 'ai',
    duration: '60秒',
    customDuration: '',
    profile: null,
    positioningContent: null,
    scriptStructure: 'auto',
    hookType: 'auto',
    boomElements: [],
    directorThoughts: [],
    tactic: 'AI推荐',
    openingLine: '',
    openingCard: '',
    productInfo: '',
    priceInfo: '',
    scene: '室内',
    device: '手机',
    budget: '低成本(0-500)',
    personnel: '一人',
    accountPositioning: '',
    additionalInfo: '',
    dealReasons: [],
    originContent: '',
    focusContent: '',
    currentSettings: SETTINGS,
    ...over,
  };
}

describe('脚本提示词的共用拼装', () => {
  it('非广告：走自动脚本生成器，主题带进去', () => {
    const q = buildScriptBoardQuery(baseInput());
    expect(q).toContain('门店节前节后对比');
    expect(q).not.toContain('# 广告引流短视频脚本生成');
  });

  it('广告引流且已选类型：走广告模板，类型名和成交理由都在', () => {
    const q = buildScriptBoardQuery(baseInput({ isAd: true, scriptType: 'ad_lead', dealReasons: ['price'] }));
    expect(q).toContain('# 广告引流短视频脚本生成');
    expect(q).toContain('**广告类型**：留资获客');
    expect(q).toContain('价格优势');
  });

  it('广告引流但没选类型：交给自动生成器，不走广告模板', () => {
    const q = buildScriptBoardQuery(baseInput({ isAd: true, scriptType: 'ad_lead', autoScriptType: true }));
    expect(q).not.toContain('# 广告引流短视频脚本生成');
    expect(q).toContain('门店节前节后对比');
  });

  it('没选档案和定位：不带档案段和定位参考', () => {
    const q = buildScriptBoardQuery(baseInput());
    expect(q).not.toContain('【账号定位-脚本创作参考】');
  });

  it('选了定位：定位的脚本参考进入提示词', () => {
    const q = buildScriptBoardQuery(baseInput({ positioningContent: '## 目标人群\n本地实体店老板，想知道节假日生意变化。' }));
    expect(q).toContain('【账号定位-脚本创作参考】');
  });

  it('补充要求和原文都进入提示词，焦点内容作为源材料', () => {
    const q = buildScriptBoardQuery(baseInput({
      additionalInfo: '只换开头，正文不改',
      originContent: '上一条：今天去菜市场问摊主',
      focusContent: '这次想聊摊主的真实感受',
    }));
    expect(q).toContain('只换开头，正文不改');
    expect(q).toContain('上一条：今天去菜市场问摊主');
    expect(q).toContain('这次想聊摊主的真实感受');
  });

  it('选定的开头：广告模板用开头段锁死第一句；自动生成器靠创作设置里的 openingLine（页面就是这样传的）', () => {
    const opening = '国庆前后，这条街上的生意到底有什么变化？';
    const ad = buildScriptBoardQuery(baseInput({ isAd: true, scriptType: 'ad_lead', openingLine: opening }));
    expect(ad).toContain('开头已经定了，必须用这一句');
    expect(ad).toContain(opening);
    const auto = buildScriptBoardQuery(baseInput({ openingLine: opening, currentSettings: { ...SETTINGS, openingLine: opening } as unknown as CreationSettings }));
    expect(auto).toContain(opening);
  });

  it('创作设置附在最后（页面和助理都是这个顺序）', () => {
    const q = buildScriptBoardQuery(baseInput());
    expect(q.endsWith(creationSettingsBlock(SETTINGS))).toBe(true);
  });
});

describe('页面已经改为调用共用模块', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/script/page.tsx'), 'utf8');
  const board = fs.readFileSync(path.join(process.cwd(), 'lib/boards/script-query.ts'), 'utf8');

  it('页面调用 buildScriptBoardQuery，原来的内联拼装已经移走', () => {
    expect(page).toContain('buildScriptBoardQuery({');
    expect(page).toContain('isAd: activeTab === "ad"');
    expect(page).not.toContain('buildAdaptiveScriptPrompt(');
    expect(page).not.toContain('# 广告引流短视频脚本生成');
    expect(page).not.toContain('let profileInfo');
    expect(page).not.toContain('const formulaSection');
  });

  it('请求体里的 query 直接用拼好的提示词，续写和自动目的的后缀仍由页面追加', () => {
    expect(page).toMatch(/taskType: "脚本生成",[\s\S]*?query: query \+ \(originContent/);
    expect(page).not.toMatch(/query: query \+ creationSettingsBlock/);
  });

  it('共用模块返回的提示词已经带上创作设置', () => {
    expect(board).toContain('return query + creationSettingsBlock(currentSettings);');
  });

  it('共用模块不依赖页面的状态变量', () => {
    expect(board).not.toContain('selectedProfileId');
    expect(board).not.toContain('autoSetup.');
    expect(board).not.toContain('setState');
  });
});

describe('助理的脚本工具', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const sse = (answer: string) =>
    new Response(`data: ${JSON.stringify({ event: 'message', answer })}\n\ndata: ${JSON.stringify({ event: 'message_end' })}\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

  // 板块的执行：派活经用户确认后跑的就是 runScriptBoard（lib/assistant/boards.ts）
  const scriptTool = (fetchImpl: typeof fetch) => ({
    run: async (input: Record<string, unknown>): Promise<string> => {
      const r = await runScriptBoard({ userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl }, input as unknown as ScriptInput);
      return r.ok ? r.text : r.error ?? '';
    },
  });

  it('没说清楚要拍什么：派活工具不列出任务，先去问清楚', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(String(url));
      return json([]);
    }) as unknown as typeof fetch;
    const out = await createAssistantTools({ userId: 'u1', cookie: 'c=1', profileId: 'p1', internalBase: 'http://x', fetchImpl: fakeFetch })
      .find((t) => t.name === 'propose_script')!
      .run({ request: '  ' });
    expect(out).toContain('还不知道用户想拍什么');
    expect(calls.some((u) => u.includes('/api/dify/stream'))).toBe(false);
  });

  it('正常：交给脚本板块（同一个接口、脚本任务类型），带上账号档案和拍摄需求，返回脚本', async () => {
    let sentBody: Record<string, unknown> | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/dify/stream')) {
        sentBody = JSON.parse(String(init?.body));
        return sse('【开场钩子】0-8秒：门店门口的人少了一半');
      }
      if (u.includes('/api/profiles')) return json([{ id: 'p1', profile_name: 'A号' }]);
      return json([]);
    }) as unknown as typeof fetch;

    const out = await scriptTool(fakeFetch).run({ request: '节前节后门店生意对比', role: '人设型' });
    expect(out).toContain('开场钩子');
    expect(sentBody).not.toBeNull();
    expect(sentBody!.taskType).toBe('脚本生成');
    expect(sentBody!.profileId).toBe('p1');
    expect(String(sentBody!.query)).toContain('节前节后门店生意对比');
    expect(String(sentBody!.query).endsWith(creationSettingsBlock((sentBody!.creationSettings ?? {}) as CreationSettings))).toBe(true);
  });

  it('目的没填或填了别的：按脚本类型的默认目的，不报错', async () => {
    let sentBody: Record<string, unknown> | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/dify/stream')) {
        sentBody = JSON.parse(String(init?.body));
        return sse('ok');
      }
      return json([]);
    }) as unknown as typeof fetch;
    await scriptTool(fakeFetch).run({ request: '随便拍点', role: '随便写的' });
    expect(sentBody).not.toBeNull();
    expect(String(sentBody!.query)).toContain('随便拍点');
  });

  it('额度不够或服务错误：把原因如实交给助理', async () => {
    const fakeFetch = (async (url: string) => (String(url).includes('/api/dify/stream') ? json({ error: '本期脚本额度已用完' }, 402) : json([]))) as unknown as typeof fetch;
    const out = await scriptTool(fakeFetch).run({ request: '想拍点新内容' });
    expect(out).toContain('本期脚本额度已用完');
  });

  it('助理的系统提示不再说「还不能直接生成脚本」，并告诉它用 propose_script 派活', async () => {
    const run = fs.readFileSync(path.join(process.cwd(), 'lib/assistant/run.ts'), 'utf8');
    expect(run).toContain('propose_script');
    expect(run).not.toContain('你现在还不能直接生成');
  });
});
