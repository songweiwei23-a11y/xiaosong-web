import { mergeCreationSettings } from './creation-settings';
import type { HandoffPayload } from './handoff';

export const CREATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGET = /^\/dashboard\/(breakdown|remix|review|storyboard|topic|script|title|growth|free-chat|positioning|content-positioning|business-positioning|deal-reason|direction|creative-brief)$/;
const TEXT_FIELDS = ['sourceContent', 'originContent', 'sourceTitle', 'topic', 'scriptContent', 'note', 'currentOpening', 'tactic', 'openingLine'] as const;

/** Durable snapshots contain creative data only, never credentials or arbitrary navigation. */
export function readCreationSnapshot(value: unknown): HandoffPayload | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.target !== 'string' || !TARGET.test(v.target) || typeof v.from !== 'string') return null;
  // 编号格式不对（旧素材、旧链接里存的）只丢掉这一项，不把整份内容判成无效（2026-11-08：原来整份作废，报「请选择要继续创作的内容」）
  const profileId = typeof v.profileId === 'string' && CREATION_UUID.test(v.profileId) ? v.profileId : null;
  const out: HandoffPayload = { from: v.from.slice(0, 100), target: v.target, profileId, settings: mergeCreationSettings(v.settings) };
  for (const key of TEXT_FIELDS) {
    if (typeof v[key] === 'string') out[key] = v[key] as string;
  }
  if (typeof v.workId === 'string' && CREATION_UUID.test(v.workId)) out.workId = v.workId;
  if (typeof v.intentUpdatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v.intentUpdatedAt) && Number.isFinite(Date.parse(v.intentUpdatedAt))) out.intentUpdatedAt = new Date(v.intentUpdatedAt).toISOString();
  if (v.tab === 'opening') out.tab = 'opening';
  if (Array.isArray(v.topicOptions)) out.topicOptions = v.topicOptions.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(v.openingCards)) out.openingCards = v.openingCards.filter((x): x is string => typeof x === 'string');
  // 一批选题里每条各自的派别（标题 → 选项 key，'tactic:计名' 或 'four:结构 id'，见 lib/script-route）：
  // 原来白名单漏了，存进作品需求再取出来就没了，脚本页挑中一条后派别丢失
  if (v.topicRoutes && typeof v.topicRoutes === 'object' && !Array.isArray(v.topicRoutes)) {
    const routes = Object.entries(v.topicRoutes as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0].length <= 200 && /^(tactic|four):.{1,60}$/.test(e[1])).slice(0, 50);
    if (routes.length) out.topicRoutes = Object.fromEntries(routes);
  }
  if (v.remixSource && typeof v.remixSource === 'object') {
    const s = v.remixSource as Record<string, unknown>;
    if (typeof s.text === 'string') out.remixSource = { text: s.text, title: typeof s.title === 'string' ? s.title : undefined };
  }
  if (JSON.stringify(out).length > 800_000) return null;
  return out;
}

export function creationSnapshotUrl(payload: HandoffPayload, id: string): string {
  if (!CREATION_UUID.test(id) || !payload.target || !TARGET.test(payload.target)) throw new Error('创作链接不正确');
  const query = new URLSearchParams({ creation: id });
  if (payload.workId) query.set('work', payload.workId);
  if (payload.tab) query.set('tab', payload.tab);
  return `${payload.target}?${query}`;
}
