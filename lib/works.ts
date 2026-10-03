/**
 * 作品：把同一条内容的各个环节串起来。
 *
 * 什么时候算一个新作品，这是整套逻辑的关键，规则定成这样：
 *
 * - 选题策划不建作品。选题一次出十几二十条，它是「一批备选」而不是
 *   「一条内容」，此时还不知道哪条会被拍。
 * - 从选题点「写成脚本」并挑定一条时建作品，标题取那条选题。
 *   这是用户第一次表态「我要做这条」。
 * - 直接进脚本页生成、且没有带作品过来时，生成后建作品，标题取视频主题。
 * - 分镜、审稿、标题不建作品，只会挂到带过来的那个作品上；
 *   没带作品就作为零散记录存着——用户可能只是拿别处的稿子来审一下。
 */

import { STAGE_ORDER } from "./resume";

export interface WorkStage {
  name: string;
  done: boolean;
}

/** 落地状态：还没拍 / 已拍摄 / 已发布（迁移没跑时字段不存在，按还没拍算） */
export type ShootStatus = 'none' | 'shot' | 'published';

export interface Work {
  id: string;
  title: string;
  profile_id: string | null;
  is_done: boolean;
  shoot_status?: ShootStatus;
  shot_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  stages: WorkStage[];
  /** 可选环节（开篇）：能挂、能打开，不算进度 */
  optional?: WorkStage[];
  doneCount: number;
}

/** 新建作品，返回 id；失败返回 null（不阻断生成流程） */
export async function createWork(title: string, profileId?: string | null): Promise<string | null> {
  try {
    const res = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, profileId: profileId ?? null }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    // 作品只是组织方式，建不成也不该让用户的生成失败
    return null;
  }
}

/** 环节有更新时刷新作品，让它在列表里回到最前 */
export async function touchWork(id: string, patch: { title?: string; isDone?: boolean } = {}) {
  if (!id) return;
  try {
    await fetch(`/api/works?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    // 同上，静默失败
  }
}

/**
 * 一个环节刚保存完，登记到作品上。
 *
 * 此前只有脚本页做了这件事，分镜、审稿、标题保存后都不通知作品，
 * 于是 updated_at 停在最后一次写脚本的时间——作品在「进行中」列表里
 * 排序全乱，做到一半的那条反而沉底。
 *
 * 顺带解决另一个问题：作品从来没有被标记完成，五个环节都做完了仍然
 * 挂在「进行中」，列表只增不减。这里在最后一个环节落地时自动收尾。
 */
export async function recordStage(workId: string | null | undefined, stageName: string) {
  if (!workId) return; // 零散记录，本来就不属于任何作品

  try {
    // 拿这条作品当前的环节进度，判断是不是刚补上最后一块
    const res = await fetch(`/api/works?id=${encodeURIComponent(workId)}`);
    if (!res.ok) {
      await touchWork(workId);
      return;
    }
    const work = await res.json();
    const done = new Set<string>(
      (work?.items ?? []).map((it: { task_type: string }) => it.task_type)
    );
    done.add(stageName);
    // 选题永远算做完（作品就是挑定了选题才建的），见 lib/resume.ts 的 nextStage
    done.add('选题策划');

    const allDone = STAGE_ORDER.every((s) => done.has(s));
    await touchWork(workId, allDone ? { isDone: true } : {});
  } catch {
    // 查不到就退回最基本的动作：至少把时间刷新，让它回到列表最前
    await touchWork(workId);
  }
}

/*
 * 作品的环节清单原来在这里、app/api/works/route.ts、侧边栏各有一份，
 * 注释里写着"保持一致"——靠人记。现在只在 lib/resume.ts 里有一份，这里转出去。
 */
export { STAGE_ORDER };

export async function listWorks(limit = 20): Promise<Work[]> {
  try {
    const res = await fetch(`/api/works?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** 标记拍没拍、发没发。失败抛出带中文的错误 */
export async function setShootStatus(id: string, status: ShootStatus): Promise<Work> {
  const res = await fetch(`/api/works?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shootStatus: status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "保存失败，请重试");
  return data;
}

/**
 * 这条作品现在该提醒什么（2026-10-02，产品方："进行中的内容要显示进度环节，提醒用户时刻注意"）。
 * 返回 null 表示不用提醒；tone 决定颜色。
 */
export function workReminder(w: Work, now: number = Date.now()): { text: string; tone: 'info' | 'warn' | 'done' } | null {
  const days = (iso?: string | null) => (iso ? Math.floor((now - Date.parse(iso)) / 86400_000) : 0);
  const status = w.shoot_status ?? 'none';
  if (status === 'published') return { text: `已发布${w.published_at ? `（${new Date(w.published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}）` : ''}，记得回来看数据、复盘`, tone: 'done' };
  if (status === 'shot') {
    const d = days(w.shot_at);
    return { text: d >= 2 ? `拍完 ${d} 天了还没发，剪好就发吧` : '已拍摄，剪辑好记得发布', tone: d >= 2 ? 'warn' : 'info' };
  }
  const idle = days(w.updated_at);
  if (w.is_done) return { text: idle >= 2 ? `内容都做好 ${idle} 天了，还没拍——安排拍摄吧` : '内容都做好了，可以安排拍摄', tone: idle >= 2 ? 'warn' : 'info' };
  if (idle >= 3) return { text: `已经 ${idle} 天没动了`, tone: 'warn' };
  return null;
}

/** 顶部汇总和筛选用的分组 */
export type ProgressGroup = 'active' | 'toShoot' | 'shot' | 'published';
export function progressGroup(w: Work): ProgressGroup {
  const s = w.shoot_status ?? 'none';
  if (s === 'published') return 'published';
  if (s === 'shot') return 'shot';
  return w.is_done ? 'toShoot' : 'active';
}

export async function deleteWork(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/works?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
