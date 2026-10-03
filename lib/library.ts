/**
 * 素材库（2026-10-02）。
 *
 * 产品方："每个板块都会生成内容，好的内容要能收藏保留起来，用户再用时不会浪费之前的资源。"
 * 收藏入口在「继续创作」那一栏（components/workspace/CreationLinks），所有板块都有；
 * 勾选了几条就存几条，没勾就存整份。
 */
import type { CreationItem, CreationItemKind } from './creation-items';
import type { CreationTarget } from './creation-flow';
import { postSafely } from './safe-post';

export const LIBRARY_CATEGORIES = [
  { id: 'topic', label: '选题' },
  { id: 'script', label: '脚本' },
  { id: 'storyboard', label: '分镜' },
  { id: 'review', label: '审稿稿' },
  { id: 'title', label: '标题封面' },
  { id: 'opening', label: '开篇钩子' },
  // 方向、思路、灵感、角度、人设——账号运营板块里的也算，那是创作的灵感来源
  { id: 'direction', label: '方向思路' },
  // 方案、执行建议、做法、打法、拍法
  { id: 'plan', label: '方案建议' },
  { id: 'remix', label: '二创' },
  { id: 'breakdown', label: '拆解' },
  { id: 'positioning', label: '定位' },
  { id: 'deal', label: '成交理由' },
  { id: 'other', label: '其他' },
] as const;
export type LibraryCategory = typeof LIBRARY_CATEGORIES[number]['id'];
export const CATEGORY_IDS = new Set<string>(LIBRARY_CATEGORIES.map((c) => c.id));
export const categoryLabel = (id: string) => LIBRARY_CATEGORIES.find((c) => c.id === id)?.label ?? '其他';

/** 从哪个板块收藏的，默认归哪一类 */
const BOARD_CATEGORY: Record<string, LibraryCategory> = {
  topic: 'topic', script: 'script', storyboard: 'storyboard', review: 'review', title: 'title',
  growth: 'opening', remix: 'remix', breakdown: 'breakdown',
  positioning: 'positioning', 'content-positioning': 'positioning', 'business-positioning': 'positioning', 'creative-brief': 'positioning',
  'deal-reason': 'deal',
  direction: 'direction',
};

/** 勾选列表认出来的类型（lib/creation-items）对应哪一类 */
const KIND_CATEGORY: Partial<Record<CreationItemKind, LibraryCategory>> = {
  topic: 'topic', script: 'script', direction: 'direction', plan: 'plan', title: 'title',
};

/** 专门的创作板块：出的东西就是这一类，一律按板块归 */
const CREATION_BOARDS = new Set(['topic', 'script', 'storyboard', 'review', 'title', 'growth', 'remix', 'breakdown']);

/**
 * 分类：
 * - 专门的创作板块按板块归（选题页出的就是选题，哪怕某条正文里带口播）
 * - 其余（自由对话、知识库、账号定位、简报、成交理由）按勾选认出来的内容类型归：
 *   账号定位里勾的几条方向 → 方向思路（产品方：那是灵感，要能当素材用）；
 *   认不出、或者整份收藏的，按板块归，再不行算「其他」
 */
export function libraryCategory(source: string, kind?: CreationItemKind): LibraryCategory {
  const board = BOARD_CATEGORY[source];
  if (board && CREATION_BOARDS.has(source)) return board;
  return (kind && KIND_CATEGORY[kind]) || board || 'other';
}

/** 素材拿去继续创作时，按分类推荐下一步 */
export const CATEGORY_NEXT: Record<LibraryCategory, CreationTarget[]> = {
  topic: ['script', 'growth', 'title'],
  script: ['review', 'storyboard', 'title'],
  storyboard: ['review', 'title'],
  review: ['storyboard', 'title'],
  title: ['script', 'review'],
  opening: ['script', 'title'],
  direction: ['topic', 'script'],
  plan: ['script', 'storyboard', 'topic'],
  remix: ['review', 'storyboard', 'script'],
  breakdown: ['remix', 'topic'],
  positioning: ['topic', 'growth'],
  deal: ['topic', 'script'],
  other: ['topic', 'script'],
};

export interface LibraryDraft {
  title: string;
  content: string;
  category: LibraryCategory;
  source: string;
}

export interface LibraryItem extends LibraryDraft {
  id: string;
  profile_id: string | null;
  note: string;
  created_at: string;
}

/** 一条勾选项 → 一条素材 */
export function draftFromItem(item: CreationItem, source: string, sourceLabel: string): LibraryDraft {
  return { title: (item.topic || item.label).slice(0, 120), content: item.body, category: libraryCategory(source, item.kind), source: sourceLabel };
}

/** 整份 → 一条素材。标题取第一个标题行，没有就取第一行 */
export function draftFromBody(body: string, source: string, sourceLabel: string, title?: string): LibraryDraft {
  const heading = body.split('\n').find((l) => /^#{1,4}\s+/.test(l)) || body.split('\n').find((l) => l.trim()) || '';
  const t = (title || heading.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() || `${sourceLabel}的内容`).slice(0, 120);
  return { title: t, content: body.trim(), category: libraryCategory(source), source: sourceLabel };
}

/** 存进素材库。返回新存了几条、几条之前就收藏过；失败抛出带中文的错误 */
export async function saveToLibrary(items: LibraryDraft[], profileId: string | null): Promise<{ saved: number; duplicated: number }> {
  // 一次收藏好几条长内容会超过 8KB：大了自动压缩 / 分块（lib/safe-post）
  const res = await postSafely('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, profileId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '收藏失败，请稍后重试');
  return { saved: data.saved ?? 0, duplicated: data.duplicated ?? 0 };
}
