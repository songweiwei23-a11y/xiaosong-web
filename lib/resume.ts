/**
 * 作品续作：任何时候打开一个作品的任何环节，都能接着做。
 *
 * 【原来的问题】板块之间靠 lib/handoff.ts 交接，那是 sessionStorage 里的
 * **一次性**数据——"刚生成完、马上跳下一步"那一刻有效，取出即清除。
 * 隔一天、换个页面、刷新一下，它就没了。侧边栏「进行中」的链接也只是一个
 * 光秃秃的页面地址，点进去页面根本不知道要接着做哪一条。
 *
 * 【现在】每个作品有一个随时能打开的地址：`/dashboard/脚本?work=作品编号`。
 * 目标页进来时读这个参数、从云端把作品取回来，把该填的都填上。
 * 地址不怕刷新、可以收藏、隔多久都能用——只要数据还在。
 *
 * handoff 仍然保留：它负责"刚刚"那一跳里带的零碎（打法、开篇卡这类），
 * 这里负责"随时"。两者可以同时存在，互不冲突。
 */

import { splitQualityReport } from './script-result-utils';

/** 作品的主线环节，顺序即创作流程。进度点、"下一步"都按它算 */
export const STAGE_ORDER = ['选题策划', '脚本生成', '分镜脚本', '审稿优化', '标题封面'] as const;

/**
 * 可选环节：可以挂在作品上、也能随时打开，但不算进度。
 * 开篇是写脚本前"先想好开头"的一步，不是每条都要做——
 * 算进进度的话，没做开篇的作品永远显示"没做完"。
 */
export const OPTIONAL_STAGES = ['开篇钩子'] as const;

export type Stage = (typeof STAGE_ORDER)[number] | (typeof OPTIONAL_STAGES)[number];

const ROUTES: Record<Stage, string> = {
  选题策划: '/dashboard/topic',
  开篇钩子: '/dashboard/growth',
  脚本生成: '/dashboard/script',
  分镜脚本: '/dashboard/storyboard',
  审稿优化: '/dashboard/review',
  标题封面: '/dashboard/title',
};

export function stageRoute(stage: string): string {
  return ROUTES[stage as Stage] ?? '/dashboard';
}

/**
 * 打开某个作品的某个环节。
 * 起号页有两个标签，开篇在第二个，所以额外带上 tab。
 */
export function workStageUrl(workId: string, stage: string): string {
  const base = stageRoute(stage);
  const qs = new URLSearchParams({ work: workId });
  if (stage === '开篇钩子') qs.set('tab', 'opening');
  return `${base}?${qs.toString()}`;
}

/** 不属于作品主线的其余板块，历史记录也要能点回去 */
const OTHER_ROUTES: Record<string, string> = {
  账号定位: '/dashboard/positioning',
  商业定位: '/dashboard/business-positioning',
  内容定位: '/dashboard/content-positioning',
  创作简报: '/dashboard/creative-brief',
  拆解爆款: '/dashboard/breakdown',
  跨行业二创: '/dashboard/remix',
  起号方案: '/dashboard/growth',
  成交理由: '/dashboard/deal-reason',
  知识库查询: '/dashboard/knowledge',
  自由对话: '/dashboard/free-chat',
};

/**
 * 一条历史记录该从哪里打开。
 * 属于作品的：带上作品编号回到那一条，接着做；零散的：回到它的板块。
 */
export function historyOpenUrl(item: { task_type?: string | null; work_id?: string | null }): string {
  const t = item.task_type ?? '';
  if (item.work_id && t in ROUTES) return workStageUrl(item.work_id, t);
  return ROUTES[t as Stage] ?? OTHER_ROUTES[t] ?? '/dashboard';
}

export interface StageState {
  name: string;
  done: boolean;
}

/**
 * 作品的下一步。
 *
 * 选题那一步永远算做完了：作品就是"从一批选题里挑定了这一条"才建的，
 * 标题本身就是选题。原来它被当成没做——因为选题那一批记录从来没挂到
 * 作品上——于是「进行中」的每一条都显示"下一步：选题策划"，
 * 点进去永远回到选题页。
 */
export function nextStage(stages: StageState[]): string | null {
  return stages.find((s) => s.name !== '选题策划' && !s.done)?.name ?? null;
}

export interface WorkItem {
  id: string;
  task_type: string;
  result: string;
  created_at: string;
  input_data?: Record<string, unknown> | null;
}

export interface WorkDetail {
  id: string;
  title: string;
  profile_id: string | null;
  is_done: boolean;
  items: WorkItem[];
}

/** 某个环节最新的一条内容。一个环节可能做过好几版，取最后一版 */
export function latestOf(work: WorkDetail | null | undefined, taskType: string): WorkItem | null {
  if (!work?.items?.length) return null;
  let best: WorkItem | null = null;
  for (const it of work.items) {
    if (it.task_type !== taskType || !it.result) continue;
    if (!best || it.created_at > best.created_at) best = it;
  }
  return best;
}

/**
 * 作品最新一版脚本的正文（去掉末尾的质量报告）。
 *
 * 分镜、审稿、开篇续作时都要拿脚本当输入。存档里的脚本末尾附着质量报告，
 * 结果区的"下一步"按钮传出去之前会剥掉它；从作品续作时也得剥，
 * 不然分镜页收到的稿子里混着一段"脚本质量 72 分"。
 */
export function workScriptBody(work: WorkDetail | null | undefined): string {
  const last = latestOf(work, '脚本生成');
  return last ? splitQualityReport(last.result).body : '';
}

/** 当前地址上带的作品编号。页面挂载后在 effect 里调用 */
export function workIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('work');
  return id && /^[0-9a-f-]{8,}$/i.test(id) ? id : null;
}

/** 从云端取一个作品及其全部环节。取不到返回 null，页面照常可用 */
export async function fetchWork(id: string): Promise<WorkDetail | null> {
  try {
    const res = await fetch(`/api/works?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' && data.id ? (data as WorkDetail) : null;
  } catch {
    return null;
  }
}
