import { buildContextBlock } from '@/lib/creator-context';
import { buildProfileSummary, businessLines } from '@/lib/profile-summary';
import { mixPromptBlock, resolveMix } from '@/lib/content-mix';
import { taboosPromptBlock } from '@/lib/taboos';
import { performancePromptBlock } from '@/lib/performance';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildQuickOutputSpec } from '@/lib/positioning-sections';
import { BRIEF_TYPE, buildBriefPrompt } from '@/lib/creative-brief';
import { ADVICE_TYPE, buildIndustryAdvicePrompt, type AdvicePurposeKey, type AdviceStageKey } from '@/lib/industry-advice';
import { buildGrowthPlanPrompt, buildOpeningPrompt, extractContentPlan } from '@/lib/growth-standards';
import { DEFAULT_LAYERS, DEFAULT_OUTPUTS, MAX_SOURCE_CHARS, REMIX_TASK_TYPE, buildRemixPrompt, COUNT_OPTIONS, type RemixCount, type RemixDuration } from '@/lib/remix';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { BREAKDOWN_TASK_TYPE } from '@/lib/viral-breakdown';
import type { CreationSettings } from '@/lib/creation-settings';
import type { BoardContext, BoardResult } from './boards';
import { callBoardStream, clampCount, loadContext, withNote } from './boards-more';

/**
 * 管理员能派活的另外七个板块：账号定位、创作简报、行业建议、起号方案、开篇钩子、跨行业二创、文案拆解。
 * 提示词用各板块自己的构造函数（lib/*），背景用档案里的创作上下文，和页面一致；
 * 内容由 Dify 生成，走的是同一个生成接口 /api/dify/stream，额度由那个接口按板块自己的功能扣。
 *
 * 不做的：视频截图的拆解（要上传视频，只能在拆解页面做）；前采（有自己的流程和附件）。深度研究在 boards-research.ts。
 */

export interface PositioningInput {
  /** 主平台（档案里有就不填） */
  platform?: string;
  /** 老板的补充要求 */
  notes?: string;
  extraNote?: string;
}

export interface BriefInput {
  notes?: string;
  /** 上一步产出的账号定位（管理员派的计划里带过来）。有它就用它，不再读库里的定位 */
  upstream?: string;
  extraNote?: string;
}

export interface AdviceInput {
  /** 账号目的，取值 traffic / persona / monetize / staged（缺了或认不出，必填项会挡住） */
  purpose: string;
  /** 当前阶段，取值 start / accumulate / scale / monetize（同上） */
  stage: string;
  /** 现状：发了多少条、哪类数据好、卡在哪（老板说了才填） */
  situation: string;
  /** 这一阶段想达到的具体结果（选填） */
  goal?: string;
  extraNote?: string;
}

export interface GrowthInput {
  notes?: string;
  extraNote?: string;
}

export interface OpeningInput {
  /** 这条内容讲什么（必填） */
  topic: string;
  count?: number;
  /** 已有的开头，想优化时才填 */
  currentOpening?: string;
  extraNote?: string;
}

export interface RemixInput {
  /** 要借鉴的原文：别的行业的文案，或上一步拆解的结果（必填） */
  text: string;
  /** 原片叫什么（老板说了才填） */
  title?: string;
  /** 原片是什么行业（贴文案时老板说了才填） */
  industry?: string;
  /** 方案个数，只认 1、2、3、5、10、15，其它按 1 个 */
  count?: number;
  /** 时长，例如 60秒；不填跟原片 */
  duration?: string;
  notes?: string;
  extraNote?: string;
}

export interface BreakdownInput {
  /** 要拆解的文案原文（必填） */
  script: string;
  extraNote?: string;
}

/** 当前档案的第一个平台（页面上取的也是它） */
function platformOf(account: unknown): string {
  return Array.isArray(account) ? String(account[0] ?? '') : typeof account === 'string' ? account : '';
}

/** 账号定位：快速版只出核心几节（和定位页的快速生成一致），六维地基 */
export async function runPositioningBoard(ctx: BoardContext, input: PositioningInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  if (!profile) return { ok: false, text: '', error: '还没有账号档案，请先建档再做账号定位' };
  const notes = withNote(input.notes?.trim() ?? '', input.extraNote);
  const platform = input.platform?.trim() || platformOf(profile.account_platform);
  const query = buildPositioningPrompt({
    profileSummary: buildProfileSummary(profile as never),
    additionalNotes: notes || undefined,
    platform: platform || undefined,
    restrictions: profile.content_restrictions || undefined,
    focus: 'full',
    outputSpec: buildQuickOutputSpec(),
    mixBlock: mixPromptBlock(resolveMix(profile, null, notes)),
    taboos: taboosPromptBlock(profile),
  });
  return callBoardStream(ctx, { taskType: '账号定位', creationSettings: {}, query, profileId: profile.id ?? null, platform });
}

/** 创作简报：把账号定位转译成给选题、脚本用的简报。定位要先有（库里的，或计划上一步的） */
export async function runBriefBoard(ctx: BoardContext, input: BriefInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const positioningFull = input.upstream?.trim() || creatorContext.positioning?.full || '';
  if (!positioningFull) return { ok: false, text: '', error: '还没有账号定位。先做账号定位，定好以后再做创作简报' };
  const notes = withNote(input.notes?.trim() ?? '', input.extraNote);
  const query = buildBriefPrompt({
    positioningFull,
    businessPositioning: creatorContext.businessPositioning || undefined,
    contentPositioning: creatorContext.contentPositioning || undefined,
    profileSummary: profile ? buildProfileSummary(profile as never) : undefined,
    notes: notes || undefined,
    mixBlock: profile ? mixPromptBlock(resolveMix(profile, null, notes)) : undefined,
    taboos: profile ? taboosPromptBlock(profile) : undefined,
  });
  return callBoardStream(ctx, { taskType: BRIEF_TYPE, creationSettings: {}, query, profileId: profile?.id ?? null });
}

/** 行业建议（药方）：按账号目的和当前阶段开药方。定位、作品数据有就带上 */
export async function runAdviceBoard(ctx: BoardContext, input: AdviceInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  if (!profile) return { ok: false, text: '', error: '还没有账号档案，请先建档再做行业建议' };
  const query = buildIndustryAdvicePrompt({
    profileSummary: buildProfileSummary(profile as never),
    baseline: creatorContext.positioning?.full || undefined,
    businessBaseline: creatorContext.businessPositioning || undefined,
    contentBaseline: creatorContext.contentPositioning || undefined,
    input: {
      purpose: input.purpose as AdvicePurposeKey,
      stage: input.stage as AdviceStageKey,
      situation: withNote(input.situation?.trim() ?? '', input.extraNote),
      goal: input.goal?.trim() || undefined,
    },
    performanceBlock: performancePromptBlock(creatorContext.performance as never) || undefined,
    taboos: taboosPromptBlock(profile),
  });
  return callBoardStream(ctx, { taskType: ADVICE_TYPE, creationSettings: {}, query, profileId: profile.id ?? null });
}

/** 起号方案：按内容定位和禁忌推起号打法，每一计说清楚第一条拍什么 */
export async function runGrowthBoard(ctx: BoardContext, input: GrowthInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const notes = withNote(input.notes?.trim() ?? '', input.extraNote);
  const contentPlan = creatorContext.contentPositioning ? extractContentPlan(creatorContext.contentPositioning) : '';
  const restrictions = profile
    ? [profile.content_restrictions, profile.avoid_content, taboosPromptBlock(profile)].filter(Boolean).join('；')
    : undefined;
  const query = buildGrowthPlanPrompt({
    contextBlock: buildContextBlock(creatorContext, 'growth'),
    contentPlan: contentPlan || undefined,
    notes: notes || undefined,
    restrictions: restrictions || undefined,
    mixBlock: profile ? mixPromptBlock(resolveMix(profile, null, notes)) : undefined,
  });
  return callBoardStream(ctx, { taskType: '起号方案', creationSettings: {}, query, profileId: profile?.id ?? null });
}

/** 开篇钩子：按这条内容讲什么写几条开头，每条都要兑现得了 */
export async function runOpeningBoard(ctx: BoardContext, input: OpeningInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const query = buildOpeningPrompt({
    contextBlock: buildContextBlock(creatorContext, 'script'),
    topic: withNote(input.topic.trim(), input.extraNote),
    currentOpening: input.currentOpening?.trim() || undefined,
    count: clampCount(input.count, 3, 1, 6),
  });
  return callBoardStream(ctx, { taskType: '开篇钩子', creationSettings: {}, query, profileId: creatorContext.profile?.id ?? null });
}

/** 跨行业二创：借原片的开篇、结构、拍法，换成老板自己店里的事。档案就是「哪家店」 */
export async function runRemixBoard(ctx: BoardContext, input: RemixInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const notes = withNote(input.notes?.trim() ?? '', input.extraNote);
  const count: RemixCount = COUNT_OPTIONS.find((c) => c === input.count) ?? 1;
  const query = buildRemixPrompt(
    {
      kind: 'paste',
      text: input.text.trim().slice(0, MAX_SOURCE_CHARS),
      title: input.title?.trim() || undefined,
      industry: input.industry?.trim() || undefined,
    },
    {
      layers: DEFAULT_LAYERS,
      count,
      differentiate: 'auto',
      depth: 'full',
      role: 'same',
      duration: (input.duration?.trim() || '跟原片') as RemixDuration,
      outputs: DEFAULT_OUTPUTS,
      profileSummary: profile ? buildProfileSummary(profile as never) : undefined,
      store: profile ? { name: profile.profile_name || '', lines: businessLines(profile as never) } : undefined,
      contextBlock: buildContextBlock(creatorContext, 'remix'),
      restrictions: profile?.content_restrictions || undefined,
      targetIndustry: profile ? undefined : input.industry?.trim() || undefined,
      notes: notes || undefined,
    },
  );
  return callBoardStream(ctx, { taskType: REMIX_TASK_TYPE, creationSettings: {}, query, profileId: profile?.id ?? null });
}

/** 文案拆解（文字版）：拆结构和表达机制。视频截图的拆解要在拆解页面上传视频，这里不做 */
export async function runBreakdownBoard(ctx: BoardContext, input: BreakdownInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const query = buildTextBreakdownPrompt(input.script.trim(), buildContextBlock(creatorContext, 'breakdown'), {} as CreationSettings);
  return callBoardStream(ctx, { taskType: BREAKDOWN_TASK_TYPE, creationSettings: {}, query, profileId: creatorContext.profile?.id ?? null });
}
