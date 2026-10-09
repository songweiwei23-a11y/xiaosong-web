/** 本机草稿只能按登录账号、档案、文档标识读取。不会将草稿当成云端已保存。 */
export interface CanvasDraft {
  content: string;
  baseContent: string;
  baseAt: number;
  updatedAt: number;
  lockedTexts: string[];
  needsSync?: boolean;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 延迟访问浏览器存储：隐私模式禁用 localStorage 时，云端读写仍可继续。 */
export const browserDraftStorage: DraftStorage & { readonly length: number; key(index: number): string | null } = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
  get length() { return window.localStorage.length },
  key: index => window.localStorage.key(index),
}

export function canvasDraftKey(ownerId: string, profileId: string | null, documentId: string): string {
  return `kaiwu:canvas-draft:${encodeURIComponent(ownerId)}:${encodeURIComponent(profileId || 'default')}:${encodeURIComponent(documentId)}`;
}

export function readCanvasDraft(storage: DraftStorage, key: string): CanvasDraft | null {
  try {
    const row = JSON.parse(storage.getItem(key) || 'null');
    if (!row || typeof row.content !== 'string' || typeof row.baseContent !== 'string' || !Number.isFinite(row.baseAt)) return null;
    return { content: row.content, baseContent: row.baseContent, baseAt: row.baseAt, updatedAt: Number(row.updatedAt) || 0,
      lockedTexts: Array.isArray(row.lockedTexts) ? row.lockedTexts.filter((x: unknown): x is string => typeof x === 'string' && !!x) : [],
      ...(row.needsSync === true ? { needsSync: true } : {}) };
  } catch { return null; }
}

export function writeCanvasDraft(storage: DraftStorage, key: string, draft: CanvasDraft): boolean {
  try { storage.setItem(key, JSON.stringify(draft)); return true; } catch { return false; }
}

export function clearCanvasDraft(storage: DraftStorage, key: string): boolean {
  try { storage.removeItem(key); return true; } catch { return false; }
}
