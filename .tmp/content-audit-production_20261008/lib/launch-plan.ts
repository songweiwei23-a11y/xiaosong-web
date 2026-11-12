/**
 * 7 天起号计划：注册后给小白一条照着走的路，每天一件事，7 天发出 7 条。
 *
 * 为什么要有：小白注册完最常见的状态是"不知道先干嘛"，试两下就走了。
 * 给他一个每天一小步的计划，7 天后他已经养成了习惯、也看到了数据——
 * 免费额度差不多用完的时候，付费是顺理成章的（额度快用完的引导见 lib/upgrade）。
 *
 * 每天的任务都直达对应板块，任务本身只要求"做完这一步"，不考核播放量。
 */

import { dayStartShanghai } from '@/lib/usage-month';

export interface LaunchDay {
  day: number;
  title: string;
  /** 为什么今天做这个（一句话） */
  why: string;
  href: string;
  cta: string;
}

export const LAUNCH_DAYS: LaunchDay[] = [
  { day: 1, title: '出一批选题，挑 3 个最想拍的', why: '先定拍什么。选题对了，后面就成功了一半', href: '/dashboard/topic', cta: '去出选题' },
  { day: 2, title: '写第 1 条口播脚本，照着拍、发出去', why: '第一条不求完美，发出去就是赢', href: '/dashboard/script', cta: '去写脚本' },
  { day: 3, title: '给第 2 条想一个 3 秒抓人的开头', why: '刷到你的人只给你 3 秒，开头决定他划不划走', href: '/dashboard/growth?tab=opening', cta: '去想开头' },
  { day: 4, title: '拍一条有画面的：先出分镜，再照着拍', why: '分镜把每个镜头拍什么都排好了，照着拍不用想', href: '/dashboard/storyboard', cta: '去出分镜' },
  { day: 5, title: '第 5 条拍之前，先让开物帮你审一遍稿', why: '发之前改一遍，比发完再后悔划算', href: '/dashboard/review', cta: '去审稿' },
  { day: 6, title: '挑一个起号打法，照着写一条', why: '起号有套路，36 计里总有一计适合你的店', href: '/dashboard/growth?tab=plan', cta: '去挑打法' },
  { day: 7, title: '给第 7 条起个好标题，发出去；回头看看哪条数据最好', why: '数据最好的那条，就是你下周该多拍的方向', href: '/dashboard/title', cta: '去起标题' },
];

export const LAUNCH_TOTAL = LAUNCH_DAYS.length;

/**
 * 今天是计划的第几天（按北京时间的日历天算）：开始那天是第 1 天。
 * 过了第 7 天也返回实际天数（大于 7），由调用方决定显示"计划已结束"。
 * 按日历天而不是按 24 小时：晚上 11 点开始的人，第二天早上就该是第 2 天。
 */
export function currentLaunchDay(startedAt: string | Date, now: Date = new Date()): number {
  const start = dayStartShanghai(new Date(startedAt)).getTime();
  const today = dayStartShanghai(now).getTime();
  return Math.max(1, Math.floor((today - start) / 86_400_000) + 1);
}

/** 完成的天：去重、只留 1~7，排好序 */
export function normalizeDoneDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= LAUNCH_TOTAL))].sort((a, b) => a - b);
}

/** 勾选 / 取消某一天 */
export function toggleDay(done: number[], day: number): number[] {
  const cur = normalizeDoneDays(done);
  return cur.includes(day) ? cur.filter((d) => d !== day) : normalizeDoneDays([...cur, day]);
}
