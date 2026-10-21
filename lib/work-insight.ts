import { CONTENT_ROLE_LIST, ROLE_SPECS, type ContentRole } from '@/lib/content-roles';
import { metricsLine, MIN_SAMPLE, readMetrics, summarizePerformance, type PerformanceRow, type PerformanceSummary } from '@/lib/performance';
import type { ContentMix } from '@/lib/content-mix';
import { SCRIPT_TYPE_LABELS } from '@/lib/creation-settings';

/**
 * 账号作品概况：从作品记录、录入的数据和导入的文件里，算出这个账号的内容配比、三种视频各自的表现，
 * 再由模型给出规划和反馈。规划类板块（选题、方向、起号、自由对话……）通过 creator-context 拿到它。
 *
 * 【怎么保证精准】
 *   - 实际配比只认作品创作时记下的视频目的（脚本或选题的设置），只有一种目的才算进某一类；
 *     写了两种以上的算「多目的」，没写的算「未记录」，都不硬塞进三类。
 *   - 从文件里读出来的标题，由模型按三种视频的定义逐条判断，结果标为「推测」，和确定的配比分开显示。
 *   - 每类数据都标样本数，少于 MIN_SAMPLE 条不下结论。
 *   - 三种视频的定义只有一份：lib/content-roles 的 ROLE_SPECS。
 */

export type RoleBucket = ContentRole | '多目的' | '未记录';

/** 一条作品的视频目的：只认写明的单一目的。「按配比」之类不是某一种视频，算未记录 */
export function roleOfPurpose(purpose: string | null | undefined): RoleBucket {
  const p = (purpose ?? '').trim();
  if (!p) return '未记录';
  const hits = CONTENT_ROLE_LIST.filter((r) => p.includes(r));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return '多目的';
  return '未记录';
}

/** 三类的占比，合计正好 100（最大余数法）；没有数据返回 null */
export function sharesOf(counts: Record<ContentRole, number>): Record<ContentRole, number> | null {
  const total = CONTENT_ROLE_LIST.reduce((s, r) => s + counts[r], 0);
  if (!total) return null;
  const exact = CONTENT_ROLE_LIST.map((r) => ({ r, x: (counts[r] / total) * 100 }));
  const out = Object.fromEntries(exact.map(({ r, x }) => [r, Math.floor(x)])) as Record<ContentRole, number>;
  let left = 100 - CONTENT_ROLE_LIST.reduce((s, r) => s + out[r], 0);
  for (const { r } of [...exact].sort((a, b) => b.x % 1 - a.x % 1)) {
    if (left <= 0) break;
    out[r] += 1;
    left -= 1;
  }
  return out;
}

export interface MixReport {
  total: number;
  /** 各类作品数（含多目的、未记录） */
  counts: Record<RoleBucket, number>;
  /** 只算能确定目的的作品（三类）的占比 */
  shares: Record<ContentRole, number> | null;
  /** 档案里设的计划配比 */
  planned: ContentMix | null;
  /** 偏差说明：只有确定的样本够了才给出 */
  gaps: string[];
}

export function mixReport(works: { purpose?: string | null }[], planned: ContentMix | null): MixReport {
  const counts = { 流量型: 0, 人设型: 0, 变现型: 0, 多目的: 0, 未记录: 0 } as Record<RoleBucket, number>;
  for (const w of works) counts[roleOfPurpose(w.purpose)] += 1;
  const single = { 流量型: counts.流量型, 人设型: counts.人设型, 变现型: counts.变现型 } as Record<ContentRole, number>;
  const shares = sharesOf(single);
  const recorded = CONTENT_ROLE_LIST.reduce((s, r) => s + single[r], 0);
  const gaps: string[] = [];
  if (works.length > recorded) gaps.push(`${works.length - recorded} 条作品没有记录视频目的（或是多目的），不计入配比；在创作时选好目的，配比会更准`);
  if (shares && planned && recorded >= MIN_SAMPLE) {
    for (const r of CONTENT_ROLE_LIST) {
      const d = shares[r] - planned[r];
      if (Math.abs(d) >= 10) gaps.push(`${r}实际占 ${shares[r]}%，档案计划 ${planned[r]}%，${d > 0 ? '偏多' : '偏少'} ${Math.abs(d)} 个百分点`);
    }
  }
  return { total: works.length, counts, shares, planned, gaps };
}

export interface RoleFeedback {
  role: ContentRole;
  n: number;
  /** 样本够不够下结论 */
  enough: boolean;
  line: string;
}

/** 三类各自的数据反馈（只用录了数据的作品），样本少的只列数据、标明不下结论 */
export function roleFeedback(summary: PerformanceSummary): RoleFeedback[] {
  return CONTENT_ROLE_LIST.map((role) => {
    const g = summary.byPurpose.find((x) => x.name === role);
    if (!g) return { role, n: 0, enough: false, line: '还没有录了数据的作品' };
    const parts = [`平均播放 ${g.avgViews === null ? '—' : Math.round(g.avgViews)}`];
    if (g.avgCompletion !== null) parts.push(`完播 ${Math.round(g.avgCompletion)}%`);
    if (g.follows) parts.push(`涨粉 ${g.follows}`);
    if (g.inquiries) parts.push(`咨询 ${g.inquiries}`);
    if (g.deals) parts.push(`成交 ${g.deals}`);
    if (g.rates.inquiries !== undefined) parts.push(`每千播放咨询 ${g.rates.inquiries}`);
    return { role, n: g.n, enough: g.n >= MIN_SAMPLE, line: parts.join('、') };
  });
}

/** 作品记录 + 创作设置 → 数据回流用的行（和 /api/works/performance 同一套口径） */
export function performanceRowsOf(
  works: { id: string; title: string; metrics: unknown; published_at: string | null }[],
  settingsOf: Map<string, Record<string, unknown>>,
): PerformanceRow[] {
  return works.flatMap((w) => {
    const metrics = readMetrics(w.metrics);
    if (!metrics) return [];
    const s = settingsOf.get(w.id) ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return [{
      title: w.title,
      purpose: str(s.purpose),
      tactic: str(s.tactic),
      scriptType: str(s.scriptType) ? SCRIPT_TYPE_LABELS[str(s.scriptType)!] ?? str(s.scriptType) : null,
      metrics,
      platform: metrics.platform || str(s.platform),
      publishedAt: w.published_at,
    }];
  });
}

export { summarizePerformance };

export interface WorkInsight {
  generatedAt: string;
  overview: { works: number; shot: number; published: number; withData: number; materials: number };
  /** 确定的配比：只认作品记录里的视频目的 */
  mix: MixReport;
  /** 三类各自的数据反馈（确定：来自录入的数据） */
  feedback: RoleFeedback[];
  /** 数据层面的提醒（来自 summarizePerformance，只是描述） */
  dataNotes: string[];
  /** 从导入文件里识别出的标题，按类型计数（推测，不计入确定配比） */
  materialMix: { counts: Record<ContentRole | '不确定', number>; total: number } | null;
  /** 从文件里识别出的每一条内容（脚本类型、结构、风格、开篇、人群、是否发布、数据） */
  items: MaterialItem[];
  /** 模型给出的规划、反馈和文件概况（没有模型时为空） */
  planning: string[];
  reviewNotes: string[];
  materialNotes: string[];
  modelUsed: boolean;
  caveats: string[];
}

/**
 * 下一批内容的倾向：档案计划里比实际占比缺得最多的那一类。
 * 只在确定的样本够（MIN_SAMPLE 条）且档案有计划时给；缺口不到 5 个点就说基本符合。
 */
export function nextBatchHint(m: MixReport): string | null {
  const recorded = CONTENT_ROLE_LIST.reduce((s, r) => s + m.counts[r], 0);
  if (!m.shares || !m.planned || recorded < MIN_SAMPLE) return null;
  const planned = m.planned;
  const shares = m.shares;
  const gaps = CONTENT_ROLE_LIST.map((r) => ({ r, d: planned[r] - shares[r] })).sort((a, b) => b.d - a.d);
  const short = gaps.filter((g) => g.d >= 5);
  if (!short.length) return '三类比例和档案计划基本一致，下一批按本次创作目标选题即可';
  return `下一批优先补${short.map((g) => `${g.r}（计划 ${planned[g.r]}%，实际 ${shares[g.r]}%）`).join('、')}；仍以本次创作目标为准，不替用户改目的`;
}

/** 三种视频的定义（全站统一，取自 ROLE_SPECS） */
export function roleDefinitionLines(): string[] {
  return CONTENT_ROLE_LIST.map((r) => `- ${r}：${ROLE_SPECS[r].job}。判断成没成看：${ROLE_SPECS[r].metrics}。`);
}

export interface InsightPromptInput {
  profileSummary: string;
  works: { title: string; role: RoleBucket; tactic?: string | null; status: string; metrics?: string | null }[];
  mix: MixReport;
  feedback: RoleFeedback[];
  dataNotes: string[];
  materialTexts: { name: string; text: string }[];
}

const MATERIAL_CHARS_PER_FILE = 12_000;
const MATERIAL_CHARS_TOTAL = 60_000;
const WORKS_IN_PROMPT = 150;

export function insightPrompt(input: InsightPromptInput): { system: string; user: string } {
  const system = [
    '你是短视频账号的内容复盘分析师。你的任务：根据账号资料、作品记录、录入的数据和导入的文件，做出准确、克制的分析。',
    '',
    '三种视频的定义（全站统一，必须按它判断，不要自己另起定义）：',
    ...roleDefinitionLines(),
    '',
    '铁律：',
    '1. 只用给你的事实。文件里没有写的数字、经历、结果，一律不编；推测要写明「推测」。',
    '2. 样本少（少于 3 条）只描述，不下「哪种更好」的结论；数据是手动录入的观察值，不能证明因果。',
    '3. 「确定配比」只来自作品记录，「识别配比」来自文件里的标题，二者不要混为一谈。',
    '4. 规划要具体到下一步拍哪一类、拍多少条、看什么指标；反馈要说清依据。',
    '5. 只输出一个 JSON 对象，不要任何其他文字。',
    '',
    'JSON 结构：',
    '{"planning": ["3 到 6 条，下一步怎么规划"], "feedback": ["3 到 6 条，哪些做对了、哪些要改、依据是什么"], "materials": ["每个文件一句，说明它是什么、和账号有什么关系"], "items": [{"title": "标题", "file": "来自哪个文件", "role": "流量型|人设型|变现型|不确定", "scriptType": "脚本类型或null", "structure": "结构或null", "style": "风格或null", "opening": "开篇或null", "audience": "人群或null", "published": true|false|null, "views": "文件里的播放量原样或null"}]}',
    'items 放文件里能读出来的每一条内容（视频脚本、已发布或计划中的视频、数据表的一行、选题），最多 150 条；读不出来就给空数组。',
    '每个字段只填文件里写明的；文件里没有的一律写 null。role 按上面三种视频的定义判断，判断不了就写「不确定」。',
  ].join('\n');

  const worksLines = input.works.slice(0, WORKS_IN_PROMPT).map((w) =>
    `- 「${w.title}」｜目的：${w.role}｜拍法：${w.tactic || '未记录'}｜进度：${w.status}${w.metrics ? `｜数据：${w.metrics}` : ''}`);
  let budget = MATERIAL_CHARS_TOTAL;
  const materialBlocks: string[] = [];
  for (const m of input.materialTexts) {
    if (budget <= 0) break;
    const body = m.text.slice(0, Math.min(MATERIAL_CHARS_PER_FILE, budget));
    budget -= body.length;
    materialBlocks.push(`### 文件：${m.name}\n${body}`);
  }
  const user = [
    '## 账号资料',
    input.profileSummary || '（没有档案资料）',
    '',
    '## 确定的配比（作品记录里的视频目的）',
    `作品 ${input.mix.total} 条；三类计数：流量型 ${input.mix.counts.流量型}、人设型 ${input.mix.counts.人设型}、变现型 ${input.mix.counts.变现型}、多目的 ${input.mix.counts.多目的}、未记录 ${input.mix.counts.未记录}`,
    input.mix.shares ? `三类占比：流量型 ${input.mix.shares.流量型}%、人设型 ${input.mix.shares.人设型}%、变现型 ${input.mix.shares.变现型}%` : '三类占比：暂无可计算的数据',
    input.mix.planned ? `档案计划：流量型 ${input.mix.planned.流量型}%、人设型 ${input.mix.planned.人设型}%、变现型 ${input.mix.planned.变现型}%` : '档案没有设置计划配比',
    ...input.mix.gaps.map((g) => `- ${g}`),
    '',
    '## 三类数据反馈（确定，来自录入的数据）',
    ...input.feedback.map((f) => `- ${f.role}（${f.n} 条${f.enough ? '' : '，样本少，不下结论'}）：${f.line}`),
    ...input.dataNotes.map((n) => `- ${n}`),
    '',
    '## 作品清单',
    ...(worksLines.length ? worksLines : ['（还没有作品记录）']),
    '',
    '## 导入的文件',
    ...(materialBlocks.length ? materialBlocks : ['（没有导入文件）']),
  ].join('\n');
  return { system, user };
}

const clip = (s: unknown, n = 220) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => clip(x)).filter(Boolean).slice(0, max) : []);

/**
 * 从导入的文件里识别出的一条内容（一个视频的脚本、一行数据、一个选题）。
 * 只填文件里写明的，没有的字段是 null，不猜。
 */
export interface MaterialItem {
  title: string;
  /** 视频目的（流量型 / 人设型 / 变现型），文件里看不出就是「不确定」 */
  role: ContentRole | '不确定';
  /** 脚本类型，例如教知识、讲故事、聊观点、晒过程 */
  scriptType: string | null;
  /** 结构，例如「反常识开篇 → 常规做法 → 实测 → 收住」 */
  structure: string | null;
  /** 风格，例如口语化、专业、搞笑 */
  style: string | null;
  /** 开篇（前几秒怎么开的，用原文或概括） */
  opening: string | null;
  /** 面向的人群 */
  audience: string | null;
  /** 是否已经发布：文件里写了发布或有播放数据就是 true，写了还没发是 false，看不出是 null */
  published: boolean | null;
  /** 文件里写的播放量等数据（原样，例如「12000」或「1.2 万」），没有就是 null */
  views: string | null;
  /** 来自哪个文件 */
  file: string | null;
}

export interface ParsedInsight {
  planning: string[];
  reviewNotes: string[];
  materialNotes: string[];
  items: MaterialItem[];
}

/** 解析模型的回答。模型没有按格式给 JSON 时返回 null，界面只显示确定的部分 */
export function parseInsightJson(raw: string): ParsedInsight | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? d.items : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => !!x && !!clip(x.title, 200))
    .slice(0, 150)
    .map((x): MaterialItem => {
      const r = clip(x.role, 10);
      const role: ContentRole | '不确定' = (CONTENT_ROLE_LIST as string[]).includes(r) ? (r as ContentRole) : '不确定';
      const text = (v: unknown, n = 160) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
      const published = typeof x.published === 'boolean' ? x.published : null;
      return {
        title: clip(x.title, 200),
        role,
        scriptType: text(x.scriptType, 40),
        structure: text(x.structure, 200),
        style: text(x.style, 80),
        opening: text(x.opening, 200),
        audience: text(x.audience, 120),
        published,
        views: text(x.views, 40),
        file: text(x.file, 200),
      };
    });
  return {
    planning: strings(d.planning, 6),
    reviewNotes: strings(d.feedback, 6),
    materialNotes: strings(d.materials, 8),
    items,
  };
}

/** 识别出的标题按类型计数（推测） */
export function materialMixOf(classified: { role: ContentRole | '不确定' }[]): WorkInsight['materialMix'] {
  if (!classified.length) return null;
  const counts = { 流量型: 0, 人设型: 0, 变现型: 0, 不确定: 0 } as Record<ContentRole | '不确定', number>;
  for (const c of classified) counts[c.role] += 1;
  return { counts, total: classified.length };
}

/** 识别出的内容一句话摘要：条数、已发布几条，脚本类型和人群的分布（出现最多的几个） */
export function itemDigestLine(items: MaterialItem[]): string | null {
  if (!items.length) return null;
  const published = items.filter((i) => i.published === true).length;
  const top = (pick: (i: MaterialItem) => string | null) => {
    const m = new Map<string, number>();
    for (const i of items) {
      const v = pick(i);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, n]) => `${k} ${n} 条`)
      .join('、');
  };
  const parts = [`文件里识别出 ${items.length} 条内容（已发布 ${published} 条）`];
  const types = top((i) => i.scriptType);
  if (types) parts.push(`脚本类型：${types}`);
  const audience = top((i) => i.audience);
  if (audience) parts.push(`人群：${audience}`);
  return `文件里的内容概况（推测）：${parts.join('；')}`;
}

/**
 * 写进规划类板块提示词的「账号作品概况」。没有分析结果返回空串。
 * 三种视频的定义在 lib/content-roles 里，这里只引用，不重复定义。
 */
export function workInsightPromptBlock(insight: WorkInsight | null | undefined): string {
  if (!insight) return '';
  const date = insight.generatedAt.slice(0, 10);
  const parts = [`### 🧭 这个账号的作品概况（${date} 分析）`, ''];
  const m = insight.mix;
  const recorded = CONTENT_ROLE_LIST.reduce((s, r) => s + m.counts[r], 0);
  if (m.shares) {
    parts.push(`确定的配比（按作品记录的目的，${recorded} 条）：流量型 ${m.shares.流量型}%、人设型 ${m.shares.人设型}%、变现型 ${m.shares.变现型}%`);
  } else {
    parts.push('确定的配比：作品记录里还没有能确定目的的作品');
  }
  if (m.planned) parts.push(`档案计划：流量型 ${m.planned.流量型}%、人设型 ${m.planned.人设型}%、变现型 ${m.planned.变现型}%`);
  parts.push(...m.gaps.map((g) => `- ${g}`));
  const hint = nextBatchHint(m);
  if (hint) parts.push(`下一批建议：${hint}`);
  if (insight.materialMix) {
    const c = insight.materialMix.counts;
    parts.push(`导入文件里识别出的标题（推测，共 ${insight.materialMix.total} 条）：流量型 ${c.流量型}、人设型 ${c.人设型}、变现型 ${c.变现型}、不确定 ${c.不确定}`);
  }
  const digest = itemDigestLine(insight.items ?? []);
  if (digest) parts.push(digest);
  parts.push('', '按三种视频的数据反馈（确定，来自录入的数据）：');
  parts.push(...insight.feedback.map((f) => `- ${f.role}（${f.n} 条${f.enough ? '' : '，样本少，不下结论'}）：${f.line}`));
  if (insight.planning.length) parts.push('', '规划建议（基于以上资料）：', ...insight.planning.map((x) => `- ${x}`));
  if (insight.reviewNotes.length) parts.push('', '反馈：', ...insight.reviewNotes.map((x) => `- ${x}`));
  parts.push('', '以上配比和数据只描述账号过去的情况，不是已经验证有效的规律；规划时以本次创作目标为准，不要因为某一类数据好就替用户改目的。');
  return parts.join('\n');
}

export { metricsLine };
