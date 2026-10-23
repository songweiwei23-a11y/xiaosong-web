import { buildCreationHandoff, CREATION_SOURCES, incomingNote, type CreationTarget } from '@/lib/creation-flow';
import { creationReference } from '@/lib/creation-continuation';
import type { HandoffPayload } from '@/lib/handoff';
import type { BoardAny, BoardKind } from './board-dispatch';

/**
 * 助理板块之间带内容（2026-10-23）：和页面「带去下一步」用的是同一套组装（lib/creation-flow 的 buildCreationHandoff），
 * 所以原方向、目的、思路、拍法、当前脚本、开头这些，带过去的和真人在页面上跳转带过去的一样。
 * 这里只放纯函数，不碰网络，供板块执行函数、派活工具、保存结果共用。
 */

/** 板块在页面上的来源名（和 CREATION_SOURCES 的键一致）。开篇钩子是起号页的一个标签，按 growth 处理 */
export const BOARD_SOURCE: Record<BoardKind, string> = {
  topic: 'topic',
  script: 'script',
  review: 'review',
  title: 'title',
  storyboard: 'storyboard',
  direction: 'direction',
  'content-plan': 'content-plan',
  'deal-reason': 'deal-reason',
  positioning: 'positioning',
  brief: 'creative-brief',
  advice: 'industry-advice',
  growth: 'growth',
  opening: 'growth',
  remix: 'remix',
  breakdown: 'breakdown',
  research: 'research',
};

/** 显示用的板块名：页面上的来源名；研究这类页面上没有的，用它自己的名字 */
export function boardFromLabel(kind: BoardKind): string {
  if (kind === 'opening') return '开篇钩子';
  if (kind === 'research') return '深度研究';
  return CREATION_SOURCES[BOARD_SOURCE[kind]] ?? kind;
}

/**
 * 带过来的内容属于哪个来源（由 from 的名字反查）。
 * 页面存的是来源名（如「创作方向」「脚本生成」），助理存的也是同一套名字，所以两边都认得。
 */
export function sourceKeyOf(payload: Pick<HandoffPayload, 'from'>): string {
  if (payload.from === '开篇钩子') return 'growth';
  return Object.entries(CREATION_SOURCES).find(([, label]) => label === payload.from)?.[0] ?? 'free-chat';
}

/**
 * 按目标板块重新组装一份带过来的内容：和页面点「带去 X」时 buildCreationHandoff 给的一样。
 * carry 是创作会话里存的那份（它的 settings、originContent、workId 都要沿用，链路才连得上）。
 */
export function rebuildCarry(carry: HandoffPayload, target: CreationTarget): HandoffPayload {
  return buildCreationHandoff(sourceKeyOf(carry), target, carry.sourceContent?.trim() || carry.scriptContent || carry.remixSource?.text || '', {
    from: carry.from,
    originContent: carry.originContent,
    settings: carry.settings,
    workId: carry.workId,
    topic: carry.topic,
    topicOptions: carry.topicOptions,
  });
}

/** 派活单上的「用户想要的」一句话：保存结果时记进设置，之后带过去还在 */
export function requestTextOf(board: BoardAny): string {
  switch (board.kind) {
    case 'topic':
    case 'script':
      return board.input.request ?? '';
    case 'title':
    case 'opening':
      return board.input.topic ?? '';
    case 'review':
      return '';
    case 'storyboard':
      return '';
    case 'direction':
    case 'content-plan':
      return board.input.goal ?? '';
    case 'positioning':
      return board.input.notes ?? '';
    case 'brief':
      return board.input.notes ?? '';
    case 'advice':
      return board.input.goal ?? '';
    case 'growth':
      return board.input.notes ?? '';
    case 'deal-reason':
      return board.input.storeFeatures ?? '';
    case 'remix':
      return board.input.notes ?? '';
    case 'breakdown':
      return '';
    case 'research':
      return board.input.topic ?? '';
  }
}

/**
 * 派活时把带过来的内容接到板块的输入上。选题、脚本的 carry 留给板块执行时再组装（它们要用到完整的组装结果）；
 * 其它板块在这里直接把正文、开头、方向放进它们自己的字段。
 */
export function applyCarry(board: BoardAny, carry: HandoffPayload): BoardAny {
  const body = carry.sourceContent?.trim() ?? '';
  const withCarry = (next: BoardAny) => ({ ...next, carry }) as BoardAny;
  const origin = carry.settings?.direction || carry.topic || carry.sourceTitle || '';
  switch (board.kind) {
    case 'topic':
      return withCarry({ kind: 'topic', input: { ...board.input, request: board.input.request?.trim() || origin } });
    case 'script':
      return withCarry({ kind: 'script', input: { ...board.input, request: board.input.request?.trim() || carry.topic || carry.sourceTitle || origin } });
    case 'review': {
      const draft = rebuildCarry(carry, 'review').scriptContent || body;
      return withCarry({ kind: 'review', input: { ...board.input, draft } });
    }
    case 'storyboard': {
      const script = rebuildCarry(carry, 'storyboard').scriptContent || body;
      return withCarry({ kind: 'storyboard', input: { ...board.input, script } });
    }
    case 'title':
      return withCarry({ kind: 'title', input: { ...board.input, topic: board.input.topic?.trim() || carry.topic || carry.sourceTitle || origin, sourceContent: creationReference(carry) } });
    // 创作方向、账号定位、创作简报：带来的内容在执行时按页面的规则接进去（见 carry-consume），这里不重复拼
    case 'growth':
      return withCarry({ kind: 'growth', input: { ...board.input, notes: [board.input.notes, creationReference(carry)].filter(Boolean).join('\n') } });
    case 'opening': {
      const incoming = rebuildCarry(carry, 'growth');
      return withCarry({
        kind: 'opening',
        input: { ...board.input, topic: board.input.topic?.trim() || carry.topic || carry.sourceTitle || origin, currentOpening: board.input.currentOpening || incoming.currentOpening },
      });
    }
    case 'remix': {
      const source = rebuildCarry(carry, 'remix');
      return withCarry({ kind: 'remix', input: { ...board.input, text: board.input.text?.trim() || source.remixSource?.text || body, title: board.input.title || source.remixSource?.title } });
    }
    case 'breakdown':
      return withCarry({ kind: 'breakdown', input: { ...board.input, script: board.input.script?.trim() || body } });
    case 'research':
      return withCarry({ kind: 'research', input: { ...board.input, material: [board.input.material, creationReference(carry)].filter(Boolean).join('\n') } });
    default:
      // 顾问类、成交理由、内容规划：带过去的内容不硬塞进它们的必填字段（店铺特色、目标是老板自己要说的），只记下来
      return withCarry(board);
  }
}
