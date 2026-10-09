/**
 * 我的创作偏好 · 浏览器端读写（接口 app/api/preferences）。
 */
import type { PreferenceItem } from './preferences';
import { postSafely } from './safe-post';

export interface PreferenceView {
  ready: boolean;
  enabled: boolean;
  items: PreferenceItem[];
  stats: { edits: number; reduction: number } | null;
  learnedAt: string | null;
  newCount: number;
}

const scope = (profileId: string | null) => encodeURIComponent(profileId || 'default');

export async function fetchPreferences(profileId: string | null): Promise<PreferenceView | null> {
  try {
    const res = await fetch(`/api/preferences?profileId=${scope(profileId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PreferenceView;
  } catch {
    return null;
  }
}

/** 生成时用：学习开着时生效的那几条；读不到就当没有，不挡生成 */
export async function fetchActivePreferences(profileId: string | null): Promise<PreferenceItem[]> {
  const v = await fetchPreferences(profileId);
  return v?.ready && v.enabled ? v.items.filter((i) => i.status === 'active') : [];
}

export async function preferenceAction(profileId: string | null, action: string, extra: Record<string, unknown> = {}): Promise<PreferenceView> {
  const res = await postSafely('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: profileId || 'default', action, ...extra }),
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    // 「现在更新」：几十秒的 SSE，最后一条是结果
    const text = await res.text();
    const last = text.split('\n').filter((l) => l.startsWith('data: ')).at(-1);
    const d = last ? JSON.parse(last.slice(6)) : null;
    if (!d || d.event === 'error') throw new Error(d?.message || '这次没更新成，请稍后再试');
    return d as PreferenceView;
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || '没成功，请重试');
  return d as PreferenceView;
}
