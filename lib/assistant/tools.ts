import { prepareWebSearch } from '@/lib/web-search-quota';
import { searchFreeChatWeb } from '@/lib/free-chat-web';
import { freeChatAnswerRules } from '@/lib/free-chat-answer';
import { releaseCreation, reserveCreation, settleCreation } from '@/lib/creation-quota';
import { knowledgeConfigured, knowledgeResultText, searchKnowledge } from '@/lib/assistant/knowledge';
import { AMBIENT_SOUNDS } from '@/lib/ambient/synth';
import { addMemory, listMemories, updateMemory } from '@/lib/assistant/memory-store';
import { MEMORY_MAX_COUNT } from '@/lib/assistant/memory';
import { clampMinutes, resolveSound, soundChoices } from '@/lib/assistant/client-action-spec';
import { buildReviewBoardQuery, reviewCreationSettings } from '@/lib/boards/review-query';
import { buildTopicBoardQuery, topicCreationSettings } from '@/lib/boards/topic-query';
import { buildScriptBoardQuery, SCRIPT_PAGE_DEFAULTS, scriptCreationSettings, scriptMemoryPatch, scriptResultWithQuality } from '@/lib/boards/script-query';
import { resolveMix } from '@/lib/content-mix';
import { tacticInText, type CreativeRoute } from '@/lib/creative-routes';
import { defaultRoleOfScriptType, type ContentRole } from '@/lib/content-roles';
import type { MemoryDefaults } from '@/lib/settings-memory';
import { AI_DURATION } from '@/lib/review-standards';
import { readDifyStream } from '@/lib/sse-stream';
import type { AssistantTool, WebFeedback } from './agent';
import { loadBoardContext } from './board-context';

/**
 * 助理能用的工具。每个工具都只是包装现有的能力，不另起一套：
 *   read_account  读档案、定位、进行中的作品（走现有接口，权限和隔离沿用原来的）
 *   read_quota    读额度（走现有接口）
 *   search_web    联网查热点、新闻（走现有的联网搜索，扣联网额度）
 *   search_knowledge  查编导知识库里的方法论（走知识库检索，扣知识库查询额度）
 *
 *   run_review    把稿子交给审稿板块（走 /api/dify/stream，和审稿页面同一个接口）
 *   run_topic     把选题需求交给选题板块（同上）
 *   run_script    把拍摄需求交给脚本板块（同上）
 *
 * 注意：这里刻意不调用自由对话接口 /api/dify/chat。它扣的是「自由对话」额度，而助理对话本身已经扣过一次，
 * 再经它调用就会重复扣。板块接口 /api/dify/stream 扣的是板块自己的额度，这是正常的：
 * 助理对话扣 1 次自由对话，它调用的板块各自按原来的规则扣。
 */

export interface AssistantToolContext {
  userId: string;
  /** 用户自己的 Cookie，内部读取接口靠它认人 */
  cookie: string;
  /** 用户当前选中的账号档案（浏览器里的选择，由界面带过来）；没有就用第一个 */
  profileId?: string | null;
  /** 用户有没有开「记忆预填」（页面上默认开着；关了就不按上次的习惯填）。不传按开着处理 */
  memoryOn?: boolean;
  /** 板块跑完存历史用。不传就走页面用的那些保存接口（用户的 Cookie 认人）；测试时可以替换 */
  saveHistory?: (row: BoardHistoryRow) => Promise<void>;
  /** 联网这一轮的质量反馈（状态、来源）推给界面，用户能看到每条结论依据哪些来源 */
  onWeb?: (feedback: WebFeedback) => void;
  /** 要在页面上替用户做的事（播放声音等），由界面执行；见 lib/assistant/client-action-spec */
  onAction?: (action: { name: string; args: Record<string, unknown> }) => void;
  /** 默认 http://127.0.0.1:端口，测试时可以替换 */
  internalBase?: string;
  fetchImpl?: typeof fetch;
}

const TRUNC = 1500;

function internalBase(ctx: AssistantToolContext): string {
  return ctx.internalBase ?? process.env.ASSISTANT_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT || 3000}`;
}

async function readInternal(ctx: AssistantToolContext, path: string): Promise<unknown> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(`${internalBase(ctx)}${path}`, {
    headers: { cookie: ctx.cookie },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`读取 ${path.split('?')[0]} 失败（${res.status}）`);
  return res.json();
}

/**
 * 脚本页面打开时会读「设置记忆」按上次的习惯预填（同一个接口、同一个 scope）。读不到就不预填，和页面一样。
 */
async function readScriptMemory(ctx: AssistantToolContext, profileId: string | null): Promise<MemoryDefaults | null> {
  try {
    const scope = profileId || 'default';
    const data = (await readInternal(ctx, `/api/settings-memory?board=script&profileId=${encodeURIComponent(scope)}`)) as {
      defaults?: MemoryDefaults;
      summary?: string;
    } | null;
    return data?.defaults && data.summary ? data.defaults : null;
  } catch {
    return null;
  }
}

/** 板块跑完存进历史的一条，字段和页面各自保存时写的一样 */
export interface BoardHistoryRow {
  taskType: '选题策划' | '脚本生成' | '审稿优化';
  inputData: Record<string, unknown>;
  result: string;
}

/**
 * 板块的产出存进用户自己的历史记录，和页面用的是同一批保存接口（用户的 Cookie 认人，权限沿用）。
 * 选题走 /api/topics，脚本和审稿走 /api/script-history。存失败不影响助理给出的结果。
 */
async function saveBoardHistory(ctx: AssistantToolContext, row: BoardHistoryRow): Promise<void> {
  try {
    if (ctx.saveHistory) {
      await ctx.saveHistory(row);
      return;
    }
    const doFetch = ctx.fetchImpl ?? fetch;
    const isTopic = row.taskType === '选题策划';
    await doFetch(`${internalBase(ctx)}${isTopic ? '/api/topics' : '/api/script-history'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify(isTopic
        ? { input_data: row.inputData, result: row.result }
        : { input_data: row.inputData, result: row.result, task_type: row.taskType }),
      cache: 'no-store',
    });
  } catch {
    // 存失败不影响结果
  }
}

const KNOWLEDGE_DOWN =
  '编导知识库这次没有查到结果。请如实告诉用户这次没有查知识库，可以按一般经验回答，但要说明不是来自知识库，不编造资料来源。';
const KNOWLEDGE_EXHAUSTED =
  '本期「知识库查询」次数已用完。请如实告诉用户这次没有查知识库，可以按一般经验回答，但要说明不是来自知识库，不编造资料来源。';
const KNOWLEDGE_NONE =
  '编导知识库里没有和这个问题相关的资料。请如实告诉用户，可以按一般经验回答，但不能说成来自知识库。';

const clip = (s: unknown) =>(typeof s === 'string' ? s.slice(0, TRUNC) : '');
/** 板块的产出（选题、审稿意见）比读取类的信息长得多，单独放宽 */
const BOARD_TRUNC = 6000;
const boardClip = (s: string) => (s.length > BOARD_TRUNC ? `${s.slice(0, BOARD_TRUNC)}\n…（内容太长，已截断）` : s);

export function createAssistantTools(ctx: AssistantToolContext): AssistantTool[] {
  /** 这一轮（一条消息）的联网资料：只查一次、只扣一次联网额度，之后的 search_web 调用都用同一份（和自由对话一致） */
  let webRound: Promise<string> | null = null;
  /** 这一轮（一条消息）的知识库检索：只查一次、只扣一次额度，之后的 search_knowledge 调用都用同一份（和联网一致） */
  let knowledgeRound: Promise<string> | null = null;
  const runKnowledgeSearch = async (question: string): Promise<string> => {
    if (!knowledgeConfigured()) return KNOWLEDGE_DOWN;
    // 和知识库板块一样扣「知识库查询」额度：先预留，查到了才结算，没查到就释放
    const reserved = await reserveCreation(ctx.userId, 'knowledge', new Request('http://localhost/api/assistant'), { assistant: true, question });
    if (!reserved.ok) return reserved.response.status === 402 ? KNOWLEDGE_EXHAUSTED : KNOWLEDGE_DOWN;
    const hits = await searchKnowledge(question).catch(() => null);
    if (!hits) {
      await releaseCreation(reserved.reservation);
      return KNOWLEDGE_DOWN;
    }
    await settleCreation(reserved.reservation, true, '知识库查询').catch((error) => {
      console.error('[assistant] 知识库额度结算没有完成，预占保留到过期', error instanceof Error ? error.message : error);
    });
    return hits.length ? knowledgeResultText(hits) : KNOWLEDGE_NONE;
  };

  const runWebSearch = async (question: string): Promise<string> => {
    try {
      const web = await prepareWebSearch(ctx.userId, question, 'on');
      if (!web.enabled) {
        const exhausted = web.quota?.reason === 'quota_exhausted' || web.quota?.reason === 'membership_expired';
        const note = String(web.inputs.web_search_note);
        ctx.onWeb?.({ status: exhausted ? 'quota_exhausted' : 'unavailable', message: note, sources: [] });
        return `${note}${freeChatAnswerRules(false, { evidenceOnly: true })}`;
      }
      // 真正发起付费搜索前才确认扣费（没有可用的搜索服务时不会调用，也就不扣）
      const result = await searchFreeChatWeb(question, { onStarted: () => web.markStarted() });
      if (!result) {
        ctx.onWeb?.({ status: 'unavailable', message: '联网搜索暂时不可用', sources: [] });
        return '联网搜索暂时不可用，请如实告诉用户没有查到最新信息，不要编造来源。';
      }
      const done = result.status.status === 'done';
      ctx.onWeb?.({ status: done ? 'done' : 'unavailable', message: result.status.message, sources: result.status.sources });
      // 资料全文交给模型（和自由对话一样），连同同样的引用要求
      return `${result.context || '没有查到可靠的来源，请如实告诉用户未核实。'}${freeChatAnswerRules(true, { evidenceOnly: true })}`;
    } catch {
      ctx.onWeb?.({ status: 'unavailable', message: '联网搜索出错，这次没有核实', sources: [] });
      return '联网搜索出错，请如实告诉用户这次没有核实，不要编造来源。';
    }
  };

  return [
    {
      name: 'read_account',
      label: '正在查你的档案和作品',
      description:
        '读取用户的账号档案列表、每个档案已经有的定位类型，以及最近的作品和它们的进度。回答与用户账号、进度、该做什么有关的问题前先用它。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const profiles = await readInternal(ctx, '/api/profiles');
        const list = Array.isArray(profiles) ? profiles : [];
        const lines: string[] = [];
        lines.push(`账号档案 ${list.length} 个`);
        for (const p of list.slice(0, 5) as { id: string; profile_name?: string; industry?: string }[]) {
          const positions = await readInternal(ctx, `/api/positioning?profileId=${encodeURIComponent(p.id)}`).catch(() => []);
          const types = Array.isArray(positions)
            ? [...new Set((positions as { positioning_type?: string }[]).map((r) => r.positioning_type).filter(Boolean))]
            : [];
          lines.push(`- ${p.profile_name || '未命名档案'}${p.industry ? `（${p.industry}）` : ''}：已有定位 ${types.length ? types.join('、') : '无'}`);
        }
        const works = await readInternal(ctx, '/api/works?limit=10').catch(() => []);
        const items = Array.isArray(works) ? (works as { title?: string; is_done?: boolean; shoot_status?: string; updated_at?: string; stages?: { name: string; done: boolean }[] }[]) : [];
        lines.push(`最近作品 ${items.length} 条`);
        for (const w of items.slice(0, 8)) {
          const done = (w.stages ?? []).filter((s) => s.done).map((s) => s.name);
          const status = w.shoot_status === 'published' ? '已发布' : w.shoot_status === 'shot' ? '已拍摄' : w.is_done ? '内容做完、未拍' : '进行中';
          lines.push(`- 「${w.title ?? '未命名'}」${status}，已完成环节：${done.length ? done.join('、') : '无'}，最近更新 ${w.updated_at ? w.updated_at.slice(0, 10) : '未知'}`);
        }
        return clip(lines.join('\n'));
      },
    },
    {
      name: 'read_quota',
      label: '正在查你的额度',
      description: '读取用户当前套餐、各功能剩余额度、次数包余额。用户问额度够不够、能不能再生成时用它。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const q = (await readInternal(ctx, '/api/quota/check')) as {
          planName?: string;
          tightest?: { featureName: string; remaining: number } | null;
          packCredits?: number | null;
        };
        const parts = [`套餐：${q.planName ?? '免费版'}`];
        if (q.tightest) parts.push(`最紧张的功能「${q.tightest.featureName}」剩余 ${q.tightest.remaining} 次`);
        if (typeof q.packCredits === 'number') parts.push(`次数包余额 ${q.packCredits} 次`);
        return clip(parts.join('；'));
      },
    },
    {
      name: 'search_web',
      label: '正在联网查资料',
      description:
        '联网搜索最新的热点、新闻、行业动态。只在用户问最新、热点、今天发生的事、或者需要查证实时信息时使用。回答时要说明信息来源，查不到就如实说明。',
      input_schema: {
        type: 'object',
        properties: { question: { type: 'string', description: '要搜索的问题，用中文写清楚' } },
        required: ['question'],
      },
      // 资料全文要交给模型，不能像读取类工具那样只给 1500 字
      maxResultChars: 16000,
      async run(input) {
        const question = typeof input.question === 'string' ? input.question.trim() : '';
        if (!question) return '缺少要搜索的问题';
        if (!webRound) webRound = runWebSearch(question);
        return webRound;
      },
    },
    // 没接通知识库时不给这个工具：模型不会去查一个不存在的东西，回答里也不会出现「查过知识库」之类的话
    ...(knowledgeConfigured() ? [{
      name: 'search_knowledge',
      label: '正在查编导知识库',
      description:
        '查开物的编导知识库，找选题方法、脚本结构、开篇钩子、拍摄执行、账号定位这类方法论资料。用户问「怎么做」「为什么」「有什么方法」「该怎么选」时使用。账号情况、待办、额度不用它；最新热点用 search_web。回答时写出依据的是哪篇资料。',
      input_schema: {
        type: 'object',
        properties: { question: { type: 'string', description: '要查的问题，用中文写清楚' } },
        required: ['question'],
      },
      // 资料要交给模型看全，但每段已在检索结果里截到 900 字，整体上限放在 8000
      maxResultChars: 8000,
      async run(input: Record<string, unknown>) {
        const question = typeof input.question === 'string' ? input.question.trim() : '';
        if (!question) return '缺少要查的问题';
        if (!knowledgeRound) knowledgeRound = runKnowledgeSearch(question);
        return knowledgeRound;
      },
    }] : []),
    {
      name: 'run_review',
      label: '正在审稿（对照你的账号背景逐条核对）',
      description:
        '把用户给出的一份口播稿交给审稿优化板块检查：开头、结构、事实依据、禁忌等，给出可以直接改的意见。需要用户提供稿子的完整原文；稿子太短时先请用户补全。这个板块按审稿的额度扣费。',
      input_schema: {
        type: 'object',
        properties: {
          draft: { type: 'string', description: '待审的口播稿原文，完整保留用户给的内容' },
          platform: { type: 'string', description: '发布平台，例如抖音、快手、视频号、小红书、B站，不确定就不填' },
          scriptType: { type: 'string', description: '脚本类型，例如教知识型、讲故事型，不确定就不填' },
        },
        required: ['draft'],
      },
      async run(input) {
        const draft = typeof input.draft === 'string' ? input.draft.trim() : '';
        if (draft.length < 30) return '稿子太短或者没有给出原文。请先请用户把要审的稿子完整发过来';
        const platform = typeof input.platform === 'string' && input.platform.trim() ? input.platform.trim() : '抖音';
        const scriptType = typeof input.scriptType === 'string' ? input.scriptType.trim() : '';
        const doFetch = ctx.fetchImpl ?? fetch;
        const base = internalBase(ctx);

        const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
        // 和审稿页面同一个算法（lib/boards/review-query）：时长是页面的 AI 推荐初始值
        const currentSettings = reviewCreationSettings({ draftContent: draft, platform, duration: AI_DURATION, scriptType, autoSettings: {}, creatorContext });
        const { query, reviewMaterial } = buildReviewBoardQuery({
          creatorContext,
          currentSettings,
          sourceReference: '',
          draftContent: draft,
          platform,
          effectiveDuration: AI_DURATION,
          scriptType,
          personalRequirements: '',
          reviewDimensions: '',
          optimizationGoals: '',
          benchmarkScript: '',
          compareMode: true,
          severityLabels: true,
        });

        // 和审稿页面走同一个生成接口：额度、事实核对、修复都由它处理，这里不另起一套
        const res = await doFetch(`${base}/api/dify/stream`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({
            taskType: '审稿优化',
            creationSettings: currentSettings,
            query,
            draftContent: draft,
            personalRequirements: '',
            reviewMaterial,
            reviewFocus: '',
            profileId: creatorContext.profile?.id ?? null,
            platform,
            scriptType,
          }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          return `审稿没有完成：${data?.error ?? '服务暂时不可用，请稍后再试'}`;
        }
        const text = await readDifyStream(res);
        await saveBoardHistory(ctx, {
          taskType: '审稿优化',
          inputData: {
            profileId: creatorContext.profile?.id ?? null,
            draftContent: draft,
            sourceReference: '',
            originContent: draft,
            creationSettings: currentSettings,
            scriptType,
            platform,
            duration: AI_DURATION,
            personalRequirements: '',
            reviewDimensions: '',
            optimizationGoals: '',
            benchmarkScript: '',
            compareMode: true,
            severityLabels: true,
          },
          result: text,
        });
        return boardClip(text);
      },
    },
    {
      name: 'run_topic',
      label: '正在选题（对照你的账号定位和配比）',
      description:
        '让选题策划板块按用户的账号定位出一批选题。需要用户说清楚想拍什么方向或需求；条数默认 10，最多 10；视频目的默认按配比。这个板块按选题的额度扣费。',
      input_schema: {
        type: 'object',
        properties: {
          request: { type: 'string', description: '用户想要的选题方向或需求，用中文写清楚' },
          count: { type: 'number', description: '条数，3 到 10，默认 10' },
          role: { type: 'string', enum: ['按配比', '流量型', '人设型', '变现型'], description: '视频目的，默认按配比' },
          platform: { type: 'string', description: '发布平台，不确定就不填' },
        },
        required: ['request'],
      },
      async run(input) {
        const request = typeof input.request === 'string' ? input.request.trim() : '';
        if (!request) return '还不知道用户想拍什么。请先问清楚想要的方向或需求';
        const requestedCount = typeof input.count === 'number' ? Math.round(input.count) : 10;
        const topicCount = Math.min(10, Math.max(3, requestedCount));
        const roles = ['按配比', '流量型', '人设型', '变现型'];
        const topicRole = (roles.includes(String(input.role)) ? input.role : '按配比') as '按配比' | '流量型' | '人设型' | '变现型';
        const platform = typeof input.platform === 'string' && input.platform.trim() ? input.platform.trim() : '';
        const doFetch = ctx.fetchImpl ?? fetch;
        const base = internalBase(ctx);

        const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
        const topicType = topicRole === '按配比' ? '选题（流量型、人设型、变现型按配比搭配）' : `${topicRole}选题`;
        const resolvedMix = resolveMix(creatorContext.profile as unknown as Record<string, unknown> | null, null, request);
        // 和选题页面同一个算法（lib/boards/topic-query）：没勾选的项都是页面的初始空值
        const currentSettings = topicCreationSettings({
          keyword1: '', personalRequirement: request, sourceReference: '',
          selectedPlatforms: platform ? [platform] : [], selectedTracks: [], selectedContentTypes: [], selectedStyles: [],
          selectedElements: [], selectedDealReasons: [], topicRole, topicCount, tactic: '',
          autoSettings: {}, creatorContext,
        });
        const built = buildTopicBoardQuery({
          creatorContext,
          selectedProfile: creatorContext.profile ?? null,
          // 页面的选题从不选定位（没有设置选中定位的地方），助理也不带
          positioningForCtx: null,
          topicCount,
          topicType,
          topicRole,
          mode: 'quick',
          sourceReference: '',
          sourceFrom: '',
          incomingSetup: null,
          keyword1: '',
          keyword2: '',
          keyword3: '',
          personalRequirement: request,
          currentSettings,
          accountStage: '',
          fansLevel: '',
          avgViewsInput: '',
          selectedPlatforms: platform ? [platform] : [],
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
          route: '两种都出' as CreativeRoute,
          routeExplicit: false,
          resolvedMix,
          quickTopics: false,
        });

        // 和选题页面走同一个生成接口：额度、事实核对、去重都由它处理
        const res = await doFetch(`${base}/api/dify/stream`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({
            taskType: '选题策划',
            creationSettings: currentSettings,
            query: built.query,
            profileId: creatorContext.profile?.id ?? null,
            inputs: {
              profile_id: creatorContext.profile?.id ?? null,
              mode: 'quick',
              topicCount,
              topicType,
              topicRole,
              personalRequirement: request,
            },
          }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          return `选题没有完成：${data?.error ?? '服务暂时不可用，请稍后再试'}`;
        }
        const text = await readDifyStream(res);
        await saveBoardHistory(ctx, {
          taskType: '选题策划',
          inputData: {
            profile_id: creatorContext.profile?.id ?? null,
            mode: 'quick',
            topicType,
            topicRole,
            route: '两种都出',
            routeExplicit: false,
            platforms: platform,
            personalRequirement: request,
            keywords: '',
            topicCount,
            creationSettings: currentSettings,
          },
          result: text,
        });
        return boardClip(text);
      },
    },
    {
      name: 'run_script',
      label: '正在写脚本（对照你的账号定位）',
      description:
        '让脚本生成板块按用户的账号定位写一条可以直接拍的口播脚本。需要用户说清楚要拍的主题或内容；视频目的不确定就不填，由板块按内容判断。这个板块按脚本的额度扣费。',
      input_schema: {
        type: 'object',
        properties: {
          request: { type: 'string', description: '要拍的主题或内容，用中文写清楚' },
          role: { type: 'string', enum: ['流量型', '人设型', '变现型'], description: '视频目的，不确定就不填' },
          platform: { type: 'string', description: '发布平台，不确定就不填，默认抖音' },
        },
        required: ['request'],
      },
      async run(input) {
        const request = typeof input.request === 'string' ? input.request.trim() : '';
        if (!request) return '还不知道用户想拍什么。请先问清楚要拍的主题或内容';
        const roles: ContentRole[] = ['流量型', '人设型', '变现型'];
        const role = String(input.role ?? '');
        const platformInput = typeof input.platform === 'string' && input.platform.trim() ? input.platform.trim() : '';
        const doFetch = ctx.fetchImpl ?? fetch;
        const base = internalBase(ctx);

        const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);

        // 没说的项用脚本页面打开时的初始值；记忆预填开着时，再按页面的同一规则填上次的习惯
        const d = SCRIPT_PAGE_DEFAULTS;
        let state = {
          platform: platformInput || d.platform,
          durationMode: d.durationMode as 'preset' | 'custom' | 'ai',
          duration: d.duration,
          customDuration: '',
          scriptRole: roles.find((r) => r === role) ?? ('自动' as const),
          scriptStructure: d.scriptStructure,
        };
        const memory = ctx.memoryOn === false ? null : await readScriptMemory(ctx, creatorContext.profile?.id ?? null);
        if (memory) {
          const patch = scriptMemoryPatch(memory, state);
          state = {
            platform: patch.platform ?? state.platform,
            durationMode: patch.durationMode ?? state.durationMode,
            duration: patch.duration ?? state.duration,
            customDuration: patch.customDuration ?? state.customDuration,
            scriptRole: patch.scriptRole ?? state.scriptRole,
            scriptStructure: patch.scriptStructure ?? state.scriptStructure,
          };
        }
        const effectiveRole = state.scriptRole !== '自动' ? state.scriptRole : defaultRoleOfScriptType(d.scriptType);

        const currentSettings = scriptCreationSettings({
          topic: request, platform: state.platform, durationMode: state.durationMode, duration: state.duration, customDuration: state.customDuration,
          scriptType: d.scriptType, autoScriptType: true, scriptRole: state.scriptRole, effectiveRole,
          style: d.style, customStyle: '', targetGroup: d.targetGroup, customTargetGroup: '', industry: '', customIndustry: '',
          boomElements: [], dealReasons: [], additionalInfo: '', scriptStructure: state.scriptStructure, hookType: d.hookType,
          tactic: d.tactic, openingLine: '', openingCard: '', scene: d.scene, device: d.device, budget: d.budget, personnel: d.personnel,
          originContent: '', autoSettings: {}, fromHandoff: false, creatorContext,
        });
        const query = buildScriptBoardQuery({
          topic: request, platform: state.platform, scriptType: d.scriptType, autoScriptType: true, effectiveRole, isAd: false,
          industry: '', customIndustry: '', targetGroup: d.targetGroup, customTargetGroup: '', style: d.style, customStyle: '',
          durationMode: state.durationMode, duration: state.duration, customDuration: state.customDuration,
          profile: creatorContext.profile ?? null,
          // 脚本页面不带定位（方案 D，见 lib/boards/script-query），助理也不带
          positioningContent: null,
          scriptStructure: state.scriptStructure, hookType: d.hookType, boomElements: [], directorThoughts: d.directorThoughts,
          tactic: d.tactic, openingLine: '', openingCard: '', productInfo: '', priceInfo: '', scene: d.scene, device: d.device,
          budget: d.budget, personnel: d.personnel, accountPositioning: '', additionalInfo: '', dealReasons: [],
          originContent: '', focusContent: '', currentSettings,
        });

        // 和脚本页面走同一个生成接口：额度、事实核对由它处理
        const res = await doFetch(`${base}/api/dify/stream`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({
            taskType: '脚本生成',
            creationSettings: currentSettings,
            profileId: creatorContext.profile?.id ?? null,
            query,
          }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          return `脚本没有完成：${data?.error ?? '服务暂时不可用，请稍后再试'}`;
        }
        // 和脚本页面一样：结果后面追加质检报告，存进历史的也是这一份
        const text = scriptResultWithQuality(await readDifyStream(res));
        const duration = state.durationMode === 'ai'
          ? 'AI推荐'
          : state.durationMode === 'custom' && state.customDuration ? `${state.customDuration}秒` : state.duration;
        await saveBoardHistory(ctx, {
          taskType: '脚本生成',
          inputData: {
            profileId: creatorContext.profile?.id ?? null,
            topic: request,
            platform: state.platform,
            creationSettings: currentSettings,
            additionalInfo: '',
            originContent: '',
            duration,
            // 页面的打法是「AI 挑」时，存的是 AI 实际挑中的那一计
            tactic: tacticInText(text) || undefined,
          },
          result: text,
        });
        return boardClip(text);
      },
    },
    {
      name: 'add_todo',
      label: '正在记下这条待办',
      description:
        '把用户说的待办、计划记进开物的待办（工作台的待办列表里能看到，到期时会提醒）。用户说了日期，就换算成 YYYY-MM-DD 填进 dueDate；没说日期就不填。',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '要做的事，用一句话写清楚' },
          dueDate: { type: 'string', description: '到期日期，YYYY-MM-DD（北京时间）；没有日期就不填' },
        },
        required: ['content'],
      },
      async run(input) {
        const content = typeof input.content === 'string' ? input.content.trim() : '';
        if (!content) return '还不知道要记什么。请先问清楚用户要记的事';
        const dueDate = typeof input.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate.trim()) ? input.dueDate.trim() : null;
        const doFetch = ctx.fetchImpl ?? fetch;
        const res = await doFetch(`${internalBase(ctx)}/api/todos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ctx.cookie },
          body: JSON.stringify({ content, dueAt: dueDate ? `${dueDate}T09:00:00+08:00` : null }),
          cache: 'no-store',
        });
        if (!res.ok) return '待办没有记下来，请如实告诉用户，并请用户稍后再试';
        return `已记下待办：「${content}」${dueDate ? `，到期 ${dueDate}` : ''}。它会出现在工作台的待办里，到期时提醒用户。`;
      },
    },
    {
      name: 'list_todos',
      label: '正在查你的待办',
      description: '查看用户记下的待办和计划，以及哪些已经到期。用户问「我有什么要做的」「提醒我」这类问题时使用。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        const doFetch = ctx.fetchImpl ?? fetch;
        const res = await doFetch(`${internalBase(ctx)}/api/todos`, { headers: { cookie: ctx.cookie }, cache: 'no-store' });
        if (!res.ok) return '待办暂时没有读出来，请如实告诉用户';
        const list = ((await res.json().catch(() => [])) as { content: string; due_at: string | null; done: boolean }[]) ?? [];
        const open = list.filter((t) => !t.done);
        if (!open.length) return '用户现在没有未完成的待办。';
        const now = Date.now();
        const lines = open.map((t) => {
          const due = t.due_at ? new Date(t.due_at) : null;
          const day = due ? due.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }) : null;
          const overdue = !!due && due.getTime() < now;
          return `- ${t.content}${day ? `｜到期 ${day}` : ''}${overdue ? '（已到期）' : ''}`;
        });
        return `未完成的待办 ${open.length} 条：\n${lines.join('\n')}`;
      },
    },
    {
      name: 'play_ambient',
      label: '正在打开白噪音',
      description:
        '在页面上播放开物里的环境声。白噪音就是「专注」。用户说要播放白噪音、雨声、咖啡馆这类声音，或想专注时使用；说了时长就设定时间到了自动停。',
      input_schema: {
        type: 'object',
        properties: {
          sound: { type: 'string', description: '声音：白噪音（专注）、雨声、咖啡馆、篝火、翻书、海浪' },
          minutes: { type: 'number', description: '播放多少分钟后自动停；没说就不定时' },
        },
        required: ['sound'],
      },
      async run(input) {
        const sound = resolveSound(input.sound);
        if (!sound) return `没有这种声音。开物里有：${soundChoices()}（白噪音就是「专注」）`;
        const minutes = clampMinutes(input.minutes);
        const name = AMBIENT_SOUNDS.find((x) => x.id === sound)?.name ?? sound;
        ctx.onAction?.({ name: 'ambient.play', args: { sound, minutes } });
        return `已安排在页面上播放「${name}」${minutes ? `，${minutes} 分钟后自动停` : ''}。`;
      },
    },
    {
      name: 'stop_ambient',
      label: '正在停止声音',
      description: '停止页面上正在播放的环境声。',
      input_schema: { type: 'object', properties: {}, required: [] },
      async run() {
        ctx.onAction?.({ name: 'ambient.stop', args: {} });
        return '已安排停止播放。';
      },
    },
    {
      name: 'remember',
      label: '正在记下来',
      description:
        '把用户长期有用的事记进助理的记忆：偏好、账号情况、长期要遵守的要求。一句话写清楚。闲聊和一次性的事不记；密码、证件号、银行卡、手机号不记。「用户的记忆」里已经有的不要重复记；要修改其中一条，填 replaceId（用记忆里方括号中的编号）。',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '要记住的事，一句话，写清楚是谁、什么事' },
          replaceId: { type: 'string', description: '要改写的那条记忆的编号；新增时不填' },
        },
        required: ['content'],
      },
      async run(input) {
        const content = typeof input.content === 'string' ? input.content : '';
        const replaceId = typeof input.replaceId === 'string' ? input.replaceId.trim() : '';
        try {
          if (replaceId) {
            const r = await updateMemory(ctx.userId, replaceId, content);
            if (!r.ok) return `没有改成功：${r.reason}`;
            return `已把这条记忆改成「${r.memory.content}」。`;
          }
          const r = await addMemory(ctx.userId, content);
          if (!r.ok) return `没有记下来：${r.reason}`;
          if (r.duplicate) return `这件事已经记着了：「${r.memory.content}」，不用重复记。`;
          return `已记下：「${r.memory.content}」。之后的对话会记得这件事，用户可以在助理的「记忆」里查看和删除。`;
        } catch {
          return '记忆暂时没有存下来，请如实告诉用户，并请用户稍后再试';
        }
      },
    },
    {
      name: 'propose_forget',
      label: '正在找要忘掉的这条',
      description:
        '用户要助理忘掉某一条记忆时使用，填「用户的记忆」里的编号。这个工具不会直接删除：页面上会弹出确认，用户点「确定忘掉」才真的删。所以回答时告诉用户「请在页面上点确认」。',
      input_schema: {
        type: 'object',
        properties: { memoryId: { type: 'string', description: '记忆的编号（方括号中的那串）' } },
        required: ['memoryId'],
      },
      async run(input) {
        const memoryId = typeof input.memoryId === 'string' ? input.memoryId.trim() : '';
        if (!memoryId) return '缺少记忆的编号';
        try {
          const found = (await listMemories(ctx.userId, MEMORY_MAX_COUNT)).find((m) => m.id === memoryId);
          if (!found) return '没有找到这条记忆。请如实告诉用户，并请用户说清楚是哪一条。';
          ctx.onAction?.({ name: 'memory.forget', args: { id: found.id, content: found.content } });
          return `已在页面上列出「${found.content}」，等用户点确认后才会忘掉。请告诉用户在页面上点「确定忘掉」。`;
        } catch {
          return '记忆暂时读不出来，请如实告诉用户，稍后再试';
        }
      },
    },
  ];
}
