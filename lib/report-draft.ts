/**
 * 长报告的本地草稿（2026-11-02 产品方：「我刚才拆解的对标账号产出的结果怎么没有了？要有记忆保存」）。
 *
 * 对标拆解、账号诊断的报告在页面上边生成边显示，写完才存到服务器；新版报告长，要写几分钟：
 * 中途刷新、关页面，或者写完了但保存没成功，报告就只在那一刻的页面上，一刷新就没了。
 * 这里在生成过程中随时把草稿存进浏览器（按账号分开），存服务器成功才清掉；下次打开页面，
 * 写完没存上的自动补存，没写完的提示「上次没写完」并留着给编导看。
 *
 * 浏览器存储可能不可用（隐私模式、被禁），读写都包在 try 里，失败就当没有草稿，不影响生成。
 */

export interface ReportDraft {
  report: string;
  /** 生成写完了（只是没存上）；false 是写到一半断了 */
  done: boolean;
  materials: string[];
  at: number;
}

const PREFIX = 'kaiwu-report-draft:';
/** 超过 7 天的草稿不再提示 */
const MAX_AGE_MS = 7 * 24 * 3600_000;

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function saveDraft(key: string, draft: Omit<ReportDraft, 'at'>, now = Date.now()): void {
  if (!draft.report.trim()) return;
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify({ ...draft, at: now }));
  } catch {
    /* 存不下（满了、被禁）就算了 */
  }
}

export function readDraft(key: string, now = Date.now()): ReportDraft | null {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ReportDraft>;
    if (typeof d.report !== 'string' || !d.report.trim() || typeof d.at !== 'number' || now - d.at > MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return { report: d.report, done: d.done === true, materials: Array.isArray(d.materials) ? d.materials.filter((x): x is string => typeof x === 'string') : [], at: d.at };
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    /* 忽略 */
  }
}

/** 生成中别每个字都写一次：至少隔这么久存一次 */
export const DRAFT_THROTTLE_MS = 2000;
