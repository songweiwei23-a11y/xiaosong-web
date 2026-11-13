/**
 * 月度复盘 → 下月策略卡（2026-11-08 产品方：「从底层到产出到结果到复盘到调整接下来的方向，全链路打通」）。
 *
 * 一个档案一张策略卡，每月一次（每月 1 号服务器自动复盘上个月；创作进度里也能随时手动重跑，
 * 手动时可以像诊断账号一样贴自己的抖音主页、让插件采一遍）。
 *   读：这个月做了哪些作品、拍了发了哪些、录了什么数据、导入的后台数据、上个月策略卡里的试验
 *   出：复盘（什么起作用、什么没起作用、上月试验成没成）+ 下月策略卡（最该抓的一件事、配比、多做少做、≤3 个试验、给各板块一句话）
 *   用：策略卡写进规划类板块（选题、方向、内容规划、起号、自由对话、开物助理）全文，写单条的（脚本、二创）两行
 *
 * 产品方定（2026-11-08）：直接生效，可改、可关、可退回上一版；复盘不扣用户额度。
 * 存在 account_work_insights 同一行（insight.review / reviewHistory / reviewMemory / reviewJob），不改库表。
 * 纯函数：不碰数据库和网络（跑复盘在 lib/monthly-review-run）。
 */
import { CONTENT_ROLE_LIST, type ContentRole } from './content-roles';
import { roleDefinitionLines } from './work-insight';

export interface ReviewExperiment {
  /** 试验名（一句话） */
  name: string;
  /** 怎么做：拍什么、几条 */
  how: string;
  /** 怎么算成了：看哪个数、和什么比 */
  success: string;
}

export interface ExperimentResult {
  name: string;
  result: '成了' | '没成' | '数据不够' | '没做';
  evidence: string;
}

export interface ReviewStrategy {
  /** 下个月最该抓的一件事 */
  focus: string;
  /** 建议配比（合计 100）；样本不够或不用调时为 null */
  mix: Record<ContentRole, number> | null;
  mixReason: string;
  doMore: string[];
  doLess: string[];
  experiments: ReviewExperiment[];
  /** 给各板块的一句话：选题 / 创作方向 / 起号 / 脚本 */
  boards: Partial<Record<ReviewBoardLabel, string>>;
}

export const REVIEW_BOARD_LABELS = ['选题', '创作方向', '起号', '脚本'] as const;
export type ReviewBoardLabel = typeof REVIEW_BOARD_LABELS[number];

export interface MonthlyReview {
  /** 复盘的是哪个月 'YYYY-MM' */
  month: string;
  generatedAt: string;
  /** 到哪一天为止（手动复盘本月时不是整月） */
  through: string;
  source: 'auto' | 'manual';
  /** 编导改过 */
  edited?: boolean;
  /** 关掉了：各板块不再读这张卡 */
  off?: boolean;
  summary: string;
  worked: string[];
  notWorked: string[];
  experimentResults: ExperimentResult[];
  strategy: ReviewStrategy;
  dataGaps: string[];
  /** 读到了哪些材料（一句一项） */
  materials: string[];
  /** 没记目的的作品，模型按三种视频的定义推测的（2026-11-09 第三步）：只是推测，不算进确定配比 */
  inferred?: InferredPurpose[];
}

export interface InferredPurpose { title: string; purpose: ContentRole; why: string }

/** 跨月份留下的经验：试成了的打法长期生效，试过没成的别再推荐 */
export interface ReviewMemory {
  verified: { name: string; month: string; evidence: string }[];
  dropped: { name: string; month: string; evidence: string }[];
}

export interface ReviewJob {
  month: string;
  startedAt: string;
  /** 跑完了还是失败了；没有就是还在跑 */
  finishedAt?: string;
  error?: string;
}

export const REVIEW_HISTORY_MAX = 6;
const MEMORY_MAX = 12;
/** 策略卡超过这么多天没更新：板块上提醒；超过 STALE_DROP_DAYS 不再写进提示词 */
export const STALE_WARN_DAYS = 45;
export const STALE_DROP_DAYS = 75;
/** 复盘任务超过这么久还没跑完，当作已经断了（进程重启之类），允许重跑 */
export const JOB_STALE_MS = 10 * 60_000;

const BJ = 8 * 3600_000;
/** 北京时间的 'YYYY-MM' */
export function monthKeyCN(iso: string | number | null | undefined): string | null {
  if (iso === null || iso === undefined || iso === '') return null;
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + BJ).toISOString().slice(0, 7);
}
export function reviewMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}
/**
 * 手动复盘默认复盘哪个月：每月前 7 天复盘上个月（刚过完），之后复盘本月到今天为止。
 * 自动复盘（每月 1 号）固定复盘上个月。
 */
export function defaultReviewMonth(now = Date.now()): string {
  const d = new Date(now + BJ);
  if (d.getUTCDate() <= 7) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}
export function previousMonthCN(now = Date.now()): string {
  const d = new Date(now + BJ);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}
export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface ReviewWork {
  title: string;
  created_at?: string | null;
  shot_at?: string | null;
  published_at?: string | null;
  status: string;
  purpose: string | null;
  tactic: string | null;
  metrics: string | null;
}

/** 这个月有动静的作品：这个月建的、拍的或发的 */
export function worksInMonth<T extends { created_at?: string | null; shot_at?: string | null; published_at?: string | null }>(works: T[], month: string): T[] {
  return works.filter((w) => [w.created_at, w.shot_at, w.published_at].some((t) => monthKeyCN(t) === month));
}

export interface ReviewPromptInput {
  month: string;
  today: string;
  through: string;
  profileSummary: string;
  works: ReviewWork[];
  /** 全部作品里录了数据的汇总（lib/performance 的 performancePromptBlock） */
  performanceBlock: string;
  /** 作品概况（确定配比、计划配比、三类反馈），不带诊断 */
  insightBlock: string;
  /** 账号诊断的要点（有就给，只拿核心诊断那一节） */
  diagnosisKey: string;
  previous: MonthlyReview | null;
  memory: ReviewMemory;
  /** 插件刚采的自己主页（lib/benchmark-collection 的 formatCollection），手动复盘时才有 */
  collectedText: string;
  /** 导入的文件（抖音后台导出的数据表等） */
  fileTexts: { name: string; text: string }[];
}

const FILE_CHARS = 10_000;
const FILES_TOTAL = 30_000;
const COLLECT_CHARS = 30_000;
const WORKS_MAX = 120;

export function buildReviewPrompt(input: ReviewPromptInput): { system: string; user: string } {
  const system = [
    '你是做实体店短视频代运营的资深编导，每个月给自己负责的账号做一次复盘，并定下个月的策略卡。策略卡会直接交给开物的选题、创作方向、内容规划、起号、脚本等板块执行。',
    `今天是 ${input.today}。复盘的是 ${reviewMonthLabel(input.month)}（材料截至 ${input.through}）。材料里出现的日期都是真实发生过的，不要当成未来或异常。`,
    '',
    '三种视频的定义（全站统一，按它判断）：',
    ...roleDefinitionLines(),
    '',
    '大流量的判断标准：从出发点（内容定位、用户群体、目的、人货场之一、有用有趣有共鸣之一）加爆款元素去设计选题和脚本；形式（口播、剧情、Vlog）不决定流量，策略卡不要把「换个形式」当成主要打法。',
    '',
    '铁律：',
    '1. 只用给你的材料。材料里没有的数字、结果、经历一律不编；推测要写明「推测」。',
    '2. 数据是手动录入或采集的观察值，只说「相关」，不写成因果；某一类样本少于 3 条，不下「哪种更好」的结论，只当倾向。',
    '3. 每条「起作用 / 没起作用」都要在括号里标依据（作品标题、数据、文件名、采集到的作品）。',
    '4. 上个月策略卡里的每个试验都要逐条判：成了 / 没成 / 数据不够 / 没做，并写依据。判「成了」「没成」必须有对应的数据，没有就判「数据不够」。',
    '5. 账号定位、内容定位是老板定的方向：策略卡只在这个框架里调整倾向（多做什么、少做什么、配比怎么调），不推翻定位、不替老板改目的。',
    '6. 「已验证有效」的打法继续用；「试过没成」的不要再当试验或建议推荐。',
    '7. 新试验最多 3 个，每个都要能在一个月里做完、能用录入的数据判断：写清拍什么、几条、看哪个数、和什么比（和自己前几条比，不写绝对合格线）。',
    '8. 给各板块的一句话要具体到能直接执行（多出哪类选题、哪个母题、开头怎么开、结尾动作），不写「可以考虑」「建议加强」这种空话。',
    '9. 材料很少（这个月没有作品、没有任何数据）时：summary 说清楚缺什么，strategy 只给最稳的一件事，experiments 给 1 个最容易做的，不要硬下结论。',
    '10. 作品清单里「目的：未记录」的作品，按上面三种视频的定义推测它是哪一类，放进 inferred，写一句依据；判断不了的不放。推测的不算进确定配比，分析里用到时写明「推测」。',
    '11. 只输出一个 JSON 对象，不要任何其他文字。',
    '',
    'JSON 结构：',
    '{"summary": "一句话：这个月整体怎么样（不超过 60 字）",',
    ' "worked": ["起作用的，2 到 5 条，每条带依据"],',
    ' "notWorked": ["没起作用的，0 到 5 条，每条带依据"],',
    ' "experimentResults": [{"name": "上月试验名，原样", "result": "成了|没成|数据不够|没做", "evidence": "依据"}],',
    ' "strategy": {',
    '   "focus": "下个月最该抓的一件事（不超过 40 字）",',
    '   "mix": {"流量型": 数字, "人设型": 数字, "变现型": 数字} 或 null（合计 100；样本不够、不用调就给 null）,',
    '   "mixReason": "为什么这样配（不用调就写不用调的理由）",',
    '   "doMore": ["多做什么，1 到 4 条"], "doLess": ["少做什么，0 到 3 条"],',
    '   "experiments": [{"name": "试验名", "how": "怎么做", "success": "怎么算成了"}],',
    '   "boards": {"选题": "一句话", "创作方向": "一句话", "起号": "一句话", "脚本": "一句话"}',
    ' },',
    ' "dataGaps": ["缺什么材料，补了能复盘得更准，0 到 4 条"],',
    ' "inferred": [{"title": "目的未记录的作品标题，原样", "purpose": "流量型|人设型|变现型", "why": "依据，不超过 20 字"}]}',
  ].join('\n');

  let budget = FILES_TOTAL;
  const files: string[] = [];
  for (const f of input.fileTexts) {
    if (budget <= 0) break;
    const body = f.text.slice(0, Math.min(FILE_CHARS, budget));
    budget -= body.length;
    files.push(`### 文件：${f.name}\n${body}`);
  }
  const prev = input.previous;
  const prevBlock = prev
    ? [
        `上一张策略卡（${reviewMonthLabel(prev.month)}复盘定的）：`,
        `- 最该抓：${prev.strategy.focus || '（没写）'}`,
        prev.strategy.mix ? `- 配比：${CONTENT_ROLE_LIST.map((r) => `${r} ${prev.strategy.mix![r]}%`).join('、')}` : '',
        ...prev.strategy.doMore.map((x) => `- 多做：${x}`),
        ...prev.strategy.doLess.map((x) => `- 少做：${x}`),
        '试验（这次要逐条判）：',
        ...(prev.strategy.experiments.length ? prev.strategy.experiments.map((e) => `- ${e.name}｜怎么做：${e.how}｜怎么算成了：${e.success}`) : ['- （上一张卡没有试验）']),
      ].filter(Boolean).join('\n')
    : '（这是第一次复盘，没有上一张策略卡；experimentResults 给空数组）';
  const memoryBlock = [
    input.memory.verified.length ? `已验证有效（继续用）：\n${input.memory.verified.map((v) => `- ${v.name}（${reviewMonthLabel(v.month)}：${v.evidence}）`).join('\n')}` : '',
    input.memory.dropped.length ? `试过没成（不要再推荐）：\n${input.memory.dropped.map((v) => `- ${v.name}（${reviewMonthLabel(v.month)}：${v.evidence}）`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n') || '（还没有积累下来的经验）';
  const works = input.works.slice(0, WORKS_MAX).map((w) =>
    `- 「${w.title}」｜${w.status}｜目的：${w.purpose || '未记录'}｜拍法：${w.tactic || '未记录'}${w.metrics ? `｜数据：${w.metrics}` : '｜没录数据'}`);

  const user = [
    '## 账号资料',
    input.profileSummary || '（没有档案资料）',
    '',
    `## ${reviewMonthLabel(input.month)}的作品（这个月建的、拍的或发的，共 ${input.works.length} 条）`,
    ...(works.length ? works : ['（这个月没有作品记录）']),
    '',
    '## 全部作品录的数据（含以前的月份，用来和这个月比）',
    input.performanceBlock.trim() || '（还没有录了数据的作品）',
    '',
    '## 作品概况（确定配比、档案计划配比、三类反馈）',
    input.insightBlock.trim() || '（还没有作品概况）',
    '',
    '## 账号诊断要点',
    input.diagnosisKey.trim() || '（还没做过账号诊断）',
    '',
    '## 上一张策略卡',
    prevBlock,
    '',
    '## 这个号积累下来的经验',
    memoryBlock,
    '',
    '## 插件刚采集的自己主页',
    input.collectedText.trim() ? input.collectedText.slice(0, COLLECT_CHARS) : '（这次没有采集主页）',
    '',
    '## 导入的文件（抖音后台导出的数据、脚本等）',
    ...(files.length ? files : ['（没有导入文件）']),
  ].join('\n');
  return { system, user };
}

const clip = (v: unknown, n = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const list = (v: unknown, max: number, n = 200) => (Array.isArray(v) ? v.map((x) => clip(x, n)).filter(Boolean).slice(0, max) : []);
const RESULTS = ['成了', '没成', '数据不够', '没做'] as const;

/** 配比：三类都是非负数、合计 100（差一两个点按比例修正）；不像配比就是 null */
export function readMix(v: unknown): Record<ContentRole, number> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const raw = CONTENT_ROLE_LIST.map((r) => Number(o[r]));
  if (raw.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum < 90 || sum > 110) return null;
  const scaled = raw.map((x) => Math.round((x / sum) * 100));
  scaled[0] += 100 - scaled.reduce((a, b) => a + b, 0);
  return Object.fromEntries(CONTENT_ROLE_LIST.map((r, i) => [r, scaled[i]])) as Record<ContentRole, number>;
}

export function readStrategy(v: unknown): ReviewStrategy {
  const s = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const boardsRaw = (s.boards && typeof s.boards === 'object' ? s.boards : {}) as Record<string, unknown>;
  const boards: ReviewStrategy['boards'] = {};
  for (const b of REVIEW_BOARD_LABELS) { const t = clip(boardsRaw[b], 160); if (t) boards[b] = t; }
  const experiments = (Array.isArray(s.experiments) ? s.experiments : [])
    .map((e) => (e && typeof e === 'object' ? e as Record<string, unknown> : null))
    .filter((e): e is Record<string, unknown> => !!e && !!clip(e.name, 60))
    .slice(0, 3)
    .map((e) => ({ name: clip(e.name, 60), how: clip(e.how, 160), success: clip(e.success, 160) }));
  return {
    focus: clip(s.focus, 80),
    mix: readMix(s.mix),
    mixReason: clip(s.mixReason, 160),
    doMore: list(s.doMore, 4, 120),
    doLess: list(s.doLess, 3, 120),
    experiments,
    boards,
  };
}

/** 解析模型的回答；没按格式给或者连「最该抓的一件事」都没有，返回 null（不覆盖原来的卡） */
export function parseReviewJson(raw: string): Omit<MonthlyReview, 'month' | 'generatedAt' | 'through' | 'source' | 'materials'> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let d: Record<string, unknown>;
  try { 
    d = JSON.parse(raw.slice(start, end + 1)); 
  } catch (e) {
    // 尝试修复常见的JSON格式问题
    try {
      // 移除可能的markdown代码块标记
      let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const start2 = cleaned.indexOf('{');
      const end2 = cleaned.lastIndexOf('}');
      if (start2 >= 0 && end2 > start2) {
        d = JSON.parse(cleaned.slice(start2, end2 + 1));
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== 'object') return null;
  const strategy = readStrategy(d.strategy);
  if (!strategy.focus) return null;
  const experimentResults = (Array.isArray(d.experimentResults) ? d.experimentResults : [])
    .map((e) => (e && typeof e === 'object' ? e as Record<string, unknown> : null))
    .filter((e): e is Record<string, unknown> => !!e && !!clip(e.name, 60))
    .slice(0, 6)
    .map((e) => ({
      name: clip(e.name, 60),
      result: (RESULTS as readonly string[]).includes(clip(e.result, 6)) ? clip(e.result, 6) as ExperimentResult['result'] : '数据不够',
      evidence: clip(e.evidence, 200),
    }));
  const inferred = (Array.isArray(d.inferred) ? d.inferred : [])
    .map((e) => (e && typeof e === 'object' ? e as Record<string, unknown> : null))
    .filter((e): e is Record<string, unknown> => !!e && !!clip(e.title, 120) && (CONTENT_ROLE_LIST as string[]).includes(clip(e.purpose, 6)))
    .slice(0, 60)
    .map((e) => ({ title: clip(e.title, 120), purpose: clip(e.purpose, 6) as ContentRole, why: clip(e.why, 60) }));
  return {
    summary: clip(d.summary, 120),
    worked: list(d.worked, 5),
    notWorked: list(d.notWorked, 5),
    experimentResults,
    strategy,
    dataGaps: list(d.dataGaps, 4),
    inferred,
  };
}

/** 推测的目的只留真的是「这个月、没记目的」的作品（模型可能改了标题或编了一条） */
export function keepInferredFor(inferred: InferredPurpose[] | undefined, works: { title: string; purpose: string | null }[]): InferredPurpose[] {
  const unrecorded = new Set(works.filter((w) => !w.purpose).map((w) => w.title.trim()));
  const seen = new Set<string>();
  return (inferred ?? []).filter((x) => unrecorded.has(x.title) && !seen.has(x.title) && (seen.add(x.title), true));
}

export interface ReviewDataStatus {
  month: string;
  /** 这个月发布的 */
  published: number;
  /** 其中录了数据的 */
  withData: number;
  /** 发布了还没录数据的标题（最多 8 条） */
  missing: string[];
  /** 这个月有动静、但没记视频目的的作品条数（复盘时会推测） */
  noPurpose: number;
}

/** 复盘前看一眼数据齐不齐：这个月发布的作品里几条录了数据、几条没记目的 */
export function reviewDataStatus(
  works: { title: string; published_at?: string | null; shoot_status?: string | null; created_at?: string | null; shot_at?: string | null; hasData: boolean; purpose: string | null }[],
  month: string,
): ReviewDataStatus {
  const published = works.filter((w) => monthKeyCN(w.published_at) === month);
  const missing = published.filter((w) => !w.hasData);
  return {
    month,
    published: published.length,
    withData: published.length - missing.length,
    missing: missing.map((w) => w.title).slice(0, 8),
    noPurpose: worksInMonth(works, month).filter((w) => !w.purpose).length,
  };
}

/** 试验结论写进长期经验：成了的进「已验证」，没成的进「试过没成」；同名的以最新为准 */
export function mergeMemory(memory: ReviewMemory | null | undefined, review: Pick<MonthlyReview, 'month' | 'experimentResults'>): ReviewMemory {
  const base: ReviewMemory = { verified: [...(memory?.verified ?? [])], dropped: [...(memory?.dropped ?? [])] };
  for (const r of review.experimentResults) {
    if (r.result !== '成了' && r.result !== '没成') continue;
    const entry = { name: r.name, month: review.month, evidence: r.evidence };
    base.verified = base.verified.filter((x) => x.name !== r.name);
    base.dropped = base.dropped.filter((x) => x.name !== r.name);
    (r.result === '成了' ? base.verified : base.dropped).unshift(entry);
  }
  return { verified: base.verified.slice(0, MEMORY_MAX), dropped: base.dropped.slice(0, MEMORY_MAX) };
}

export interface ReviewSlot {
  review?: MonthlyReview | null;
  reviewHistory?: MonthlyReview[];
  reviewMemory?: ReviewMemory | null;
  reviewJob?: ReviewJob | null;
}

/** 只取复盘那几项（别的接口重建这一行时原样带上，不冲掉） */
export function keepReviewSlot(row: ReviewSlot): ReviewSlot {
  const out: ReviewSlot = {};
  if (row.review !== undefined) out.review = row.review;
  if (row.reviewHistory !== undefined) out.reviewHistory = row.reviewHistory;
  if (row.reviewMemory !== undefined) out.reviewMemory = row.reviewMemory;
  if (row.reviewJob !== undefined) out.reviewJob = row.reviewJob;
  return out;
}

/** 新的复盘上岗：旧的进历史（最多 6 份），试验结论进长期经验 */
export function installReview<T extends ReviewSlot>(row: T, review: MonthlyReview): T {
  const history = row.review ? [row.review, ...(row.reviewHistory ?? [])].slice(0, REVIEW_HISTORY_MAX) : (row.reviewHistory ?? []);
  return { ...row, review, reviewHistory: history, reviewMemory: mergeMemory(row.reviewMemory, review) };
}

/** 退回上一版：历史里第 index 份回到当前，当前这份放进历史 */
export function rollbackReview<T extends ReviewSlot>(row: T, index: number): T | null {
  const history = row.reviewHistory ?? [];
  const target = history[index];
  if (!target) return null;
  const rest = history.filter((_, i) => i !== index);
  const nextHistory = row.review ? [row.review, ...rest].slice(0, REVIEW_HISTORY_MAX) : rest;
  return { ...row, review: { ...target, off: false }, reviewHistory: nextHistory };
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.floor((now - t) / 86400_000) : null;
}

export type ReviewFreshness = 'none' | 'off' | 'fresh' | 'stale' | 'expired';
export function reviewFreshness(review: MonthlyReview | null | undefined, now = Date.now()): ReviewFreshness {
  if (!review) return 'none';
  if (review.off) return 'off';
  const d = daysSince(review.generatedAt, now) ?? Infinity;
  if (d > STALE_DROP_DAYS) return 'expired';
  if (d > STALE_WARN_DAYS) return 'stale';
  return 'fresh';
}

/**
 * 写进提示词的策略卡：
 *   planning 规划类板块（选题、方向、内容规划、起号、自由对话、助理）：整张卡 + 长期经验
 *   single   写单条的（脚本、二创）：最该抓的一件事 + 给脚本的那一句
 * 关掉的、超过 75 天的不写。
 */
export function reviewPromptBlock(slot: ReviewSlot | null | undefined, scope: 'planning' | 'single' | null | undefined, boardLabel: ReviewBoardLabel | null, now = Date.now()): string {
  const r = slot?.review;
  if (!scope || !r) return '';
  const fresh = reviewFreshness(r, now);
  if (fresh === 'off' || fresh === 'expired' || fresh === 'none') return '';
  const s = r.strategy;
  const head = `### 🔁 本月策略卡（${reviewMonthLabel(r.month)}复盘定的，${r.generatedAt.slice(0, 10)}${r.edited ? '，编导改过' : ''}）`;
  const staleNote = fresh === 'stale' ? '（这张卡已经超过 45 天没更新，只当参考）' : '';
  if (scope === 'single') {
    const lines = [s.focus && `- 这个月最该抓：${s.focus}`, s.boards['脚本'] && `- 给脚本：${s.boards['脚本']}`].filter(Boolean);
    if (!lines.length) return '';
    return [head, ...lines, `这是账号层面的倾向，和本条的选题、目的冲突时以本条为准。${staleNote}`].join('\n');
  }
  const memory = slot?.reviewMemory;
  const boardLines = boardLabel
    ? [s.boards[boardLabel] && `- 给${boardLabel}：${s.boards[boardLabel]}`]
    : REVIEW_BOARD_LABELS.map((b) => s.boards[b] && `- 给${b}：${s.boards[b]}`);
  const parts = [
    head,
    s.focus && `- 这个月最该抓：${s.focus}`,
    s.mix && `- 建议配比：${CONTENT_ROLE_LIST.map((x) => `${x} ${s.mix![x]}%`).join('、')}${s.mixReason ? `（${s.mixReason}）` : ''}`,
    ...s.doMore.map((x) => `- 多做：${x}`),
    ...s.doLess.map((x) => `- 少做：${x}`),
    ...s.experiments.map((e) => `- 本月试验：${e.name}——${e.how}${e.success ? `（怎么算成了：${e.success}）` : ''}`),
    ...boardLines,
    memory?.verified.length ? `- 这个号验证过有效的：${memory.verified.slice(0, 6).map((v) => v.name).join('；')}` : '',
    memory?.dropped.length ? `- 试过没成、不要再推荐：${memory.dropped.slice(0, 6).map((v) => v.name).join('；')}` : '',
    '',
    `策略卡是上个月复盘定下的倾向：本次用户选的目的、方向和要求优先；它只调整多做什么、少做什么，不替用户改目的、不推翻账号定位；试验可以在这一批里安排一两条，不用每条都做。${staleNote}`,
  ];
  return parts.filter((x): x is string => typeof x === 'string').join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 复盘写成可读的全文：永久存档（script_history）和页面「历次复盘」都用它 */
export function reviewToMarkdown(r: MonthlyReview): string {
  const s = r.strategy;
  const sec = (title: string, items: string[]) => (items.length ? [`### ${title}`, ...items.map((x) => `- ${x}`), ''] : []);
  return [
    `## ${reviewMonthLabel(r.month)}复盘（截至 ${r.through}，${r.source === 'auto' ? '每月自动' : '手动'}复盘${r.edited ? '，编导改过' : ''}）`,
    '',
    r.summary,
    '',
    ...sec('起作用的', r.worked),
    ...sec('没起作用的', r.notWorked),
    ...sec('上月试验', r.experimentResults.map((e) => `${e.name}：**${e.result}**${e.evidence ? `（${e.evidence}）` : ''}`)),
    '## 下月策略卡',
    '',
    `**最该抓的一件事**：${s.focus}`,
    '',
    s.mix ? `**建议配比**：${CONTENT_ROLE_LIST.map((x) => `${x} ${s.mix![x]}%`).join('、')}${s.mixReason ? `（${s.mixReason}）` : ''}` : `**配比**：${s.mixReason || '暂不调整'}`,
    '',
    ...sec('多做', s.doMore),
    ...sec('少做', s.doLess),
    ...sec('本月试验', s.experiments.map((e) => `${e.name}——${e.how}${e.success ? `（怎么算成了：${e.success}）` : ''}`)),
    ...sec('给各板块', REVIEW_BOARD_LABELS.filter((b) => s.boards[b]).map((b) => `${b}：${s.boards[b]}`)),
    ...sec('没记目的的作品（推测，不算进确定配比）', (r.inferred ?? []).map((x) => `${x.title}：${x.purpose}${x.why ? `（${x.why}）` : ''}`)),
    ...sec('补了能复盘得更准', r.dataGaps),
    ...sec('读到的材料', r.materials),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 编导在页面上改的策略卡：只收认识的字段 */
export function sanitizeEditedStrategy(v: unknown): ReviewStrategy | null {
  const s = readStrategy(v);
  return s.focus ? s : null;
}
