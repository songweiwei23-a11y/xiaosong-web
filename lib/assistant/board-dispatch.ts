import { runTopicBoard, runScriptBoard, runReviewBoard, type BoardContext, type BoardResult, type ReviewInput, type ScriptInput, type TopicInput } from '@/lib/assistant/boards';
import {
  runContentPlanBoard,
  runDealReasonBoard,
  runDirectionBoard,
  runStoryboardBoard,
  runTitleBoard,
  type ContentPlanInput,
  type DealReasonInput,
  type DirectionInput,
  type StoryboardInput,
  type TitleInput,
} from '@/lib/assistant/boards-more';
import {
  runAdviceBoard,
  runBreakdownBoard,
  runBriefBoard,
  runGrowthBoard,
  runOpeningBoard,
  runPositioningBoard,
  runRemixBoard,
  type AdviceInput,
  type BreakdownInput,
  type BriefInput,
  type GrowthInput,
  type OpeningInput,
  type PositioningInput,
  type RemixInput,
} from '@/lib/assistant/boards-extra';
import { ADVICE_PURPOSES, ADVICE_STAGES } from '@/lib/industry-advice';
import type { HandoffPayload } from '@/lib/handoff';
import { DEPTHS, TOPIC_MAX } from '@/lib/research';
import { runResearchBoard, RESEARCH_TOPIC_MIN, type ResearchInput } from '@/lib/assistant/boards-research';

/**
 * 管理员能派的所有板块，和统一的派活格式（BoardAny）。
 * 派活前先查必填项（缺了就问老板）；多步计划里，上一步的产出交给下一步（withUpstream）。
 */

export type BoardKind =
  | 'topic'
  | 'script'
  | 'review'
  | 'title'
  | 'storyboard'
  | 'direction'
  | 'content-plan'
  | 'deal-reason'
  | 'positioning'
  | 'brief'
  | 'advice'
  | 'growth'
  | 'opening'
  | 'remix'
  | 'breakdown'
  | 'research';

/** 板块的显示名和它扣的额度功能（和 lib/task-type.ts 的映射一致；内容规划和创作方向共用一项额度） */
export const BOARD_LABEL: Record<BoardKind, { label: string; feature: string }> = {
  topic: { label: '选题策划', feature: '选题' },
  script: { label: '脚本生成', feature: '脚本' },
  review: { label: '审稿优化', feature: '审稿' },
  title: { label: '标题封面', feature: '标题' },
  storyboard: { label: '分镜脚本', feature: '分镜' },
  direction: { label: '创作方向', feature: '方向' },
  'content-plan': { label: '内容规划', feature: '方向' },
  'deal-reason': { label: '成交理由', feature: '成交理由' },
  positioning: { label: '账号定位', feature: '定位' },
  brief: { label: '创作简报', feature: '定位' },
  advice: { label: '行业建议', feature: '定位' },
  growth: { label: '起号方案', feature: '脚本' },
  opening: { label: '开篇钩子', feature: '脚本' },
  remix: { label: '跨行业二创', feature: '二创' },
  breakdown: { label: '文案拆解', feature: '拆解' },
  research: { label: '深度研究', feature: '研究' },
};

/**
 * 板块对应的任务类型（和各板块实际发给生成接口的 taskType 一致）。
 * 用来判断这个板块需要哪一步地基（lib/foundation-gate.ts）。
 */
export const BOARD_TASK_TYPE: Record<BoardKind, string> = {
  topic: '选题策划',
  script: '脚本生成',
  review: '审稿优化',
  title: '标题封面',
  storyboard: '分镜脚本',
  direction: '创作方向',
  'content-plan': '内容规划',
  'deal-reason': '成交理由',
  positioning: '账号定位',
  brief: '创作简报',
  advice: '行业建议',
  growth: '起号方案',
  opening: '开篇钩子',
  remix: '跨行业二创',
  breakdown: '拆解爆款',
  research: '深度研究',
};

type BoardAnyShape =
  | { kind: 'topic'; input: TopicInput }
  | { kind: 'script'; input: ScriptInput }
  | { kind: 'review'; input: ReviewInput }
  | { kind: 'title'; input: TitleInput }
  | { kind: 'storyboard'; input: StoryboardInput }
  | { kind: 'direction'; input: DirectionInput }
  | { kind: 'content-plan'; input: ContentPlanInput }
  | { kind: 'deal-reason'; input: DealReasonInput }
  | { kind: 'positioning'; input: PositioningInput }
  | { kind: 'brief'; input: BriefInput }
  | { kind: 'advice'; input: AdviceInput }
  | { kind: 'growth'; input: GrowthInput }
  | { kind: 'opening'; input: OpeningInput }
  | { kind: 'remix'; input: RemixInput }
  | { kind: 'breakdown'; input: BreakdownInput }
  | { kind: 'research'; input: ResearchInput };

/**
 * 派活的一条。carry 是「带过来的上一步结果」（页面「带去下一步」那份内容，由 fromResultId 取出来）：
 * 有它，板块就按页面的方式接着它做（原方向、目的、创作设置、当前脚本都跟着走），结果存下来时也沿着它接续。
 */
export type BoardAny = BoardAnyShape & { carry?: HandoffPayload };

/** 多步计划：按顺序派给几个板块，前一步的产出交给后一步 */
export interface PlanSpec {
  kind: 'plan';
  steps: BoardAny[];
}

/**
 * 验收不过时，管理员最多直接修改几次。深度研究不改：报告很长，改动的成本和风险都大，
 * 问题直接交给老板判断。其它板块按传入的上限。
 */
export function revisionCapOf(board: { kind: string }, max: number): number {
  return board.kind === 'research' ? 0 : max;
}

export function runAnyBoard(ctx: BoardContext, board: BoardAny): Promise<BoardResult> {
  switch (board.kind) {
    case 'topic':
      return runTopicBoard(ctx, { ...board.input, carry: board.carry });
    case 'script':
      return runScriptBoard(ctx, { ...board.input, carry: board.carry });
    case 'review':
      return runReviewBoard(ctx, { ...board.input, carry: board.carry });
    case 'title':
      return runTitleBoard(ctx, { ...board.input, carry: board.carry });
    case 'storyboard':
      return runStoryboardBoard(ctx, { ...board.input, carry: board.carry });
    case 'direction':
      return runDirectionBoard(ctx, { ...board.input, carry: board.carry });
    case 'content-plan':
      return runContentPlanBoard(ctx, board.input);
    case 'deal-reason':
      return runDealReasonBoard(ctx, { ...board.input, carry: board.carry });
    case 'positioning':
      return runPositioningBoard(ctx, { ...board.input, carry: board.carry });
    case 'brief':
      return runBriefBoard(ctx, { ...board.input, carry: board.carry });
    case 'advice':
      return runAdviceBoard(ctx, board.input);
    case 'growth':
      return runGrowthBoard(ctx, board.input);
    case 'opening':
      return runOpeningBoard(ctx, { ...board.input, carry: board.carry });
    case 'remix':
      return runRemixBoard(ctx, { ...board.input, carry: board.carry });
    case 'breakdown':
      return runBreakdownBoard(ctx, { ...board.input, carry: board.carry });
    case 'research':
      return runResearchBoard(ctx, board.input);
  }
}

/** 必填项没有填的，返回要问老板的内容；都填了返回空数组 */
export function missingFields(board: BoardAny): string[] {
  switch (board.kind) {
    case 'topic':
      return board.input.request?.trim() ? [] : ['要拍的方向或主题'];
    case 'script':
      return board.input.request?.trim() ? [] : ['要拍的主题或内容'];
    case 'review':
      return (board.input.draft ?? '').trim().length >= 30 ? [] : ['完整的稿子原文（至少 30 字）'];
    case 'title':
      return board.input.topic?.trim() ? [] : ['要起标题的主题'];
    case 'storyboard':
      return (board.input.script ?? '').trim().length >= 30 ? [] : ['完整的脚本原文（至少 30 字）'];
    case 'direction':
      // 带了上一步的结果：这次就是在它的方向上拓展，目的跟着它走
      return board.input.goal?.trim() || board.carry ? [] : ['这次想达到的目的'];
    case 'content-plan':
      return board.input.goal?.trim() ? [] : ['这个月想主攻什么'];
    case 'deal-reason': {
      const missing: string[] = [];
      if (!board.input.storeName?.trim()) missing.push('店铺名称');
      // 带了上一步的内容，店铺特色可以从那份内容里来
      if (!board.input.storeFeatures?.trim() && !board.carry) missing.push('店铺特色（有什么具体的服务、产品、优势）');
      return missing;
    }
    case 'positioning':
    case 'brief':
    case 'growth':
      return [];
    case 'advice': {
      const missing: string[] = [];
      if (!ADVICE_PURPOSES.some((p) => p.key === board.input.purpose)) missing.push('账号目的（大流量、人设型、变现型、分阶段推进）');
      if (!ADVICE_STAGES.some((s) => s.key === board.input.stage)) missing.push('当前阶段（起号期、积累期、放量期、变现期）');
      return missing;
    }
    case 'opening':
      return (board.input.topic ?? '').trim().length >= 2 ? [] : ['这条内容讲什么'];
    case 'remix':
      return (board.input.text ?? '').trim().length >= 30 ? [] : ['要借鉴的原文（至少 30 字：别的行业的文案，或拆解的结果）'];
    case 'breakdown':
      return (board.input.script ?? '').trim().length >= 30 ? [] : ['要拆解的文案原文（至少 30 字）'];
    case 'research': {
      const topic = (board.input.topic ?? '').trim();
      if (topic.length < RESEARCH_TOPIC_MIN) return [`研究主题（至少 ${RESEARCH_TOPIC_MIN} 字）`];
      return topic.length > TOPIC_MAX ? [`研究主题（最多 ${TOPIC_MAX} 字）`] : [];
    }
  }
}

/** 这一步的主要要求（用来让验收员对照）：脚本对照原始需求查事实，其它类对照要求本身 */
export function requirementOf(board: BoardAny): string {
  switch (board.kind) {
    case 'topic':
      return `选题 ${board.input.count ?? 10} 条，方向：${board.input.request}`;
    case 'script':
      return `脚本，要拍：${board.input.request}`;
    case 'review':
      return '审稿这份稿子，找出问题并给出可以直接改的意见';
    case 'title':
      return `为「${board.input.topic}」起 ${board.input.count ?? 5} 个标题`;
    case 'storyboard':
      return '把脚本拆成分镜，每个镜头写清楚画面和台词';
    case 'direction':
      return `方向 ${board.input.count ?? 5} 个，目的：${board.input.goal}`;
    case 'content-plan':
      return `这个月的内容规划，目标：${board.input.goal}`;
    case 'deal-reason':
      return `成交理由：${board.input.storeName}，店铺特色：${board.input.storeFeatures}`;
    case 'positioning':
      return '账号定位：六维地基，每个结论都要有理由，能直接指导后面的选题和脚本';
    case 'brief':
      return '创作简报：把账号定位转译成每一句都能直接指导创作的简报';
    case 'advice':
      return `行业建议：目的「${board.input.purpose}」，阶段「${board.input.stage}」，每一步针对哪类人、怎么拍、何时换阶段`;
    case 'growth':
      return '起号方案：给出可以照着拍的起号打法，每一计说清楚第一条拍什么';
    case 'opening':
      return `开篇钩子 ${board.input.count ?? 3} 条，主题：${board.input.topic}`;
    case 'remix':
      return '跨行业二创：借原片的开篇、结构、拍法，换成本店的事来拍，每个方案都要能照着拍';
    case 'breakdown':
      return '文案拆解：找出可保留的表达机制和具体的改进方法';
    case 'research':
      return `深度研究报告「${board.input.topic}」：有核心结论，每一节依据读过的网页，句子后面标来源编号，来源里没有的数字不编`;
  }
}

/** 板块的验收只看它的产出是否合格；脚本的事实核对要用原始需求 */
export function factContextOf(board: BoardAny): string {
  return board.kind === 'script' ? board.input.request : '';
}

/** 派活单的一句话摘要（给老板确认时看） */
export function summaryOf(board: BoardAny): string {
  switch (board.kind) {
    case 'topic':
      return [`选题 ${board.input.count ?? 10} 条（${board.input.role ?? '按配比'}）`, `方向：${board.input.request}`, board.input.keywords?.length ? `关键词：${board.input.keywords.join('、')}` : '', board.input.elements?.length ? `爆款元素：${board.input.elements.join('、')}` : ''].filter(Boolean).join('｜');
    case 'script':
      return [`脚本：${board.input.request}`, board.input.role ? `目的：${board.input.role}` : '', board.input.platform ? `平台：${board.input.platform}` : ''].filter(Boolean).join('｜');
    case 'review':
      return `审稿：${board.input.draft.slice(0, 30)}${board.input.draft.length > 30 ? '…' : ''}`;
    case 'title':
      return `标题 ${board.input.count ?? 5} 个｜主题：${board.input.topic}`;
    case 'storyboard':
      return `分镜：${board.input.script.slice(0, 30)}${board.input.script.length > 30 ? '…' : ''}`;
    case 'direction':
      return `方向 ${board.input.count ?? 5} 个｜目的：${board.input.goal}`;
    case 'content-plan':
      return `内容规划｜目标：${board.input.goal}`;
    case 'deal-reason':
      return `成交理由｜店铺：${board.input.storeName}｜特色：${board.input.storeFeatures.slice(0, 30)}`;
    case 'positioning':
      return `账号定位${board.input.platform ? `｜平台：${board.input.platform}` : ''}${board.input.notes ? `｜补充：${board.input.notes.slice(0, 30)}` : ''}`;
    case 'brief':
      return `创作简报${board.input.notes ? `｜补充：${board.input.notes.slice(0, 30)}` : ''}`;
    case 'advice':
      return `行业建议｜目的：${board.input.purpose}｜阶段：${board.input.stage}${board.input.situation ? `｜现状：${board.input.situation.slice(0, 30)}` : ''}`;
    case 'growth':
      return `起号方案${board.input.notes ? `｜补充：${board.input.notes.slice(0, 30)}` : ''}`;
    case 'opening':
      return `开篇钩子 ${board.input.count ?? 3} 条｜主题：${board.input.topic}`;
    case 'remix':
      return `跨行业二创 ${board.input.count ?? 1} 个方案｜原文：${board.input.text.slice(0, 30)}${board.input.text.length > 30 ? '…' : ''}`;
    case 'breakdown':
      return `文案拆解｜原文：${board.input.script.slice(0, 30)}${board.input.script.length > 30 ? '…' : ''}`;
    case 'research':
      return `深度研究｜主题：${board.input.topic}｜${DEPTHS[board.input.depth ?? 'standard'].label}研究${board.input.material ? '｜带了背景资料' : ''}`;
  }
}

/** 上一步的产出交给下一步：有主要输入的接在后面；本身就是「加工对象」的（审稿、分镜、二创、拆解）直接换成上一步的产出 */
export function withUpstream(board: BoardAny, text: string): BoardAny {
  const note = `\n\n【参考：上一步的产出】\n${text.slice(0, 3000)}`;
  switch (board.kind) {
    case 'topic':
      return { kind: 'topic', input: { ...board.input, request: board.input.request + note } };
    case 'script':
      return { kind: 'script', input: { ...board.input, request: board.input.request + note } };
    case 'review':
      return { kind: 'review', input: { ...board.input, draft: text.slice(0, 20000) } };
    case 'title':
      return { kind: 'title', input: { ...board.input, topic: board.input.topic + note } };
    case 'storyboard':
      return { kind: 'storyboard', input: { ...board.input, script: text.slice(0, 20000) } };
    case 'direction':
      return { kind: 'direction', input: { ...board.input, goal: board.input.goal + note } };
    case 'content-plan':
      return { kind: 'content-plan', input: { ...board.input, goal: board.input.goal + note } };
    case 'deal-reason':
      return { kind: 'deal-reason', input: { ...board.input, storeFeatures: board.input.storeFeatures + note } };
    case 'positioning':
      return { kind: 'positioning', input: { ...board.input, notes: (board.input.notes ?? '') + note } };
    case 'brief':
      // 简报要的是「账号定位」本身：上一步的产出就是定位，直接用它，不再读库里的
      return { kind: 'brief', input: { ...board.input, upstream: text.slice(0, 20000) } };
    case 'advice':
      return { kind: 'advice', input: { ...board.input, situation: (board.input.situation ?? '') + note } };
    case 'growth':
      return { kind: 'growth', input: { ...board.input, notes: (board.input.notes ?? '') + note } };
    case 'opening':
      return { kind: 'opening', input: { ...board.input, topic: board.input.topic + note } };
    case 'remix':
      return { kind: 'remix', input: { ...board.input, text: text.slice(0, 20000) } };
    case 'breakdown':
      return { kind: 'breakdown', input: { ...board.input, script: text.slice(0, 20000) } };
    case 'research':
      // 研究的主要输入是主题（一句话）；上一步的产出当成「材料」放进 material，研究接口把它当背景资料
      return { kind: 'research', input: { ...board.input, material: `${board.input.material ?? ''}${note}`.trim() } };
  }
}

/** 把返工意见放进板块的 extraNote（每个板块的输入都有这个字段） */
export function withNote(board: BoardAny, note: string): BoardAny {
  return { ...board, input: { ...board.input, extraNote: note } } as BoardAny;
}
