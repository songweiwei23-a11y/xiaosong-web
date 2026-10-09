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
  /** 三秒留存率（%），与完播率不是一回事 */
  retention3s?: number;
  /** 发布后多少小时录下这份数据 */
  observationHours?: number;
  platform?: string;
  /** 未填代表未知，不能默认视为自然流量 */
  paidPromotion?: boolean;
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
  /**
   * 这份数据对应作品的哪一版稿子（2026-10-04）：录数据时服务端取这条作品最新的审稿 / 脚本记录（含画布改稿）。
   * 之后改了稿再拍，复盘时知道哪版数据对应哪版稿子，不会混在一起
   */
  contentVersion?: { historyId: string; taskType: string; at: string };
}

export const METRIC_FIELDS: { key: Exclude<keyof WorkMetrics, 'note' | 'updatedAt' | 'platform' | 'paidPromotion' | 'contentVersion'>; label: string; unit?: string; max: number }[] = [
  { key: 'views', label: '播放', max: 1e9 },
  { key: 'completion', label: '完播率', unit: '%', max: 100 },
  { key: 'likes', label: '点赞', max: 1e8 },
  { key: 'comments', label: '评论', max: 1e8 },
  { key: 'shares', label: '转发', max: 1e8 },
  { key: 'follows', label: '涨粉', max: 1e8 },
  { key: 'inquiries', label: '咨询', max: 1e7 },
  { key: 'deals', label: '成交', max: 1e7 },
  { key: 'retention3s', label: '三秒留存率', unit: '%', max: 100 },
  { key: 'observationHours', label: '发布后观察时长', unit: '小时', max: 8760 },
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
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) out[f.key] = Math.min(f.max, ['completion', 'retention3s', 'observationHours'].includes(f.key) ? Math.round(raw * 10) / 10 : Math.round(raw));
  }
  if (typeof o.platform === 'string' && o.platform.trim()) out.platform = o.platform.trim().slice(0, 40);
  if (typeof o.paidPromotion === 'boolean') out.paidPromotion = o.paidPromotion;
  else if (o.paidPromotion === 'true' || o.paidPromotion === 'false') out.paidPromotion = o.paidPromotion === 'true';
  if (typeof o.note === 'string' && o.note.trim()) out.note = o.note.trim().slice(0, 120);
  if (Object.keys(out).length === 0) return null;
  out.updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString();
  // 对应的稿子版本：只当附带信息，单独有它不算录了数据
  const cv = o.contentVersion as Record<string, unknown> | undefined;
  if (cv && typeof cv === 'object' && typeof cv.historyId === 'string' && /^[0-9a-f-]{36}$/i.test(cv.historyId) && typeof cv.taskType === 'string' && typeof cv.at === 'string') {
    out.contentVersion = { historyId: cv.historyId, taskType: cv.taskType.slice(0, 20), at: cv.at.slice(0, 40) };
  }
  return out;
}

/** 卡片上一行看完："播放 1.2万 · 完播 32% · 咨询 5" */
export function metricsLine(m: WorkMetrics | null | undefined): string {
  if (!m) return '';
  // 12500 → 1.25万（不四舍五入成 1.3 万）；10 万以上留一位小数
  const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 1 : 2).replace(/\.?0+$/, '')}万` : String(n));
  return METRIC_FIELDS.filter((f) => typeof m[f.key] === 'number')
    .map((f) => `${f.label} ${f.unit ? m[f.key] : fmt(m[f.key] as number)}${f.unit ?? ''}`)
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
  platform?: string | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = (rows: PerformanceRow[], k: keyof WorkMetrics) => rows.map((r) => r.metrics[k]).filter((x): x is number => typeof x === 'number');
/** 一条的综合分：以播放为主，互动、涨粉、咨询、成交加权（咨询成交对实体店最值钱） */
export function workScore(m: WorkMetrics, purpose = '流量型'): number {
  const rates = perThousand(m);
  if (/变现|成交|获客|store|lead|sale/i.test(purpose)) return (rates.inquiries ?? 0) * 3 + (rates.deals ?? 0) * 8;
  if (/人设|persona|trust/i.test(purpose)) return (rates.comments ?? 0) + (rates.shares ?? 0) + (m.completion ?? 0) / 10;
  return (rates.follows ?? 0) * 5 + (rates.likes ?? 0) + Math.log10(1 + (m.views ?? 0));
}

type RateKey = 'likes' | 'comments' | 'shares' | 'follows' | 'inquiries' | 'deals';
const RATE_KEYS: RateKey[] = ['likes', 'comments', 'shares', 'follows', 'inquiries', 'deals'];
export function perThousand(m: WorkMetrics): Partial<Record<RateKey, number>> {
  const result: Partial<Record<RateKey, number>> = {};
  if (!m.views || m.views <= 0) return result;
  for (const key of RATE_KEYS) if (typeof m[key] === 'number') result[key] = Math.round(m[key]! / m.views * 1000 * 100) / 100;
  return result;
}
export interface GroupStat { name: string; n: number; avgViews: number | null; avgCompletion: number | null; follows: number; inquiries: number; deals: number; rates: Partial<Record<RateKey, number>> }

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
    rates: Object.fromEntries(RATE_KEYS.flatMap(key => {
      // 只用同时录了播放和该指标的作品，未填写不等于零。
      const paired = rs.filter(r => (r.metrics.views ?? 0) > 0 && typeof r.metrics[key] === 'number');
      if (!paired.length) return [];
      const views = paired.reduce((sum, r) => sum + r.metrics.views!, 0);
      return [[key, Math.round(paired.reduce((sum, r) => sum + r.metrics[key]!, 0) / views * 100000) / 100]];
    })),
  })).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0));
}

/** 至少几条才下结论（少于这个数只列数据、不说"哪个好"） */
export const MIN_SAMPLE = 3;

export interface PerformanceSummary {
  count: number;
  byPurpose: GroupStat[];
  byTactic: GroupStat[];
  byCohort: GroupStat[];
  comparableCount: number;
  comparisonScope: string | null;
  best: PerformanceRow[];
  worst: PerformanceRow[];
  insights: string[];
}

export function summarizePerformance(input: PerformanceRow[]): PerformanceSummary {
  const rows = input.filter((r) => r.metrics && METRIC_FIELDS.some(f => f.key !== 'observationHours' && typeof r.metrics[f.key] === 'number'));
  const byPurpose = group(rows, (r) => r.purpose);
  const byTactic = group(rows, (r) => r.tactic || r.scriptType);
  const cohort = (r: PerformanceRow): string | null => {
    const platform = r.metrics.platform || r.platform;
    const hours = r.metrics.observationHours;
    if (!r.purpose || !platform || !hours || typeof r.metrics.paidPromotion !== 'boolean') return null;
    const window = hours <= 24 ? `${Math.ceil(hours / 6) * 6}小时内` : hours <= 72 ? '1至3天' : hours <= 168 ? '3至7天' : '7天以上';
    return `${r.purpose} · ${platform} · ${window} · ${r.metrics.paidPromotion ? '含投放' : '自然流量'}`;
  };
  const comparable = rows.filter(r => cohort(r) && (r.metrics.views ?? 0) > 0);
  const byCohort = group(comparable, cohort);
  const scoreable = comparable.filter(r => {
    const purpose = r.purpose!;
    if (/变现|成交|获客|store|lead|sale/i.test(purpose)) return typeof r.metrics.inquiries === 'number' || typeof r.metrics.deals === 'number';
    if (/人设|persona|trust/i.test(purpose)) return typeof r.metrics.comments === 'number' || typeof r.metrics.shares === 'number' || typeof r.metrics.completion === 'number';
    return /流量|涨粉|fans/i.test(purpose);
  });
  const scope = group(scoreable, cohort).filter(g => g.n >= MIN_SAMPLE).sort((a, b) => b.n - a.n)[0]?.name ?? null;
  // 只在同一目的/平台/观察窗口/投放情况内比较，不用一套权重混排所有作品。
  const sorted = scope ? scoreable.filter(r => cohort(r) === scope).sort((a, b) => workScore(b.metrics, b.purpose!) - workScore(a.metrics, a.purpose!)) : [];
  const insights: string[] = [];
  if (rows.length < MIN_SAMPLE) {
    insights.push(`目前只有 ${rows.length} 条录了数据，样本太少，先别下结论；多录几条再看规律`);
  } else {
    insights.push('这些是手动录入的观察数据，只作描述和下一轮试验参考，不能证明某种拍法更有效。');
    if (comparable.length < rows.length) insights.push(`${rows.length - comparable.length} 条缺少目的、平台、观察时长、投放情况或有效播放，暂不参加同条件排序。`);
    if (!scope) insights.push(`同条件样本不足 ${MIN_SAMPLE} 条，先补齐数据，再比较具体作品；三条数据也不代表已验证有效。`);
    const lowFinish = rows.filter((r) => typeof r.metrics.completion === 'number' && r.metrics.completion < 15).length;
    if (lowFinish >= 2) insights.push(`有 ${lowFinish} 条完播率低于 15%，可检查时长、受众匹配和内容节奏；仅凭完播率不能判断开头三秒表现。`);
  }
  return { count: rows.length, byPurpose, byTactic, byCohort, comparableCount: comparable.length, comparisonScope: scope, best: sorted.slice(0, 3), worst: sorted.length >= 4 ? sorted.slice(-2).reverse() : [], insights };
}

/**
 * 写进规划类板块（选题、方向、起号、自由对话）的提示词。
 * 没数据返回空串；样本少时只给数据、明确说别当结论。
 */
export function performancePromptBlock(s: PerformanceSummary | null | undefined): string {
  if (!s || s.count === 0) return '';
  const g = (x: GroupStat) => `- ${x.name}（${x.n} 条）：平均播放 ${x.avgViews === null ? '—' : Math.round(x.avgViews)}${x.avgCompletion === null ? '' : `、完播 ${Math.round(x.avgCompletion)}%`}${x.follows ? `、涨粉 ${x.follows}` : ''}${x.inquiries ? `、咨询 ${x.inquiries}` : ''}${x.deals ? `、成交 ${x.deals}` : ''}${x.rates?.inquiries === undefined ? '' : `、每千播放咨询 ${x.rates.inquiries}`}${x.rates?.follows === undefined ? '' : `、每千播放涨粉 ${x.rates.follows}`}${x.rates?.deals === undefined ? '' : `、每千播放成交 ${x.rates.deals}`}`;
  const parts = [`### 📈 这个号发出去的真实数据（${s.count} 条录了数据）`, ''];
  if (s.byPurpose.length) parts.push('按三种视频：', ...s.byPurpose.map(g), '');
  if (s.byTactic.length) parts.push('按拍法：', ...s.byTactic.slice(0, 6).map(g), '');
  if (s.byCohort?.length) parts.push('同目的、同平台、相近观察时间、同投放情况：', ...s.byCohort.slice(0, 8).map(g), '含投放的素材还需考虑投放金额和人群差异。', '');
  if (s.comparisonScope) parts.push(`以下排序只参考「${s.comparisonScope}」，不是全账号排名，也不是已验证结论。`);
  if (s.best.length) parts.push(`本组较高参考项：${s.best.map((r) => `「${r.title}」（${metricsLine(r.metrics)}）`).join('；')}`);
  if (s.worst.length) parts.push(`本组待复盘项：${s.worst.map((r) => `「${r.title}」（${metricsLine(r.metrics)}）`).join('；')}`);
  if (s.insights.length) parts.push('', ...s.insights.map((x) => `- ${x}`));
  parts.push(
    '',
    s.count < MIN_SAMPLE
      ? '⚠️ 样本还少，上面只当参考，不要据此下结论或推翻定位。'
      : '按创作目标提出下一轮对照试验，不因播放低就放弃有咨询的作品，不把相关性写成因果或已验证有效。每千播放指标用于统一分母，缺失项不等于零。没有三秒留存数据，不能断言开头没留住人。'
  );
  return parts.join('\n');
}
