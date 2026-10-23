import { runTopicBoard, runScriptBoard, runReviewBoard, type BoardContext, type BoardResult, type ReviewInput, type ScriptInput, type TopicInput } from '@/lib/assistant/boards';
import {
  runContentPlanBoard,
  runDirectionBoard,
  runStoryboardBoard,
  runTitleBoard,
  type ContentPlanInput,
  type DirectionInput,
  type StoryboardInput,
  type TitleInput,
} from '@/lib/assistant/boards-more';

/**
 * 管理员能派的所有板块，和统一的派活格式（BoardAny）。
 * 派活前先查必填项（缺了就问用户）；多步计划里，上一步的产出交给下一步（withUpstream）。
 */

export type BoardKind = 'topic' | 'script' | 'review' | 'title' | 'storyboard' | 'direction' | 'content-plan';

/** 板块的显示名和它扣的额度功能（和 lib/task-type.ts 的映射一致；内容规划和创作方向共用一项额度） */
export const BOARD_LABEL: Record<BoardKind, { label: string; feature: string }> = {
  topic: { label: '选题策划', feature: '选题' },
  script: { label: '脚本生成', feature: '脚本' },
  review: { label: '审稿优化', feature: '审稿' },
  title: { label: '标题封面', feature: '标题' },
  storyboard: { label: '分镜脚本', feature: '分镜' },
  direction: { label: '创作方向', feature: '方向' },
  'content-plan': { label: '内容规划', feature: '方向' },
};

export type BoardAny =
  | { kind: 'topic'; input: TopicInput }
  | { kind: 'script'; input: ScriptInput }
  | { kind: 'review'; input: ReviewInput }
  | { kind: 'title'; input: TitleInput }
  | { kind: 'storyboard'; input: StoryboardInput }
  | { kind: 'direction'; input: DirectionInput }
  | { kind: 'content-plan'; input: ContentPlanInput };

/** 多步计划：按顺序派给几个板块，前一步的产出交给后一步 */
export interface PlanSpec {
  kind: 'plan';
  steps: BoardAny[];
}

export function runAnyBoard(ctx: BoardContext, board: BoardAny): Promise<BoardResult> {
  switch (board.kind) {
    case 'topic':
      return runTopicBoard(ctx, board.input);
    case 'script':
      return runScriptBoard(ctx, board.input);
    case 'review':
      return runReviewBoard(ctx, board.input);
    case 'title':
      return runTitleBoard(ctx, board.input);
    case 'storyboard':
      return runStoryboardBoard(ctx, board.input);
    case 'direction':
      return runDirectionBoard(ctx, board.input);
    case 'content-plan':
      return runContentPlanBoard(ctx, board.input);
  }
}

/** 必填项没有填的，返回要问用户的内容；都填了返回空数组 */
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
      return board.input.goal?.trim() ? [] : ['这次想达到的目的'];
    case 'content-plan':
      return board.input.goal?.trim() ? [] : ['这个月想主攻什么'];
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
      return `审稿这份稿子，找出问题并给出可以直接改的意见`;
    case 'title':
      return `为「${board.input.topic}」起 ${board.input.count ?? 5} 个标题`;
    case 'storyboard':
      return `把脚本拆成分镜，每个镜头写清楚画面和台词`;
    case 'direction':
      return `方向 ${board.input.count ?? 5} 个，目的：${board.input.goal}`;
    case 'content-plan':
      return `这个月的内容规划，目标：${board.input.goal}`;
  }
}

/** 板块的验收只看它的产出是否合格；脚本的事实核对要用原始需求 */
export function factContextOf(board: BoardAny): string {
  return board.kind === 'script' ? board.input.request : '';
}

/** 派活单的一句话摘要（给用户确认时看） */
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
  }
}

/** 上一步的产出交给下一步：有主要输入的接在后面；本身就是「加工对象」的（审稿、分镜）直接换成上一步的产出 */
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
  }
}

/** 把返工意见放进板块的 extraNote（每个板块的输入都有这个字段） */
export function withNote(board: BoardAny, note: string): BoardAny {
  return { ...board, input: { ...board.input, extraNote: note } } as BoardAny;
}
