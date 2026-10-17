/**
 * 月报（体检 F3）：把一个月的作品汇总成一页，给客户或老板看。纯函数，不调模型。
 *
 * 只写能算出来的：发了几条、录了几条数据、播放和完播、最好的一条、下个月计划的。
 * 结论句都是按数字拼出来的，没有编。
 */

export interface ReportWork {
  id: string;
  title: string;
  shoot_status?: string | null;
  shot_at?: string | null;
  published_at?: string | null;
  planned_at?: string | null;
  metrics?: { views?: number; completion?: number; paidPromotion?: boolean } | null;
}

export interface MonthlyReport {
  month: string;
  label: string;
  shot: number;
  published: number;
  withData: number;
  totalViews: number | null;
  medianCompletion: number | null;
  best: { title: string; completion: number } | null;
  nextMonthPlan: { title: string; planned_at: string }[];
  lines: string[];
}

const BJ = 8 * 3600_000;

/** 'YYYY-MM' → 显示用「2026年10月」 */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

/** 北京时间的 'YYYY-MM' */
export function monthOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + BJ).toISOString().slice(0, 7);
}

/** 上个月（北京时间）的 'YYYY-MM' */
export function previousMonth(now = Date.now()): string {
  const d = new Date(now + BJ);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const prev = new Date(Date.UTC(y, m - 1, 1));
  return prev.toISOString().slice(0, 7);
}

export function nextMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2);
};

export function buildMonthlyReport(works: ReportWork[], month: string): MonthlyReport {
  const inMonth = (iso: string | null | undefined) => monthOf(iso) === month;
  const shotWorks = works.filter((w) => inMonth(w.shot_at));
  const publishedWorks = works.filter((w) => inMonth(w.published_at));
  const withCompletion = publishedWorks.filter((w) => typeof w.metrics?.completion === 'number' && w.metrics?.paidPromotion !== true);
  const views = publishedWorks.map((w) => w.metrics?.views).filter((v): v is number => typeof v === 'number');
  const totalViews = views.length ? views.reduce((a, b) => a + b, 0) : null;
  const medianCompletion = median(withCompletion.map((w) => Number(w.metrics!.completion)));
  const bestRow = [...withCompletion].sort((a, b) => Number(b.metrics!.completion) - Number(a.metrics!.completion))[0];
  const best = bestRow ? { title: bestRow.title, completion: Number(bestRow.metrics!.completion) } : null;
  const next = nextMonthOf(month);
  const nextMonthPlan = works
    .filter((w) => w.planned_at && monthOf(w.planned_at) === next && w.shoot_status !== 'published')
    .map((w) => ({ title: w.title, planned_at: w.planned_at! }))
    .sort((a, b) => a.planned_at.localeCompare(b.planned_at));

  const lines: string[] = [];
  lines.push(`本月发布 ${publishedWorks.length} 条，拍摄完成 ${shotWorks.length} 条。`);
  if (withCompletion.length) {
    lines.push(`其中 ${withCompletion.length} 条录了完播数据，完播中位数 ${medianCompletion}%。`);
  } else {
    lines.push('本月还没有录入完播数据，发布后录一下，下个月的建议会更准。');
  }
  if (best) lines.push(`完播最高的是《${best.title}》，${best.completion}%。`);
  if (totalViews !== null) lines.push(`本月视频合计播放 ${totalViews.toLocaleString('zh-CN')} 次。`);
  if (nextMonthPlan.length) lines.push(`下个月计划发布 ${nextMonthPlan.length} 条。`);

  return {
    month,
    label: monthLabel(month),
    shot: shotWorks.length,
    published: publishedWorks.length,
    withData: withCompletion.length,
    totalViews,
    medianCompletion,
    best,
    nextMonthPlan,
    lines,
  };
}
