/**
 * 自动质检（2026-10-03）：每次生成完都体检一遍，记一笔，后台看板看趋势；每晚再拿固定档案回归一次。
 *
 * 查的都是这几天线上真出过的事，规则复用已有的扫描，不另起一套：
 * - taboo      踩禁忌（平台红线 + 行业禁忌词，lib/taboos 的 scanTaboos）
 * - excluded   漏出排除清单里的东西（建档时没选的，lib/interview-exclusions）
 * - mix        配比条数对不上（选题、方向按配比出时，lib/content-mix 的 checkMix）
 * - years      年限和人设事实卡打架（「南乐 18 年」那次：事实卡写半年，结果写 18 年）
 *
 * 纯函数：浏览器（实时体检）和服务器（每晚回归）共用。
 */
import { scanTaboos } from './taboos';
import { findExcludedMentions } from './interview-exclusions';
import { readTabooSettings } from './taboos';
import { readPersonaFacts } from './persona-facts';
import { checkMix, type ResolvedMix } from './content-mix';

export type QualityKind = 'taboo' | 'excluded' | 'mix' | 'years';

export const QUALITY_LABELS: Record<QualityKind, string> = {
  taboo: '踩禁忌',
  excluded: '用了排除的信息',
  mix: '配比对不上',
  years: '年限和人设事实卡不符',
};

export interface QualityIssue {
  kind: QualityKind;
  /** 一句话说清是什么问题（给后台看） */
  detail: string;
}

export interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
}

/** 中文数字也认：十八 → 18、半 → 0.5 */
function toNumber(s: string): number | null {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === '半') return 0.5;
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === '十') return 10;
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? map[m[1]] : 1) * 10 + (m[2] ? map[m[2]] : 0);
  return map[s] ?? null;
}

// 「年级、年代、年前、年后、年底、年轻、年龄……」里的年不是"干了几年"
const YEAR_RE = /(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3}|半)\s*年(?!级|代|前|后|内|底|初|轻|纪|龄|度|份|货|会|终|中|头|夜|糕)/g;

/**
 * 年限打架：结果里"在本地 / 来 / 扎根 / 干了 / 做了 N 年"的 N，事实卡里一个都对不上。
 * 只看这几种说法附近的年数——"2026 年""一年四季"这种不算。
 */
export function yearConflicts(output: string, persona: unknown): string[] {
  const f = readPersonaFacts(persona);
  const factText = [f.yearsInTrade, f.yearsLocal, f.story, f.others].filter(Boolean).join(' ');
  if (!factText) return [];
  const known = new Set<number>();
  for (const m of factText.matchAll(YEAR_RE)) { const n = toNumber(m[1]); if (n !== null) known.add(n); }
  if (/半年/.test(factText)) known.add(0.5);
  if (known.size === 0) return [];
  const out: string[] = [];
  for (const m of output.matchAll(YEAR_RE)) {
    const n = toNumber(m[1]);
    if (n === null || n >= 1900 || known.has(n)) continue;
    const at = m.index ?? 0;
    const before = output.slice(Math.max(0, at - 10), at);
    const after = output.slice(at + m[0].length, at + m[0].length + 3);
    // 说的是"在本地 / 干这行多久"才算：在南乐扎根 18 年、做了 8 年、18 年了、18 年的老店
    const aboutTenure = /在|来|扎根|定居|开了|干了|做了|从业|待了|呆了|变了/.test(before) || /^\s*(?:了|的老店|老店|的经验|经验|的手艺)/.test(after);
    if (!aboutTenure) continue;
    out.push(output.slice(Math.max(0, at - 10), at + m[0].length + 3).replace(/\s+/g, ' ').trim());
  }
  return Array.from(new Set(out)).slice(0, 5);
}

export function runQualityChecks(p: {
  output: string;
  profile: object | null | undefined;
  /** 按配比出的选题、方向：要求的配比和条数 */
  mix?: { resolved: ResolvedMix; count: number } | null;
}): QualityResult {
  const issues: QualityIssue[] = [];
  const profile = (p.profile ?? null) as Record<string, unknown> | null;

  for (const h of scanTaboos(p.output, profile).slice(0, 5)) {
    issues.push({ kind: 'taboo', detail: `「${h.word}」— ${h.taboo.why}` });
  }
  const excluded = readTabooSettings(profile?.taboo_settings).excluded;
  for (const h of findExcludedMentions(p.output, excluded, String(profile?.profile_name ?? '')).slice(0, 5)) {
    issues.push({ kind: 'excluded', detail: `提到了「${h.needle}」：${h.line}` });
  }
  if (p.mix) {
    const c = checkMix(p.output, p.mix.resolved, p.mix.count);
    if (c.counted && !c.ok) issues.push({ kind: 'mix', detail: `实际 ${c.summary}，要求 ${c.expected}${c.got.unknown ? `，${c.got.unknown} 条没标目的` : ''}` });
  }
  for (const y of yearConflicts(p.output, profile?.persona_facts)) {
    issues.push({ kind: 'years', detail: `「${y}」和事实卡对不上` });
  }
  return { passed: issues.length === 0, issues };
}

const KINDS = Object.keys(QUALITY_LABELS) as QualityKind[];

/** 上报的体检结果校验一遍再入库（请求来自浏览器，不能原样信） */
export function sanitizeQualityReport(v: unknown): { task_type: string; profile_id: string | null; passed: boolean; issues: QualityIssue[]; sample: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const task = typeof o.taskType === 'string' ? o.taskType.trim().slice(0, 40) : '';
  if (!task) return null;
  const issues = (Array.isArray(o.issues) ? o.issues : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && KINDS.includes((x as Record<string, unknown>).kind as QualityKind))
    .slice(0, 20)
    .map((x) => ({ kind: x.kind as QualityKind, detail: String(x.detail ?? '').slice(0, 200) }));
  const profileId = typeof o.profileId === 'string' && /^[0-9a-f-]{36}$/i.test(o.profileId) ? o.profileId : null;
  return { task_type: task, profile_id: profileId, passed: issues.length === 0, issues, sample: typeof o.sample === 'string' ? o.sample.slice(0, 300) : '' };
}

export interface QualityRow { task_type: string; source: string; passed: boolean; issues: QualityIssue[]; sample?: string | null; created_at: string }

/** 后台看板的汇总：通过率、哪个板块问题多、最常见的问题、最近不合格的样例、最近一次每晚回归 */
export function summarizeQuality(rows: QualityRow[]) {
  const live = rows.filter((r) => r.source === 'live');
  const failed = live.filter((r) => !r.passed);
  const byTask = new Map<string, { task: string; total: number; failed: number }>();
  for (const r of live) {
    const t = byTask.get(r.task_type) ?? { task: r.task_type, total: 0, failed: 0 };
    t.total++;
    if (!r.passed) t.failed++;
    byTask.set(r.task_type, t);
  }
  const byKind = new Map<QualityKind, number>();
  for (const r of failed) for (const k of new Set(r.issues.map((i) => i.kind))) byKind.set(k, (byKind.get(k) ?? 0) + 1);
  const nightly = rows.filter((r) => r.source === 'nightly').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastNight = nightly[0]?.created_at.slice(0, 10);
  return {
    total: live.length,
    failed: failed.length,
    passRate: live.length ? Math.round(((live.length - failed.length) / live.length) * 1000) / 10 : null,
    byTask: [...byTask.values()].sort((a, b) => b.failed - a.failed || b.total - a.total),
    byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, label: QUALITY_LABELS[kind], count })).sort((a, b) => b.count - a.count),
    recentFailures: failed.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15),
    nightly: lastNight ? nightly.filter((r) => r.created_at.slice(0, 10) === lastNight) : [],
  };
}

/** 同一份结果只报一次（刷新、切回来恢复的不算新生成） */
export function outputKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${text.length}:${h.toString(16)}`;
}
