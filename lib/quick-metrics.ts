/**
 * 发布后「3 个数」快速录入（整改 B1，2026-10-17）。
 *
 * 原来录数据要标「已发布」、再打开完整表单，十几个框。编导发完视频没人会专门去填。
 * 这里只要三个数：播放（必填）、完播率、点赞（选填）。其余（咨询、成交、平台、是否投放）
 * 仍然走作品卡上的完整表单，不强制。
 */
import type { WorkMetrics } from './performance';
import { parseNumber } from './metrics-import';

export interface QuickMetricsInput {
  views: string;
  completion: string;
  likes: string;
}

export type QuickMetricsResult = { ok: true; metrics: WorkMetrics } | { ok: false; error: string };

/** 三个框的文字 → 要保存的数据。播放必填；完播率只认 0～100；点赞只认数字 */
export function parseQuickMetrics(input: QuickMetricsInput, now: number = Date.now()): QuickMetricsResult {
  const views = parseNumber(input.views.trim());
  if (views == null) return { ok: false, error: '先填播放量，数字就行，比如 12000 或 1.2万' };
  const metrics: WorkMetrics = { views: Math.round(views), updatedAt: new Date(now).toISOString() };

  if (input.completion.trim()) {
    const c = parseNumber(input.completion.trim().replace(/%$/, ''));
    if (c == null || c < 0 || c > 100) return { ok: false, error: '完播率在 0 到 100 之间，比如 32' };
    metrics.completion = Math.round(c * 10) / 10;
  }
  if (input.likes.trim()) {
    const l = parseNumber(input.likes.trim());
    if (l == null) return { ok: false, error: '点赞数要是数字，比如 860' };
    metrics.likes = Math.round(l);
  }
  return { ok: true, metrics };
}

export interface PendingWork {
  id: string;
  title: string;
  days: number;
}

/**
 * 首页「待录数据」：已发布满 1 天、还没录过数据的作品，最久的排前面。
 * 没有发布时间的不算（没法判断过了几天）。
 */
export function pendingMetricsWorks(
  works: { id: string; title: string; shoot_status?: string | null; published_at?: string | null; metrics?: unknown }[],
  now: number = Date.now(),
  limit = 3,
): PendingWork[] {
  return works
    .filter((w) => w.shoot_status === 'published' && !w.metrics && w.published_at)
    .map((w) => ({ id: w.id, title: w.title, days: Math.floor((now - Date.parse(w.published_at as string)) / 86_400_000) }))
    .filter((w) => w.days >= 1)
    .sort((a, b) => b.days - a.days)
    .slice(0, limit);
}
