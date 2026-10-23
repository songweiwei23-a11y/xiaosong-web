import type { HandoffPayload } from '@/lib/handoff';
import { topicReference } from '@/lib/creation-continuation';
import { loadBoardContext } from './board-context';
import { pageHandoff } from '@/lib/assistant/carry-consume';
import { VIRAL_ELEMENTS } from '@/lib/viral-elements';
import { readDifyStream } from '@/lib/sse-stream';
import { resolveMix } from '@/lib/content-mix';
import { tacticInText, type CreativeRoute } from '@/lib/creative-routes';
import { defaultRoleOfScriptType, type ContentRole } from '@/lib/content-roles';
import type { MemoryDefaults } from '@/lib/settings-memory';
import { AI_DURATION } from '@/lib/review-standards';
import { buildReviewBoardQuery, reviewCreationSettings } from '@/lib/boards/review-query';
import { buildTopicBoardQuery, topicCreationSettings } from '@/lib/boards/topic-query';
import { buildScriptBoardQuery, SCRIPT_PAGE_DEFAULTS, scriptCreationSettings, scriptMemoryPatch, scriptResultWithQuality } from '@/lib/boards/script-query';

/**
 * 开物的细分板块（选题、脚本、审稿）。内容真正是这些板块用 Dify 生成的；助理只负责派活。
 * 这里的执行函数和板块页面走同一个生成接口（/api/dify/stream），额度由那个接口按板块扣，
 * 这里不另外扣。输入尽量和页面一致：页面有的字段（关键词、赛道、风格、对标账号、爆款案例、难度）都会带过去。
 */

export interface BoardContext {
  userId: string;
  /** 用户自己的 Cookie：板块接口靠它认人，权限沿用页面的 */
  cookie: string;
  profileId?: string | null;
  /** 记忆预填开着时，脚本按上次的习惯填（和脚本页面一样） */
  memoryOn?: boolean;
  /** 助理这件事有没有被老板停下：深度研究这类长任务每次轮询时看一眼，停了就把后台的研究也停掉 */
  isStopped?: () => boolean;
  /** 板块跑完存历史用；测试时可以替换 */
  saveHistory?: (row: BoardHistoryRow) => Promise<void>;
  /** 账号定位通过验收后，写进账号定位表（地基门槛和板块读的是那张表）。返回是否写进去了（2026-10-24） */
  persistPositioning?: (text: string) => Promise<boolean>;
  /** 默认 http://127.0.0.1:端口，测试时可以替换 */
  internalBase?: string;
  fetchImpl?: typeof fetch;
}

export interface TopicInput {
  /** 带过来的上一步结果：有它，选题就按页面「带去生成选题」的方式，从这份内容出发、守住它的原方向 */
  carry?: HandoffPayload;
  request: string;
  count: number;
  role: '按配比' | '流量型' | '人设型' | '变现型';
  platform?: string;
  /** 页面的关键词（最多三个） */
  keywords?: string[];
  /** 页面的赛道、风格 */
  tracks?: string[];
  styles?: string[];
  /** 对标账号、爆款案例（页面里的自由文字） */
  benchmarkAccounts?: string;
  viralCases?: string;
  /** 创意难度：简单易上手 / 中等创意 / 高难度 */
  difficulty?: string;
  /** 页面上选的爆款元素（用名字或编号都可以，这里统一换成编号） */
  elements?: string[];
  /** 返工时带上的修改意见（管理员写的） */
  extraNote?: string;
}

export interface ScriptInput {
  /** 带过来的上一步结果：有它，脚本按页面「带去脚本」的方式接着它写（开头、拍法、参考内容都带上） */
  carry?: HandoffPayload;
  request: string;
  role?: '流量型' | '人设型' | '变现型';
  platform?: string;
  scene?: string;
  style?: string;
  extraNote?: string;
}

export interface ReviewInput {
  /** 带过来的上一步结果：待审的是它的脚本正文，参考是它的原始方案 */
  carry?: HandoffPayload;
  draft: string;
  platform?: string;
  scriptType?: string;
  extraNote?: string;
}

export interface BoardResult {
  ok: boolean;
  /** 给对话里看的版本（超长会截断） */
  text: string;
  /** 完整的产出：存进创作会话、带去下一步用的是它，不能截断 */
  full?: string;
  /** 有页面历史的板块（选题、脚本、审稿）：历史有没有存成功。false 时要让老板先复制保存 */
  historySaved?: boolean;
  /** 失败的原因（给用户看，也给管理员判断要不要继续） */
  error?: string;
}

/** 板块跑完存进历史的一条，字段和页面各自保存时写的一样 */
export interface BoardHistoryRow {
  taskType: '选题策划' | '脚本生成' | '审稿优化';
  inputData: Record<string, unknown>;
  result: string;
}

const BOARD_TRUNC = 6000;
const boardClip = (s: string) => (s.length > BOARD_TRUNC ? `${s.slice(0, BOARD_TRUNC)}\n…（内容太长，已截断）` : s);

export function internalBase(ctx: BoardContext): string {
  return ctx.internalBase ?? process.env.ASSISTANT_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT || 3000}`;
}

export async function readInternal(ctx: BoardContext, path: string): Promise<unknown> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(`${internalBase(ctx)}${path}`, {
    headers: { cookie: ctx.cookie },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`读取 ${path.split('?')[0]} 失败（${res.status}）`);
  return res.json();
}

/** 脚本页面打开时会读「设置记忆」按上次的习惯预填（同一个接口、同一个 scope）。读不到就不预填 */
async function readScriptMemory(ctx: BoardContext, profileId: string | null): Promise<MemoryDefaults | null> {
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

/** 板块的产出存进用户自己的历史记录，和页面用的是同一批保存接口。存失败不影响结果 */
async function writeBoardHistory(ctx: BoardContext, row: BoardHistoryRow): Promise<boolean> {
  try {
    if (ctx.saveHistory) {
      await ctx.saveHistory(row);
      return true;
    }
    const doFetch = ctx.fetchImpl ?? fetch;
    const isTopic = row.taskType === '选题策划';
    const res = await doFetch(`${internalBase(ctx)}${isTopic ? '/api/topics' : '/api/script-history'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify(isTopic
        ? { input_data: row.inputData, result: row.result }
        : { input_data: row.inputData, result: row.result, task_type: row.taskType }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[助理] 板块「${row.taskType}」的历史保存返回 ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[助理] 板块「${row.taskType}」的历史没有保存：`, e);
    return false;
  }
}

/** 历史必须存成功：失败就再存一次；两次都失败返回 false，由板块结果带上提示，让老板先复制保存 */
async function saveBoardHistory(ctx: BoardContext, row: BoardHistoryRow): Promise<boolean> {
  if (await writeBoardHistory(ctx, row)) return true;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return writeBoardHistory(ctx, row);
}

/** 选题：页面的算法（lib/boards/topic-query），输入和页面一致 */
export async function runTopicBoard(ctx: BoardContext, input: TopicInput): Promise<BoardResult> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const base = internalBase(ctx);
  const topicCount = Math.min(10, Math.max(3, Math.round(input.count || 10)));
  const topicType = input.role === '按配比' ? '选题（流量型、人设型、变现型按配比搭配）' : `${input.role}选题`;
  const platform = input.platform?.trim() || '';
  const keywords = (input.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 3);
  const requirement = [input.request, input.extraNote ? `【管理员返工意见】${input.extraNote}` : ''].filter(Boolean).join('\n');
  const difficulty = input.difficulty?.trim() || '中等创意';
  const tracks = input.tracks ?? [];
  const styles = input.styles ?? [];
  // 页面上的爆款元素是编号，助理派活时可能给的是名字：两种都认，认不出来的丢掉
  const elementIds = (input.elements ?? [])
    .map((x) => VIRAL_ELEMENTS.find((e) => e.id === x || e.name === x)?.id)
    .filter((x): x is string => !!x);

  const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
  const resolvedMix = resolveMix(creatorContext.profile as unknown as Record<string, unknown> | null, null, requirement);
  // 带过来的内容：和页面「带去生成选题」一样，按目标页重新组装，再交给选题的提示词
  const page = input.carry ? pageHandoff(input.carry, 'topic', creatorContext) : null;
  const incoming = page?.incoming ?? null;
  const sourceReference = incoming ? topicReference(incoming) : '';
  const currentSettings = topicCreationSettings({
    keyword1: keywords[0] ?? '', personalRequirement: requirement, sourceReference,
    selectedPlatforms: platform ? [platform] : [], selectedTracks: tracks, selectedContentTypes: [], selectedStyles: styles,
    selectedElements: elementIds, selectedDealReasons: [], topicRole: input.role, topicCount, tactic: '',
    autoSettings: page?.settings ?? {}, creatorContext,
  });
  const built = buildTopicBoardQuery({
    creatorContext,
    selectedProfile: creatorContext.profile ?? null,
    positioningForCtx: null,
    topicCount,
    topicType,
    topicRole: input.role,
    mode: 'quick',
    sourceReference,
    sourceFrom: incoming?.from ?? '',
    incomingSetup: incoming,
    keyword1: keywords[0] ?? '',
    keyword2: keywords[1] ?? '',
    keyword3: keywords[2] ?? '',
    personalRequirement: requirement,
    currentSettings,
    accountStage: '',
    fansLevel: '',
    avgViewsInput: '',
    selectedPlatforms: platform ? [platform] : [],
    selectedTracks: tracks,
    selectedContentTypes: [],
    selectedStyles: styles,
    positioningExtra: '',
    selectedElements: elementIds,
    dealReasonLabels: [],
    benchmarkAccounts: input.benchmarkAccounts ?? '',
    viralCases: input.viralCases ?? '',
    difficulty,
    withHook: true,
    tactic: '',
    route: '两种都出' as CreativeRoute,
    routeExplicit: false,
    resolvedMix,
    quickTopics: false,
  });

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
        topicRole: input.role,
        personalRequirement: requirement,
      },
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, text: '', error: data?.error ?? '服务暂时不可用，请稍后再试' };
  }
  const text = await readDifyStream(res);
  const historySaved = await saveBoardHistory(ctx, {
    taskType: '选题策划',
    inputData: {
      profile_id: creatorContext.profile?.id ?? null,
      mode: 'quick',
      topicType,
      topicRole: input.role,
      route: '两种都出',
      routeExplicit: false,
      platforms: platform,
      personalRequirement: requirement,
      keywords: keywords.join('、'),
      topicCount,
      creationSettings: currentSettings,
    },
    result: text,
  });
  return { ok: true, text: boardClip(text), full: text, historySaved };
}

/** 脚本：和脚本页面的算法一致（lib/boards/script-query），记忆预填也按页面的规则 */
export async function runScriptBoard(ctx: BoardContext, input: ScriptInput): Promise<BoardResult> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const base = internalBase(ctx);
  const roles: ContentRole[] = ['流量型', '人设型', '变现型'];
  const request = [input.request, input.extraNote ? `【管理员返工意见】${input.extraNote}` : ''].filter(Boolean).join('\n');
  const platformInput = input.platform?.trim() || '';

  const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);

  const d = SCRIPT_PAGE_DEFAULTS;
  // 带过来的内容：和页面「带去脚本」一样，参考内容、已选的开头、拍法都从它来
  const page = input.carry ? pageHandoff(input.carry, 'script', creatorContext) : null;
  const incoming = page?.incoming ?? null;
  const carriedNote = incoming?.note ?? '';
  const carriedOpening = incoming?.openingLine ?? '';
  const carriedCard = incoming?.openingCards?.[0] ?? '';
  const carriedTactic = incoming?.tactic || d.tactic;
  let state = {
    platform: platformInput || d.platform,
    durationMode: d.durationMode as 'preset' | 'custom' | 'ai',
    duration: d.duration,
    customDuration: '',
    scriptRole: roles.find((r) => r === input.role) ?? ('自动' as const),
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
    style: input.style || d.style, customStyle: '', targetGroup: d.targetGroup, customTargetGroup: '', industry: '', customIndustry: '',
    boomElements: [], dealReasons: [], additionalInfo: carriedNote, scriptStructure: state.scriptStructure, hookType: d.hookType,
    tactic: carriedTactic, openingLine: carriedOpening, openingCard: carriedCard, scene: input.scene || d.scene, device: d.device, budget: d.budget, personnel: d.personnel,
    originContent: '', autoSettings: page?.settings ?? {}, fromHandoff: false, creatorContext,
  });
  const query = buildScriptBoardQuery({
    topic: request, platform: state.platform, scriptType: d.scriptType, autoScriptType: true, effectiveRole, isAd: false,
    industry: '', customIndustry: '', targetGroup: d.targetGroup, customTargetGroup: '', style: input.style || d.style, customStyle: '',
    durationMode: state.durationMode, duration: state.duration, customDuration: state.customDuration,
    profile: creatorContext.profile ?? null,
    positioningContent: null,
    scriptStructure: state.scriptStructure, hookType: d.hookType, boomElements: [], directorThoughts: d.directorThoughts,
    tactic: carriedTactic, openingLine: carriedOpening, openingCard: carriedCard, productInfo: '', priceInfo: '', scene: input.scene || d.scene, device: d.device,
    budget: d.budget, personnel: d.personnel, accountPositioning: '', additionalInfo: carriedNote, dealReasons: [],
    originContent: '', focusContent: '', currentSettings,
  });

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
    return { ok: false, text: '', error: data?.error ?? '服务暂时不可用，请稍后再试' };
  }
  // 和脚本页面一样：结果后面追加质检报告，存进历史的也是这一份
  const text = scriptResultWithQuality(await readDifyStream(res));
  const duration = state.durationMode === 'ai'
    ? 'AI推荐'
    : state.durationMode === 'custom' && state.customDuration ? `${state.customDuration}秒` : state.duration;
  const historySaved = await saveBoardHistory(ctx, {
    taskType: '脚本生成',
    inputData: {
      profileId: creatorContext.profile?.id ?? null,
      topic: request,
      platform: state.platform,
      creationSettings: currentSettings,
      additionalInfo: '',
      originContent: '',
      duration,
      tactic: tacticInText(text) || undefined,
    },
    result: text,
  });
  return { ok: true, text: boardClip(text), full: text, historySaved };
}

/** 审稿：和审稿页面的算法一致（lib/boards/review-query），按时长 AI 推荐 */
export async function runReviewBoard(ctx: BoardContext, input: ReviewInput): Promise<BoardResult> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const base = internalBase(ctx);
  const platform = input.platform?.trim() || '抖音';
  const scriptType = input.scriptType?.trim() || '';
  const personalRequirements = input.extraNote ? `【管理员返工意见】${input.extraNote}` : '';

  const creatorContext = await loadBoardContext({ cookie: ctx.cookie, base, fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
  // 审稿页收到带来的内容：待审的是它的脚本正文（scriptContent），「相关参考」是原始方案 + 当前版本（creationReference，和正文不同才带）
  const page = input.carry ? pageHandoff(input.carry, 'review', creatorContext) : null;
  const draft = page?.incoming.scriptContent?.trim() || input.draft.trim();
  if (draft.length < 30) return { ok: false, text: '', error: '稿子太短或者没有给出原文' };
  const sourceReference = page && page.reference && page.reference !== (page.incoming.scriptContent ?? '') ? page.reference : '';
  const currentSettings = reviewCreationSettings({ draftContent: draft, platform, duration: AI_DURATION, scriptType, autoSettings: page?.settings ?? {}, creatorContext });
  const { query, reviewMaterial } = buildReviewBoardQuery({
    creatorContext,
    currentSettings,
    sourceReference,
    draftContent: draft,
    platform,
    effectiveDuration: AI_DURATION,
    scriptType,
    personalRequirements,
    reviewDimensions: '',
    optimizationGoals: '',
    benchmarkScript: '',
    compareMode: true,
    severityLabels: true,
  });

  const res = await doFetch(`${base}/api/dify/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: ctx.cookie },
    body: JSON.stringify({
      taskType: '审稿优化',
      creationSettings: currentSettings,
      query,
      draftContent: draft,
      personalRequirements,
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
    return { ok: false, text: '', error: data?.error ?? '服务暂时不可用，请稍后再试' };
  }
  const text = await readDifyStream(res);
  const historySaved = await saveBoardHistory(ctx, {
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
      personalRequirements,
      reviewDimensions: '',
      optimizationGoals: '',
      benchmarkScript: '',
      compareMode: true,
      severityLabels: true,
    },
    result: text,
  });
  return { ok: true, text: boardClip(text), full: text, historySaved };
}
