/**
 * 拍摄标记（逐镜头「拍完了」）同步到云端（2026-10-24，体检 F03）。
 *
 * 规则：服务端和本机各存一份，谁的 updatedAt 新就用谁。断网时只改本机，恢复联网后再推上去，
 * 不会用旧的状态覆盖较新的标记。旧版本只存在本机的标记（数组格式）也能读出来。
 */

export interface ShootChecklist {
  ids: string[];
  /** 最后一次修改的时间（ISO）。合并时以它为准 */
  updatedAt: string;
}

const MAX_IDS = 300;
const MAX_ID_LENGTH = 80;

function validIso(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

/** 接口收到的标记：不合法的直接拒绝（不静默修正），ids 去重 */
export function sanitizeChecklist(raw: unknown): ShootChecklist | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.ids) || !validIso(o.updatedAt)) return null;
  if (o.ids.length > MAX_IDS) return null;
  if (!o.ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH)) return null;
  return { ids: [...new Set(o.ids as string[])], updatedAt: new Date(o.updatedAt as string).toISOString() };
}

/**
 * 本机读出来的标记：支持新格式 {ids, updatedAt}，也支持旧格式（只是一个 id 数组，没有时间，按最旧算）。
 * 只保留仍然存在于当前镜头清单里的 id。
 */
export function parseLocalChecklist(raw: string | null, shotIds: string[]): ShootChecklist | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) {
      const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && shotIds.includes(id)))];
      return ids.length ? { ids, updatedAt: new Date(0).toISOString() } : null;
    }
    const clean = sanitizeChecklist(value);
    if (!clean) return null;
    return { ids: clean.ids.filter((id) => shotIds.includes(id)), updatedAt: clean.updatedAt };
  } catch {
    return null;
  }
}

/** 合并两份标记：谁的 updatedAt 新就用谁。都没有时返回 null */
export function mergeChecklist(a: ShootChecklist | null, b: ShootChecklist | null): ShootChecklist | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a;
}

/** 两份标记是否内容相同（用来判断要不要推到云端） */
export function sameChecklist(a: ShootChecklist | null, b: ShootChecklist | null): boolean {
  if (!a || !b) return a === b;
  return a.updatedAt === b.updatedAt && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]);
}
