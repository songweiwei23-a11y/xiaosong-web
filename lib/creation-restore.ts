/**
 * 创作链接（?creation=）恢复策略（2026-10-04）。
 *
 * 问题：创作需求快照是跳转那一刻存下的、不可变的。原来每次打开（包括刷新）都把它重新填进页面，
 * 用户在目标页改过设置、生成过新版本，一刷新又回到跳转时的样子；换设备打开旧链接也一样。
 *
 * 规则：
 *   - 这个标签页里已经恢复过这条链接（刷新）：不再填快照，交给作品恢复 / 页面自己的草稿恢复
 *   - 带着作品、而且作品在这个板块跳转之后生成过新版本：以作品为准（作品恢复会叠上作品需求和最新稿）
 *   - 其余（第一次打开、换设备打开但还没生成过）：填快照
 */
import type { HandoffPayload } from './handoff';

const STAGE_OF_TARGET: Record<string, string> = {
  '/dashboard/script': '脚本生成',
  '/dashboard/storyboard': '分镜脚本',
  '/dashboard/review': '审稿优化',
  '/dashboard/title': '标题封面',
  '/dashboard/growth': '开篇钩子',
  '/dashboard/topic': '选题策划',
};

const KEY = (id: string) => `kaiwu:creation-restored:${id}`;

export function wasCreationRestored(id: string): boolean {
  try { return sessionStorage.getItem(KEY(id)) === '1'; } catch { return false; }
}

export function markCreationRestored(id: string) {
  try { sessionStorage.setItem(KEY(id), '1'); } catch { /* 存不了：下次刷新照旧填快照，不影响这次 */ }
}

export function creationRestorePlan(input: {
  id: string;
  payload: HandoffPayload;
  /** 快照保存时间（creation_sessions.created_at）；拿不到时不比较，按快照来 */
  createdAt: string | null;
  work: { items?: { task_type: string; created_at: string; result?: string | null }[] } | null;
  restoredBefore: boolean;
}): 'snapshot' | 'work' {
  const stage = input.payload.target ? STAGE_OF_TARGET[input.payload.target] : undefined;
  // 只有作品阶段和自由对话有独立的完整恢复链；其他页刷新仍需把交接上下文送到接收者。
  if (input.restoredBefore && ((stage && input.payload.workId) || input.payload.target === '/dashboard/free-chat')) return 'work';
  if (input.work && input.createdAt && stage) {
    const newer = (input.work.items ?? []).some((it) => it.task_type === stage && it.result && it.created_at > input.createdAt!);
    if (newer) return 'work';
  }
  return 'snapshot';
}
