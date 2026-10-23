import { buildContextBlock } from '@/lib/creator-context';
import { buildProfileSummary } from '@/lib/profile-summary';
import { resolveMix } from '@/lib/content-mix';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { VISUAL_STYLES } from '@/lib/content-types';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildDealReasonPrompt } from '@/lib/deal-reasons';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { carriedIntent, intentBlock } from '@/lib/creation-continuation';
import { incomingNote } from '@/lib/creation-flow';
import { creationSettingsBlock, mergeCreationSettings } from '@/lib/creation-settings';
import type { HandoffPayload } from '@/lib/handoff';
import { readDifyStream } from '@/lib/sse-stream';
import { loadBoardContext } from './board-context';
import { internalBase, type BoardContext, type BoardResult } from './boards';
import { pageHandoff } from '@/lib/assistant/carry-consume';

/**
 * 管理员能派活的另外四个板块：标题封面、分镜脚本、创作方向、内容规划（成交理由也在这里）。
 * 提示词用的是各板块自己的构造函数（lib/*），背景用档案里的创作上下文，和页面一致。
 * 带过来的内容（carry）按页面收到「带去下一步」时的规则接进来（见 lib/assistant/carry-consume）。
 * 内容由 Dify 生成，走的是同一个生成接口 /api/dify/stream，额度也按板块自己的功能扣。
 */

export interface TitleInput {
  /** 带过来的上一步结果：标题只能兑现这份内容里有的东西，开篇卡也跟着它走 */
  carry?: HandoffPayload;
  /** 带过来的参考内容（派活时写入，执行时以 carry 为准） */
  sourceContent?: string;
  /** 要起标题的主题（一句话） */
  topic: string;
  count?: number;
  platform?: string;
  /** 目标人群（用户说了才填） */
  audience?: string;
  extraNote?: string;
}

export interface StoryboardInput {
  /** 带过来的上一步结果：分镜拆的是它的当前脚本 */
  carry?: HandoffPayload;
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
  /** 带过来的上一步结果：这一次就是在它的方向上拓展（页面的「拓展」） */
  carry?: HandoffPayload;
  /** 这次想达到的目的，一两句话（必填；带过来的内容时可以不填，目的跟着它走） */
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
  return { ok: true, text: text.length > 6000 ? `${text.slice(0, 6000)}\n…（内容太长，已截断）` : text, full: text };
}

export async function loadContext(ctx: BoardContext) {
  return loadBoardContext({ cookie: ctx.cookie, base: internalBase(ctx), fetchImpl: ctx.fetchImpl }, ctx.profileId ?? null);
}

/** 标题封面：标题公式、关键词策略都按默认（AI 挑），和标题页的快速生成一致。带来的内容按标题页的规则接进来 */
export async function runTitleBoard(ctx: BoardContext, input: TitleInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const page = input.carry ? pageHandoff(input.carry, 'title', creatorContext) : null;
  const platform = input.platform?.trim() || '抖音';
  // 标题页：参考正文取「相关参考」，没有才用脚本正文；开篇卡从带来的内容里拿
  const sourceContent = page ? page.reference || page.incoming.scriptContent || '' : input.sourceContent?.trim() || '';
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
    sourceContent: sourceContent || undefined,
    openingCards: page?.incoming.openingCards ?? undefined,
  });
  return callBoardStream(ctx, {
    taskType: '标题封面',
    creationSettings: mergeCreationSettings(page?.settings, { platform }),
    query,
    profileId: creatorContext.profile?.id ?? null,
    platform,
    titleType: 'AI推荐',
  });
}

/** 分镜脚本：按脚本拆镜头，拍摄条件用档案里的（设备、团队、场地）。带来的内容：拆的是它的当前脚本，其余作为相关参考 */
export async function runStoryboardBoard(ctx: BoardContext, input: StoryboardInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const page = input.carry ? pageHandoff(input.carry, 'storyboard', creatorContext) : null;
  const platform = input.platform?.trim() || '抖音';
  const duration = input.duration?.trim() || '60秒';
  const contentType = input.contentType?.trim() || 'talking';
  const visualStyle = input.visualStyle?.trim() || VISUAL_STYLES[0].value;
  const script = page?.incoming.scriptContent?.trim() || input.script.trim();
  // 分镜页：参考和脚本正文不同才单独放进「相关方案参考」，和页面一样只让正文进分镜
  const reference = page && page.reference && page.reference !== (page.incoming.scriptContent ?? '')
    ? `【相关方案参考】\n${page.reference}\n以上仅为背景资料，请对脚本输入框中的正文拆分镜。`
    : '';
  const query = buildStoryboardPrompt({
    scriptContent: script,
    platform,
    duration,
    contentType,
    visualStyle,
    visualStyleLabel: VISUAL_STYLES.find((v) => v.value === visualStyle)?.label ?? '',
    additionalInfo: [reference, input.extraNote ?? ''].filter(Boolean).join('\n'),
    contextBlock: buildContextBlock(creatorContext, 'storyboard'),
  });
  return callBoardStream(ctx, {
    taskType: '分镜脚本',
    creationSettings: mergeCreationSettings(page?.settings, { platform, duration }),
    query,
    profileId: creatorContext.profile?.id ?? null,
    platform,
  });
}

/**
 * 创作方向：按目的铺开几个方向，每个方向说清楚思路和形式。
 * 带来的内容就是页面的「拓展」：那个方向单独放进 expand（来源、内容、原方向的目的和思路），
 * 页面还会在末尾追加桥接段和创作设置，这里一样。
 */
export async function runDirectionBoard(ctx: BoardContext, input: DirectionInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const profile = creatorContext.profile;
  const page = input.carry ? pageHandoff(input.carry, 'direction', creatorContext) : null;
  const expandContent = page?.reference?.trim() ?? '';
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
    expand: expandContent
      ? {
          from: page?.incoming.from || '其他板块',
          content: expandContent,
          intent: intentBlock(carriedIntent({ sourceContent: expandContent, originContent: '' })),
        }
      : undefined,
  }) + (page ? `${page.bridgePrompt}${creationSettingsBlock(page.settings)}` : '');
  return callBoardStream(ctx, {
    taskType: '创作方向',
    creationSettings: page?.settings ?? {},
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
  /** 带过来的上一步结果：页面「带去成交理由」时，它的内容填进店铺特色，设置里的目标人群也跟着来 */
  carry?: HandoffPayload;
  /** 店铺名称（必填） */
  storeName: string;
  /** 店铺类型，例如 火锅店、美容院 */
  storeType?: string;
  /** 店铺特色（必填，带来的内容时可以先空着）：没有依据的成交理由会被判不适用 */
  storeFeatures: string;
  /** 目标客户（老板说了才填） */
  targetCustomer?: string;
  extraNote?: string;
}

/** 成交理由：判断十七条成交理由各自成不成立，并给出怎么在视频里拍出来。店铺信息由老板给，不编 */
export async function runDealReasonBoard(ctx: BoardContext, input: DealReasonInput): Promise<BoardResult> {
  const creatorContext = await loadContext(ctx);
  const page = input.carry ? pageHandoff(input.carry, 'deal-reason', creatorContext) : null;
  const storeFeatures = [input.storeFeatures.trim(), page ? incomingNote(page.incoming, 1200) : ''].filter(Boolean).join('\n\n');
  const query = buildDealReasonPrompt({
    accountContext: buildContextBlock(creatorContext, 'dealReason'),
    storeName: input.storeName.trim(),
    storeType: input.storeType?.trim() ?? '',
    storeFeatures: withNote(storeFeatures, input.extraNote),
    targetCustomer: input.targetCustomer?.trim() || page?.bridgeSettings.audience || undefined,
  }) + (page?.bridgePrompt ?? '');
  return callBoardStream(ctx, {
    taskType: '成交理由',
    creationSettings: page?.bridgeSettings ?? {},
    query,
    topic: query,
    profileId: creatorContext.profile?.id ?? null,
  });
}
