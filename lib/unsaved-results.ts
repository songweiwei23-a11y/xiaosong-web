/**
 * 生成结果没保存进历史时，先暂存在本机，并在全站顶部提示用户「重试保存 / 复制 / 丢弃」（2026-10-24）。
 *
 * 为什么要有：保存失败以前只写控制台，用户看到了结果、以为已经存下，刷新后找不到，只能重新生成，又扣一次额度。
 * 只存在当前浏览器：刷新、换页后还在，换设备找不到。最多保留 10 条，超出丢最旧的。
 * localStorage 不可用（隐私模式、被禁止）时退回内存，本次页面内仍能看到和重试。
 */

export interface UnsavedResult {
  id: string;
  taskType: string;
  inputData: Record<string, unknown>;
  result: string;
  workId: string | null;
  /** 保存失败的时间（ISO） */
  failedAt: string;
}

export const UNSAVED_KEY = 'kaiwu:unsaved-results:v1';
export const UNSAVED_MAX = 10;
export const UNSAVED_EVENT = 'kaiwu:unsaved-changed';

/** 写进 localStorage 失败时的退路：按存储对象分开记，页面内存里保留，刷新会丢 */
const fallback = new WeakMap<Storage, UnsavedResult[]>();
const failedWrites = new WeakSet<Storage>();
/** 连存储对象都没有（服务端渲染等）时的退路 */
let noStorage: UnsavedResult[] = [];

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isUnsaved(v: unknown): v is UnsavedResult {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.taskType === 'string' && typeof o.result === 'string' && typeof o.failedAt === 'string';
}

export function readUnsaved(storage: Storage | null = defaultStorage()): UnsavedResult[] {
  if (!storage) return noStorage;
  if (failedWrites.has(storage)) return fallback.get(storage) ?? [];
  try {
    const raw = storage.getItem(UNSAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isUnsaved) : [];
  } catch {
    return [];
  }
}

/** 写入；返回是否写进了 localStorage（false 时已退回页面内存） */
function writeUnsaved(list: UnsavedResult[], storage: Storage | null): boolean {
  if (!storage) {
    noStorage = list;
    return false;
  }
  fallback.set(storage, list);
  try {
    storage.setItem(UNSAVED_KEY, JSON.stringify(list));
    failedWrites.delete(storage);
    return true;
  } catch {
    // 额度满了、被禁止写入：至少在页面内存里留着，本页面里仍能看到和重试
    failedWrites.add(storage);
    return false;
  }
}

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNSAVED_EVENT));
}

/** 记下一份没保存进去的结果。返回 true 表示写进了本机存储（刷新后还在） */
export function addUnsaved(
  item: Omit<UnsavedResult, 'id' | 'failedAt'>,
  now: number = Date.now(),
  storage: Storage | null = defaultStorage(),
): boolean {
  const entry: UnsavedResult = {
    ...item,
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    failedAt: new Date(now).toISOString(),
  };
  const current = readUnsaved(storage);
  const next = [entry, ...current].slice(0, UNSAVED_MAX);
  const persisted = writeUnsaved(next, storage);
  announce();
  return persisted;
}

export function removeUnsaved(id: string, storage: Storage | null = defaultStorage()): void {
  writeUnsaved(readUnsaved(storage).filter((x) => x.id !== id), storage);
  announce();
}
