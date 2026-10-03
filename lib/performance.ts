/**
 * 数据回流（2026-10-03）：发出去的视频录了数据 → 复盘 → 反哺选题、方向、起号、自由对话。
 *
 * 原来是"生成 → 拍 → 发"就断了，系统永远不知道哪条火了、哪条没人看。
 * 现在已发布的作品可以录播放、完播、互动、涨粉、咨询、成交；
 * 按三种视频（流量 / 人设 / 变现）和拍法汇总，写进规划类板块的提示词：
 * 多做这个号上已经验证过的方向和拍法，少做数据差的。样本少的不下结论。
 *
 * 存在作品的 metrics 列（jsonb，迁移 20261003_work_metrics.sql）。
 */

export interface WorkMetrics {
  /** 播放 */
  views?: number;
  /** 完播率（%） */
  completion?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  /** 涨粉 */
  follows?: number;
  /** 咨询 / 私信 / 留资 */
  inquiries?: number;
  /** 到店 / 成交 */
  deals?: number;
  /** 一句话备注（"上了同城热榜"） */
  note?: string;
  updatedAt?: string;
}

export const METRIC_FIELDS: { key: Exclude<keyof WorkMetrics, 'note' | 'updatedAt'>; label: string; unit?: string; max: number }[] = [
  { key: 'views', label: '播放', max: 1e9 },
  { key: 'completion', label: '完播率', unit: '%', max: 100 },
  { key: 'likes', label: '点赞', max: 1e8 },
  { key: 'comments', label: '评论', max: 1e8 },
  { key: 'shares', label: '转发', max: 1e8 },
  { key: 'follows', label: '涨粉', max: 1e8 },
  { key: 'inquiries', label: '咨询', max: 1e7 },
  { key: 'deals', label: '成交', max: 1e7 },
];

/** 校验一遍：只留认识的项，非负、限上限；全空返回 null */
export function readMetrics(v: unknown): WorkMetrics | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const out: WorkMetrics = {};
  for (const f of METRIC_FIELDS) {
    // 表单里空着的格子是空字符串，不能当成 0（0 播放和"没填"是两回事）
    const text = typeof o[f.key] === 'string' ? String(o[f.key]).replace(/[,，%\s]/g, '') : null;
    if (text === '') continue;
    const raw = text !== null ? Number(text) : o[f.key];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) out[f.key] = Math.min(f.max, f.key === 'completion' ? Math.round(raw * 10) / 10 : Math.round(raw));
  }
  if (typeof o.note === 'string' && o.note.trim()) out.note = o.note.trim().slice(0, 120);
  if (Object.keys(out).length === 0) return null;
  out.updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString();
  return out;
}

/** 卡片上一行看完："播放 1.2万 · 完播 32% · 咨询 5" */
export function metricsLine(m: WorkMetrics | null | undefined): string {
  if (!m) return '';
  // 12500 → 1.25万（不四舍五入成 1.3 万）；10 万以上留一位小数
  const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 1 : 2).replace(/\.?0+$/, '')}万` : String(n));
  return METRIC_FIELDS.filter((f) => typeof m[f.key] === 'number')
    .map((f) => `${f.label} ${f.key === 'completion' ? m[f.key] : fmt(m[f.key] as number)}${f.unit ?? ''}`)
    .join(' · ');
}

/** 一条已发布作品的复盘素材：标题、它是哪种视频、用的哪种拍法，加上数据 */
export interface PerformanceRow {
  title: string;
  purpose?: string | null;
  tactic?: string | null;
  scriptType?: string | null;
  metrics: WorkMetrics;
  publishedAt?: string | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = (rows: PerformanceRow[], k: keyof WorkMetrics) => rows.map((r) => r.metrics[k]).filter((x): x is number => typeof x === 'number');
/** 一条的综合分：以播放为主，互动、涨粉、咨询、成交加权（咨询成交对实体店最值钱） */
export function workScore(m: WorkMetrics): number {
  const v = m.views ?? 0;
  return v + (m.likes ?? 0) * 5 + (m.comments ?? 0) * 20 + (m.shares ?? 0) * 30 + (m.follows ?? 0) * 50 + (m.inquiries ?? 0) * 300 + (m.deals ?? 0) * 800 + (m.completion ?? 0) * 20;
}

export interface GroupStat { name: string; n: number; avgViews: number | null; avgCompletion: number | null; follows: number; inquiries: number; deals: number }

function group(rows: PerformanceRow[], keyOf: (r: PerformanceRow) => string | null | undefined): GroupStat[] {
  const m = new Map<string, PerformanceRow[]>();
  for (const r of rows) {
    const k = keyOf(r)?.trim();
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.entries()].map(([name, rs]) => ({
    name,
    n: rs.length,
    avgViews: avg(nums(rs, 'views')),
    avgCompletion: avg(nums(rs, 'completion')),
    follows: nums(rs, 'follows').reduce((a, b) => a + b, 0),
    inquiries: nums(rs, 'inquiries').reduce((a, b) => a + b, 0),
    deals: nums(rs, 'deals').reduce((a, b) => a + b, 0),
  })).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0));
}

/** 至少几条才下结论（少于这个数只列数据、不说"哪个好"） */
export const MIN_SAMPLE = 3;

export interface PerformanceSummary {
  count: number;
  byPurpose: GroupStat[];
  byTactic: GroupStat[];
  best: PerformanceRow[];
  worst: PerformanceRow[];
  insights: string[];
}

export function summarizePerformance(input: PerformanceRow[]): PerformanceSummary {
  const rows = input.filter((r) => r.metrics && Object.keys(r.metrics).some((k) => k !== 'note' && k !== 'updatedAt'));
  const sorted = [...rows].sort((a, b) => workScore(b.metrics) - workScore(a.metrics));
  const byPurpose = group(rows, (r) => r.purpose);
  const byTactic = group(rows, (r) => r.tactic || r.scriptType);
  const insights: string[] = [];
  if (rows.length < MIN_SAMPLE) {
    insights.push(`目前只有 ${rows.length} 条录了数据，样本太少，先别下结论；多录几条再看规律`);
  } else {
    const roles = byPurpose.filter((g) => g.n >= 2 && g.avgViews !== null);
    if (roles.length >= 2) {
      const [top, bottom] = [roles[0], roles[roles.length - 1]];
      if ((top.avgViews ?? 0) > (bottom.avgViews ?? 0) * 1.5) insights.push(`${top.name}平均播放（${Math.round(top.avgViews!)}）明显高于${bottom.name}（${Math.round(bottom.avgViews!)}）`);
    }
    const money = byPurpose.filter((g) => g.inquiries + g.deals > 0).sort((a, b) => b.inquiries + b.deals - (a.inquiries + a.deals))[0];
    if (money) insights.push(`咨询和成交主要来自${money.name}（共 ${money.inquiries} 个咨询、${money.deals} 单）`);
    const tactics = byTactic.filter((g) => g.n >= 2 && g.avgViews !== null);
    if (tactics.length >= 2) insights.push(`拍法里「${tactics[0].name}」平均播放最高，「${tactics[tactics.length - 1].name}」最低`);
    const lowFinish = rows.filter((r) => typeof r.metrics.completion === 'number' && r.metrics.completion < 15).length;
    if (lowFinish >= 2) insights.push(`有 ${lowFinish} 条完播率低于 15%：开头 3 秒没留住人，优先改开头`);
  }
  return { count: rows.length, byPurpose, byTactic, best: sorted.slice(0, 3), worst: rows.length >= 4 ? sorted.slice(-2).reverse() : [], insights };
}

/**
 * 写进规划类板块（选题、方向、起号、自由对话）的提示词。
 * 没数据返回空串；样本少时只给数据、明确说别当结论。
 */
export function performancePromptBlock(s: PerformanceSummary | null | undefined): string {
  if (!s || s.count === 0) return '';
  const g = (x: GroupStat) => `- ${x.name}（${x.n} 条）：平均播放 ${x.avgViews === null ? '—' : Math.round(x.avgViews)}${x.avgCompletion === null ? '' : `、完播 ${Math.round(x.avgCompletion)}%`}${x.follows ? `、涨粉 ${x.follows}` : ''}${x.inquiries ? `、咨询 ${x.inquiries}` : ''}${x.deals ? `、成交 ${x.deals}` : ''}`;
  const parts = [`### 📈 这个号发出去的真实数据（${s.count} 条录了数据）`, ''];
  if (s.byPurpose.length) parts.push('按三种视频：', ...s.byPurpose.map(g), '');
  if (s.byTactic.length) parts.push('按拍法：', ...s.byTactic.slice(0, 6).map(g), '');
  if (s.best.length) parts.push(`数据最好的：${s.best.map((r) => `「${r.title}」（${metricsLine(r.metrics)}）`).join('；')}`);
  if (s.worst.length) parts.push(`数据最差的：${s.worst.map((r) => `「${r.title}」（${metricsLine(r.metrics)}）`).join('；')}`);
  if (s.insights.length) parts.push('', ...s.insights.map((x) => `- ${x}`));
  parts.push(
    '',
    s.count < MIN_SAMPLE
      ? '⚠️ 样本还少，上面只当参考，不要据此下结论或推翻定位。'
      : '用这些真实数据调整：数据好的方向、拍法多做、往深里挖；数据差的少做或换个拍法再试；别为了"创新"把已经验证有效的东西丢掉。'
  );
  return parts.join('\n');
}
