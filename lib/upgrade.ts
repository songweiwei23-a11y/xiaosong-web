/**
 * 付费引导：额度快用完、用完的那一刻怎么请人付费。
 *
 * 额度用完是用户最愿意付钱的时刻——他刚用出了甜头，正想接着用。
 * 原来这一刻只有一行红字"额度已用完，请升级"，各板块还各写各的
 * （脚本页有个单独的弹窗，而且是"任何一个功能用完"就说"脚本用完了"）。
 *
 * 现在全站一套：
 *   - 快用完（剩 3 次以内）：生成完之后右下角轻轻提醒一次，不打断
 *   - 用完了：弹一个窗，先回顾"你已经用开物做了什么"，再推荐下一档，一步去付款
 *
 * 触发走浏览器事件：板块生成前的预检查、服务端回 402 时的统一报错
 * （lib/api-error）、生成成功后的保存（lib/history）都只发一个事件，
 * 弹窗挂在工作台框架里统一接——不用在十几个板块里各接一遍。
 */

import { COUNTED_FEATURES, FEATURE_NAMES, getPlan } from '@/lib/config/plans';

export const QUOTA_EXHAUSTED_EVENT = 'kaiwu:quota-exhausted';
export const GENERATED_EVENT = 'kaiwu:generated';

/** 额度用完了：弹付费引导。feature 是功能代码（script / topic …），不知道就不传 */
export function openUpgrade(feature?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(QUOTA_EXHAUSTED_EVENT, { detail: { feature } }));
}

/** 生成成功了：看看是不是快用完，要不要提醒 */
export function notifyGenerated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GENERATED_EVENT));
}

/**
 * 推荐哪一档。永远只推"往上一档"——
 * 免费用户直接推 99 的专业版，价格跳得太大，单店老板第一次掏钱会犹豫；
 * 49 的基础版每个功能 50 次/月，对一家店一个号完全够用。
 */
export function recommendPlan(currentPlanId: string): string | null {
  const ladder = ['free', 'basic', 'pro', 'enterprise'];
  const i = ladder.indexOf(currentPlanId);
  if (i < 0) return 'basic';
  return ladder[i + 1] ?? null;
}

/** 每个功能用一次，产出的是什么（量词） */
const UNITS: Record<string, string> = {
  script: '条脚本',
  topic: '批选题',
  positioning: '份定位',
  freeChat: '次对话',
  storyboard: '份分镜',
  review: '次审稿',
  title: '组标题',
  dealReason: '份成交理由',
  knowledge: '次知识库查询',
  interview: '份前采建档',
  breakdown: '条爆款拆解',
  remix: '次跨行业二创',
  direction: '份创作方向',
};

/**
 * "你已经用开物做了什么"：按用的次数从多到少，最多列 4 项。
 * 用完那一刻先让他看到自己得到了什么，比直接说"请付费"有说服力得多。
 */
export function valueRecap(counts: Record<string, number>): string[] {
  return COUNTED_FEATURES.map((f) => ({ key: f.key as string, n: Math.round(Number(counts[f.key]) || 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((x) => `${x.n} ${UNITS[x.key] ?? `次${FEATURE_NAMES[x.key] ?? x.key}`}`);
}

/**
 * 快用完的提醒线：剩 3 次以内提醒一次。
 * 上限小的功能（免费版大多是 5 次）剩 3 次就提醒等于刚用两次就催，改成剩最后 1 次时提醒；
 * 上限只有一两次的不提醒，不然一用就提醒。
 */
export const NUDGE_REMAINING = 3;
export function shouldNudge(remaining: number, limit: number): boolean {
  const line = limit > NUDGE_REMAINING * 2 ? NUDGE_REMAINING : limit >= 3 ? 1 : 0;
  return remaining > 0 && remaining <= line;
}

/** 推荐那一档的卖点：价格 + 这一档的额度，从配置现算，不手写 */
export function planPitch(planId: string) {
  const p = getPlan(planId);
  return { id: p.id, name: p.name, price: p.price };
}
