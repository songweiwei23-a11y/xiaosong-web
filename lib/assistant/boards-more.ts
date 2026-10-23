import { buildContextBlock } from '@/lib/creator-context';
import { buildProfileSummary } from '@/lib/profile-summary';
import { resolveMix } from '@/lib/content-mix';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { VISUAL_STYLES } from '@/lib/content-types';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildDealReasonPrompt } from '@/lib/deal-reasons';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { readDifyStream } from '@/lib/sse-stream';
import { loadBoardContext } from './board-context';
import { internalBase, type BoardContext, type BoardResult } from './boards';

/**
 * 管理员能派活的另外四个板块：标题封面、分镜脚本、创作方向、内容规划。
 * 提示词用的是各板块自己的构造函数（lib/*），背景用档案里的创作上下文，和页面一致。
 * 内容由 Dify 生成，走的是同一个生成接口 /api/dify/stream，额度也按板块自己的功能扣。
 */

export interface TitleInput {
  /** 要起标题的主题（一句话） */
  topic: string;
  count?: number;
  platform?: string;
  /** 目标人群（用户说了才填） */
  audience?: string;
  extraNote?: string;
}

export interface StoryboardInput {
  /** 要拆分镜的脚本原文 */
  script: string;
  platform?: string;
  /** 形如 "60秒"，不填按 60 秒 */
  duration?: string;
  /** 内容类型的取值（lib/content-types），不填按口播 */
  contentType?: string;
  /** 视觉风格的取值（lib/content-types），不填按电影感 */
  visualStyle?: string;
  extraNote?: string;
}

export interface DirectionInput {
  /** 这次想达到的目的，一两句话（必填） */
  goal: string;
  count?: number;
  industry?: string;
  /** 已有的想法，可以留空 */
  ideas?: string;
  extraNote?: string;
}

export interface ContentPlanInput {
  /** 这个月想主攻什么（必填） */
  goal: string;
  count?: number;
  /** 这个月的大事、节点（可以留空） */
  events?: string;
  industry?: string;
  extraNote?: string;
}

export const clampCount = (n: number | undefined, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(typeof n === 'number' && Number.isFinite(n) ? n : fallback)));

export const withNote = (text: string, note?: string) => (note ? `${text}\n【管理员返工意见】${note}` : text);

/** 把板块的请求发到 Dify 生成接口，按回来的文字或错误原因返回 */
export async function callBoardStream(ctx: BoardContext, body: Record<string, unknown>): Promise<BoardResult> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(`${internalBase(ctx)}/api/dify/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: ctx.cookie },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, text: '', error: data?.error ?? '服务暂时不可用，请稍后再试' };
  }
  const text = await readDifyStream(res);
  return { ok: true, text: text.length > 6000 ? `${text.slice(0, 6000)}\n…（内容太长，已截断）` : text };
}

export async function loadContext(ctx: BoardContext) {
  return loadBoardContext({ cookie: ctx.cookie, base: internalBase(ctx), fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
}

/** 标题封面：标题公式、关键词策略都按默认（AI 挑），和标题页的快速生成一致 */
export async function runTitleBoard(ctx: BoardContext, input: TitleInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const platform = input.platform?.trim() || '抖音';
  const query = buildTitlePrompt({
    topic: withNote(input.topic.trim(), input.extraNote),
    titleTypeLabel: 'AI推荐',
    titleFormulaValue: '',
    titleFormulaLabel: '',
    keywordStrategyLabel: '',
    keywordStrategyDesc: '',
    platform,
    targetAudience: input.audience?.trim() ?? '',
    count: clampCount(input.count, 5, 3, 10),
    contextBlock: buildContextBlock(creatorContext, 'title'),
  });
  return callBoardStream(ctx, {
    taskType: '标题封面',
    creationSettings: { platform },
    query,
    profileId: creatorContext.profile?.id ?? null,
    platform,
    titleType: 'AI推荐',
  });
}

/** 分镜脚本：按脚本拆镜头，拍摄条件用档案里的（设备、团队、场地） */
export async function runStoryboardBoard(ctx: BoardContext, input: StoryboardInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const platform = input.platform?.trim() || '抖音';
  const duration = input.duration?.trim() || '60秒';
  const contentType = input.contentType?.trim() || 'talking';
  const visualStyle = input.visualStyle?.trim() || VISUAL_STYLES[0].value;
  const query = buildStoryboardPrompt({
    scriptContent: input.script.trim(),
    platform,
    duration,
    contentType,
    visualStyle,
    visualStyleLabel: VISUAL_STYLES.find((v) => v.value === visualStyle)?.label ?? '',
    additionalInfo: input.extraNote ?? '',
    contextBlock: buildContextBlock(creatorContext, 'storyboard'),
  });
  return callBoardStream(ctx, {
    taskType: '分镜脚本',
    creationSettings: { platform, duration },
    query,
    profileId: creatorContext.profile?.id ?? null,
    platform,
  });
}

/** 创作方向：按目的铺开几个方向，每个方向说清楚思路和形式 */
export async function runDirectionBoard(ctx: BoardContext, input: DirectionInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const query = buildDirectionPrompt({
    purposes: [],
    customGoal: withNote(input.goal.trim(), input.extraNote),
    ideas: input.ideas?.trim() || undefined,
    formats: [],
    count: clampCount(input.count, 5, 3, 8),
    depth: 'quick',
    profileSummary: profile ? buildProfileSummary(profile as never) : '',
    contextBlock: buildContextBlock(creatorContext, 'direction'),
    industry: input.industry?.trim() || undefined,
  });
  return callBoardStream(ctx, {
    taskType: '创作方向',
    creationSettings: {},
    query,
    profileId: profile?.id ?? null,
  });
}

/** 内容规划：这个月按内容配比排出每一条的方向，配比用档案里的目的 */
export async function runContentPlanBoard(ctx: BoardContext, input: ContentPlanInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const goal = withNote(input.goal.trim(), input.extraNote);
  const query = buildContentPlanPrompt({
    lastMonth: '',
    recordedLastMonth: null,
    count: clampCount(input.count, 12, 4, 30),
    focus: [],
    events: input.events?.trim() ?? '',
    notes: goal,
    resolved: resolveMix(profile as never, null, goal),
    profileSummary: profile ? buildProfileSummary(profile as never) : '',
    contextBlock: buildContextBlock(creatorContext, 'direction'),
    industry: input.industry?.trim() || undefined,
  });
  return callBoardStream(ctx, {
    taskType: '内容规划',
    creationSettings: {},
    query,
    profileId: profile?.id ?? null,
  });
}

export interface DealReasonInput {
  /** 店铺名称（必填） */
  storeName: string;
  /** 店铺类型，例如 火锅店、美容院 */
  storeType?: string;
  /** 店铺特色（必填）：没有依据的成交理由会被判不适用 */
  storeFeatures: string;
  /** 目标客户（老板说了才填） */
  targetCustomer?: string;
  extraNote?: string;
}

/** 成交理由：判断十七条成交理由各自成不成立，并给出怎么在视频里拍出来。店铺信息由老板给，不编 */
export async function runDealReasonBoard(ctx: BoardContext, input: DealReasonInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const query = buildDealReasonPrompt({
    accountContext: buildContextBlock(creatorContext, 'dealReason'),
    storeName: input.storeName.trim(),
    storeType: input.storeType?.trim() ?? '',
    storeFeatures: withNote(input.storeFeatures.trim(), input.extraNote),
    targetCustomer: input.targetCustomer?.trim() || undefined,
  });
  return callBoardStream(ctx, {
    taskType: '成交理由',
    creationSettings: {},
    query,
    topic: query,
    profileId: creatorContext.profile?.id ?? null,
  });
}
