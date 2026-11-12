/**
 * 「先打地基」这三步做到哪儿了。
 *
 * 【为什么要有这个】线上漏斗实测：
 *   注册 10 人 → 建了档案 10 人(100%) → 做完账号定位 4 人(40%)
 *   → 做完创作简报 **1 人(10%)**
 *
 * 而简报正是让选题、脚本、分镜真正用上账号信息的那一环。不做它，
 * 生成出来的东西是通用的，和直接问 AI 没区别——也就是说 90% 的人
 * 从来没体验过这个产品真正值钱的部分，然后就走了。
 *
 * 判断逻辑单独放这里，是因为它要在三个地方用：引导页、工作台的提醒条、
 * 以及决定新用户登录后落在哪。三处各判一次迟早对不上。
 */

export type SetupStepKey = 'profile' | 'positioning' | 'brief';

export interface SetupStep {
  key: SetupStepKey;
  /** 第几步，给界面显示 */
  index: number;
  title: string;
  /** 为什么要做这一步。不说清楚的话用户会跳过 */
  why: string;
  href: string;
  done: boolean;
}

export interface SetupInput {
  /** 账号档案数量 */
  profileCount: number;
  /** 这个档案下已有的定位类型（'账号定位' / '创作简报' / …） */
  positioningTypes: readonly string[];
}

export function setupSteps(input: SetupInput): SetupStep[] {
  const types = new Set(input.positioningTypes ?? []);
  return [
    {
      key: 'profile',
      index: 1,
      title: '建一个账号档案',
      why: '填一次，全站都用它。档案越全，后面生成的东西越贴合你的号',
      href: '/dashboard/profiles/new',
      done: (input.profileCount ?? 0) > 0,
    },
    {
      key: 'positioning',
      index: 2,
      title: '做账号定位',
      why: '弄清这个号是什么、给谁看、凭什么。这是后面所有判断的依据',
      href: '/dashboard/positioning',
      done: types.has('账号定位'),
    },
    {
      key: 'brief',
      index: 3,
      title: '生成创作简报',
      why: '把定位翻译成每次生成时能直接用的指令。没有它，选题和脚本只能给通用答案',
      href: '/dashboard/creative-brief',
      done: types.has('创作简报'),
    },
  ];
}

/** 下一步该做哪一件；全做完返回 null */
export function nextSetupStep(input: SetupInput): SetupStep | null {
  return setupSteps(input).find((s) => !s.done) ?? null;
}

export function setupDone(input: SetupInput): boolean {
  return nextSetupStep(input) === null;
}

/** 完成了几步 / 共几步 */
export function setupProgress(input: SetupInput): { done: number; total: number } {
  const steps = setupSteps(input);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/**
 * 新用户登录后该落在哪。
 *
 * 一步都没做过 = 全新用户，送去引导页；
 * 已经开始做了就别打断他，直接进工作台——引导页对一个做到一半的人
 * 是干扰，不是帮助。
 */
export function landingPath(input: SetupInput): string {
  const { done } = setupProgress(input);
  return done === 0 ? '/onboarding' : '/dashboard';
}
