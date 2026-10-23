/**
 * 需求 → 推荐路线（2026-10-23）：老板说得模糊（「最近没灵感」「想更新几期」）时，助理要先判断他要做什么，
 * 再按账号现在的状态推荐该走哪几个板块、每一步为什么。路线只是建议，列出来给老板确认后才按顺序跑。
 * 这里是纯规则，不碰网络；账号状态由调用方读出来传进来。
 */

/** 助理理解出来的需求类型 */
export type NeedKind = 'inspiration' | 'batch' | 'script' | 'title' | 'storyboard' | 'review' | 'positioning' | 'other';

/** 账号现在有什么（决定要不要先补前置板块） */
export interface AccountState {
  hasProfile: boolean;
  hasPositioning: boolean;
  hasBrief: boolean;
  /** 最近有几份创作结果（可以直接接着做） */
  recentResults: number;
  /** 最近一份创作方向的结果编号（没灵感时，直接接着它出选题，不用重新铺开方向） */
  recentDirectionId?: string;
}

/** 一步推荐：板块（plan 里用的名字）、显示名、为什么这一步。接着某份已有结果做的，带 fromResultId */
export interface RouteStep {
  board: string;
  label: string;
  why: string;
  fromResultId?: string;
}

export interface RouteAdvice {
  steps: RouteStep[];
  /** 还缺的信息（助理只问这些，不多问） */
  missing: string[];
}

const STEP = {
  positioning: { board: 'positioning', label: '账号定位' },
  brief: { board: 'brief', label: '创作简报' },
  direction: { board: 'direction', label: '创作方向' },
  contentPlan: { board: 'content-plan', label: '内容规划' },
  topic: { board: 'topic', label: '选题策划' },
  script: { board: 'script', label: '脚本生成' },
  title: { board: 'title', label: '标题封面' },
  storyboard: { board: 'storyboard', label: '分镜脚本' },
  review: { board: 'review', label: '审稿优化' },
} as const;

/** 前置板块：没有定位、简报，后面的选题、脚本就没有账号依据，先补上 */
function prerequisites(state: AccountState): RouteStep[] {
  const steps: RouteStep[] = [];
  if (!state.hasPositioning) steps.push({ ...STEP.positioning, why: '账号定位还没有做，后面的选题和脚本都要照它来，先定下来' });
  if (!state.hasBrief) steps.push({ ...STEP.brief, why: '把定位转成给选题、脚本用的简报，这一步让创作真正用上账号信息' });
  return steps;
}

/**
 * 按需求和账号状态推荐路线。
 * - 没档案：什么都先不推，只说要先建档（这时候推路线没有依据）
 * - 没灵感：先找方向，再从方向出选题（方向是拓展、选题是落地，两步一接）
 * - 想更新几期：先排这个月的内容，再从排好的几条出选题，挑一条写脚本
 */
export function adviseRoute(need: NeedKind, state: AccountState): RouteAdvice {
  if (!state.hasProfile) return { steps: [], missing: ['账号档案（先建档，后面的板块才有依据）'] };
  const pre = prerequisites(state);
  switch (need) {
    case 'inspiration':
      // 最近已经有一份创作方向：接着它出选题（不用重新铺开）；没有才从创作方向开始
      if (state.recentDirectionId) {
        return {
          steps: [{ ...STEP.topic, why: '最近已经做过一份创作方向，直接接着它出选题，不用重新找', fromResultId: state.recentDirectionId }],
          missing: [],
        };
      }
      return {
        steps: [...pre, { ...STEP.direction, why: '没灵感时，先按账号定位和目的铺开几个方向，挑一个最想拍的' }, { ...STEP.topic, why: '把挑中的方向落到具体的几条选题' }],
        missing: [],
      };
    case 'batch':
      return {
        steps: [...pre, { ...STEP.contentPlan, why: '想更新几期，先排这个月每一条的方向，避免想到哪拍到哪' }, { ...STEP.topic, why: '从排好的几条里出具体选题' }, { ...STEP.script, why: '挑一条写脚本，其余的之后再做' }],
        missing: ['这次要更新几期（不说就按这个月的配比排）'],
      };
    case 'script':
      return { steps: [...pre, { ...STEP.script, why: '按你说的主题写脚本' }], missing: [] };
    case 'title':
      return { steps: [{ ...STEP.title, why: '给这条内容起标题和封面字' }], missing: ['要起标题的内容（主题或脚本）'] };
    case 'storyboard':
      return { steps: [{ ...STEP.storyboard, why: '把脚本拆成镜头，拍的时候照着来' }], missing: ['要拆分镜的脚本原文'] };
    case 'review':
      return { steps: [{ ...STEP.review, why: '逐条核对稿子的问题，给能直接改的意见' }], missing: ['要审的稿子原文'] };
    case 'positioning':
      return { steps: [{ ...STEP.positioning, why: '重新定位，后面的板块都会跟着它变' }], missing: [] };
    default:
      return { steps: [], missing: ['你想做什么：找灵感、更新几期、写脚本、起标题、审稿，还是别的'] };
  }
}
