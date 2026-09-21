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

export interface WorkStage {
  name: string;
  done: boolean;
}

export interface Work {
  id: string;
  title: string;
  profile_id: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
  stages: WorkStage[];
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

export async function deleteWork(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/works?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
