/**
 * 内容配比：流量型 / 人设型 / 变现型 各占多少——全站唯一出处。
 *
 * 【2026-10-02 产品方】"内容定位、创作简报，包括其他板块在生成选题或策划内容的时候，
 * 让用户自己选配比，或者根据账号阶段系统推荐正确的配比，不然生成的结果跟预期差距会很大。"
 *
 * 【原来的问题】配比只存在于 AI 写的定位文字里，简报再抄一遍；选题页的「按配比」只是一句
 * "照定位里的配比分"。用户没地方定、系统里没有一个确定的数、生成完也没人核对——同一份档案
 * 每次理解得都不一样。知识库对新号只说"流量型最大、变现型小头"，没给数字，模型只能猜。
 *
 * 【现在】
 * - 只管"目的"这一层（流量 / 人设 / 变现）；用知识、故事还是晒过程，交给 AI 按定位配
 * - 生效顺序：这次临时改的 → 档案里设的 → 系统按账号阶段推荐
 * - 给模型时换算成条数（"流量型 6 条"比"60%"准得多），生成完由代码数一遍、对不上就提醒
 */
import { CONTENT_ROLE_LIST, type ContentRole } from './content-roles';

export type ContentMix = Record<ContentRole, number>;
export type MixPreset = 'auto' | 'traffic' | 'balanced' | 'convert' | 'custom';

/** 存在档案 content_mix 列里的样子 */
export interface MixSetting {
  preset: MixPreset;
  /** preset 为 custom 时的自定义值（百分比，三项和为 100） */
  custom?: ContentMix;
}

export const PRESETS: { id: MixPreset; label: string; hint: string; mix?: ContentMix }[] = [
  { id: 'auto', label: '系统推荐', hint: '按账号阶段和变现方式自动定' },
  { id: 'traffic', label: '引流优先', hint: '先把播放和粉丝做起来', mix: { 流量型: 70, 人设型: 20, 变现型: 10 } },
  { id: 'balanced', label: '均衡', hint: '三种都要，比较平均', mix: { 流量型: 40, 人设型: 30, 变现型: 30 } },
  { id: 'convert', label: '成交优先', hint: '多拍能带来咨询和订单的', mix: { 流量型: 25, 人设型: 20, 变现型: 55 } },
  { id: 'custom', label: '自定义', hint: '自己拖到想要的比例' },
];

/**
 * 账号阶段 → 推荐配比。
 * - 刚起号：知识库（小黄第40节、内容配比第一步）"流量型必须是最大的一块，变现型从第一周就要有但只占小头"——数字是我们按这句话定的
 * - 稳定运营：代运营 SOP 原数 变现50 / 人设20 / 流量30
 * - 中间那档是过渡；成熟期要突破，需要重新拉新，流量型往回加
 */
export const STAGE_MIX: { stage: string; mix: ContentMix; why: string }[] = [
  { stage: '刚起号，定位未确定', mix: { 流量型: 60, 人设型: 25, 变现型: 15 }, why: '刚起号先拿稳定流量和正反馈，流量型最大；变现型第一周就有，但只占小头，免得像广告号' },
  { stage: '有定位，需要内容方向', mix: { 流量型: 45, 人设型: 25, 变现型: 30 }, why: '流量开始稳了，变现型慢慢长上来，流量型仍然是主力' },
  { stage: '稳定运营，需要新选题', mix: { 流量型: 30, 人设型: 20, 变现型: 50 }, why: '流量已经稳定，按代运营 SOP 的标准配比，变现型占一半' },
  { stage: '成熟期，需要突破', mix: { 流量型: 40, 人设型: 30, 变现型: 30 }, why: '成熟期要突破，得重新拉新人、加深人设，流量型和人设型往回加' },
];

/** 没填账号阶段时用过渡档 */
const FALLBACK = STAGE_MIX[1];

export interface ResolvedMix {
  mix: ContentMix;
  /** 从哪来：这次临时改的 / 档案设置 / 系统推荐 */
  source: 'override' | 'profile' | 'auto';
  /** 给人看的一句话：「档案设置·均衡」「系统推荐（刚起号）」 */
  label: string;
  /** 为什么是这个比例（系统推荐时才有） */
  reason?: string;
}

interface ProfileLike {
  account_stage?: unknown;
  monetization_model?: unknown;
  content_mix?: unknown;
}

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];

/** 归一成三项、5 的倍数、和为 100；最后的零头补给最大的一项 */
export function normalizeMix(m: Partial<Record<ContentRole, unknown>>): ContentMix {
  const raw = CONTENT_ROLE_LIST.map((r) => Math.max(0, Number(m[r]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...FALLBACK.mix };
  const scaled = raw.map((v) => Math.round(((v / sum) * 100) / 5) * 5);
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  const top = scaled.indexOf(Math.max(...scaled));
  scaled[top] += diff;
  return Object.fromEntries(CONTENT_ROLE_LIST.map((r, i) => [r, scaled[i]])) as ContentMix;
}

/** 从一个角色挪 n 个点给另一个，挪出的那个不低于 floor */
function shift(m: ContentMix, from: ContentRole, to: ContentRole, n: number, floor: number): ContentMix {
  const move = Math.max(0, Math.min(n, m[from] - floor));
  return { ...m, [from]: m[from] - move, [to]: m[to] + move };
}

/**
 * 系统推荐：按账号阶段定底，再按变现方式和用户写的目标微调。
 * goal 是用户在这次生成里写的要求 / 补充说明（可选）。
 */
export function recommendMix(profile: object | null | undefined, goal = ''): { mix: ContentMix; reason: string } {
  const p = profile as ProfileLike | null | undefined;
  const stage = typeof p?.account_stage === 'string' ? p.account_stage : '';
  const base = STAGE_MIX.find((s) => s.stage === stage) ?? FALLBACK;
  let mix = { ...base.mix };
  const reasons = [stage ? `${stage}：${base.why}` : `档案没填账号阶段，按过渡期给：${FALLBACK.why}`];

  const money = asList(p?.monetization_model);
  if (money.length > 0 && money.every((x) => x === '暂不考虑')) {
    mix = shift(mix, '变现型', '流量型', 100, 10);
    reasons.push('变现方式写的是「暂不考虑」，变现型压到 10%');
  }
  if (/大流量|涨粉|曝光|影响力|做博主|上热门/.test(goal)) {
    mix = shift(mix, '变现型', '流量型', 10, 10);
    reasons.push('你要的是流量和曝光，流量型再加 10%');
  } else if (/精准客户|只要成交|不在乎播放|多卖|带货|转化/.test(goal)) {
    mix = shift(mix, '流量型', '变现型', 10, 20);
    reasons.push('你要的是成交，变现型再加 10%');
  }
  return { mix: normalizeMix(mix), reason: reasons.join('；') };
}

/** 档案 content_mix 列读出来的值，做一遍校验；不认识的当没设 */
export function readSetting(v: unknown): MixSetting | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<MixSetting>;
  if (!PRESETS.some((x) => x.id === s.preset)) return null;
  if (s.preset === 'custom') return s.custom ? { preset: 'custom', custom: normalizeMix(s.custom) } : null;
  return { preset: s.preset as MixPreset };
}

function mixOfSetting(s: MixSetting, p: ProfileLike | null | undefined, goal: string): { mix: ContentMix; reason?: string } {
  if (s.preset === 'custom' && s.custom) return { mix: normalizeMix(s.custom) };
  const preset = PRESETS.find((x) => x.id === s.preset);
  if (preset?.mix) return { mix: { ...preset.mix } };
  return recommendMix(p, goal);
}

export const presetLabel = (s: MixSetting) => PRESETS.find((x) => x.id === s.preset)?.label ?? '系统推荐';

/**
 * 这次生成到底按什么配比：这次临时改的 → 档案里设的 → 系统推荐。
 */
export function resolveMix(profile: object | null | undefined, override?: MixSetting | null, goal = ''): ResolvedMix {
  const p = profile as ProfileLike | null | undefined;
  if (override) {
    const { mix, reason } = mixOfSetting(override, p, goal);
    return { mix, source: 'override', label: `这次临时改的·${presetLabel(override)}`, reason };
  }
  const saved = readSetting(p?.content_mix);
  if (saved && saved.preset !== 'auto') {
    return { mix: mixOfSetting(saved, p, goal).mix, source: 'profile', label: `档案设置·${presetLabel(saved)}` };
  }
  const { mix, reason } = recommendMix(p, goal);
  const stage = typeof p?.account_stage === 'string' && p.account_stage ? p.account_stage.split('，')[0] : '';
  return { mix, source: 'auto', label: stage ? `系统推荐（${stage}）` : '系统推荐', reason };
}

export const formatMix = (m: ContentMix) => CONTENT_ROLE_LIST.map((r) => `${r} ${m[r]}%`).join(' / ');

/**
 * 百分比换成条数（最大余数法）。
 * 一批 3 条以上时，占比 ≥10% 的目的至少给 1 条——不然"变现型从第一周就要有"会被四舍五入掉。
 */
export function mixToCounts(m: ContentMix, total: number): Record<ContentRole, number> {
  const n = Math.max(0, Math.round(total));
  const exact = CONTENT_ROLE_LIST.map((r) => (m[r] / 100) * n);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; counts[i]++; left--; }
  if (n >= 3) {
    CONTENT_ROLE_LIST.forEach((r, i) => {
      if (m[r] >= 10 && counts[i] === 0) {
        const donor = counts.indexOf(Math.max(...counts));
        if (counts[donor] > 1) { counts[donor]--; counts[i]++; }
      }
    });
  }
  return Object.fromEntries(CONTENT_ROLE_LIST.map((r, i) => [r, counts[i]])) as Record<ContentRole, number>;
}

/**
 * 写进提示词的配比。
 * - 给了 count（选题、方向这种"出 N 条"）：换成条数，条数是硬要求
 * - 没给（定位、简报、起号方案）：给百分比，作用配比直接用，不要另推
 */
export function mixPromptBlock(r: ResolvedMix, opts: { count?: number; unit?: string } = {}): string {
  const unit = opts.unit ?? '条';
  const from =
    r.source === 'override' ? '用户这次指定的' : r.source === 'profile' ? '用户在账号档案里定的' : `系统按账号情况推荐的（${r.reason ?? ''}）`;
  if (opts.count && opts.count > 0) {
    const c = mixToCounts(r.mix, opts.count);
    const list = CONTENT_ROLE_LIST.filter((x) => c[x] > 0).map((x) => `${x} ${c[x]} ${unit}`).join('、');
    return `## 📊 内容配比（硬性要求）

这 ${opts.count} ${unit}按：**${list}**。
（配比 ${formatMix(r.mix)}，${from}）
- 每${unit}只担一个主目的，在「视频目的」那一行写明是哪一种
- 每种的${unit}数必须对上，不多不少；和定位、简报里写的配比不一样时，**以这里为准**`;
  }
  return `## 📊 内容配比（已定，直接用）

作用配比定为：**${formatMix(r.mix)}**——${from}。
- 这一层不用你再推，**直接用这个数**；你要做的是在它下面推形式（知识 / 故事 / 晒过程 / 观点）和题材，并说清这个比例为什么适合这个号
- 你认为明显不合适的，在核验里用一两句话提建议，正文仍按这个数写；和定位、简报里原来写的配比不一样时，以这里为准`;
}

/** 告诉 AI 这个号平时按什么配比（自由对话这类不出固定条数的板块用） */
export function mixContextLine(r: ResolvedMix): string {
  return `- **内容配比**：${formatMix(r.mix)}（${r.label}）。出选题、排计划时按这个比例分`;
}

/**
 * 生成完数一下每条的目的。
 * 按「## 选题N」「### 方向N」这类标题切成一条一条，每条取「视频目的 / 对应目的」后面第一个出现的目的词；
 * 没有这一行的，取整条里第一个出现的目的词。
 */
export function countRoles(text: string): { counts: Record<ContentRole, number>; total: number; unknown: number } {
  const items = text.split(/\n(?=#{2,3}\s*(?:选题|方向)\s*\d+)/).filter((s) => /^#{2,3}\s*(?:选题|方向)\s*\d+/.test(s.trim()));
  const counts = Object.fromEntries(CONTENT_ROLE_LIST.map((r) => [r, 0])) as Record<ContentRole, number>;
  let unknown = 0;
  const roleRe = new RegExp(CONTENT_ROLE_LIST.join('|'));
  for (const item of items) {
    const at = item.search(/视频目的|对应目的|这条的目的/);
    const hit = (at >= 0 ? item.slice(at) : item).match(roleRe);
    if (hit) counts[hit[0] as ContentRole]++;
    else unknown++;
  }
  return { counts, total: items.length, unknown };
}

/** 和要求的条数比一比，给结果下面那行提示用 */
export function checkMix(text: string, r: ResolvedMix, count: number) {
  const want = mixToCounts(r.mix, count);
  const got = countRoles(text);
  const ok = got.total > 0 && got.unknown === 0 && CONTENT_ROLE_LIST.every((x) => got.counts[x] === want[x]);
  const summary = CONTENT_ROLE_LIST.map((x) => `${x.replace('型', '')} ${got.counts[x]}`).join(' / ');
  const expected = CONTENT_ROLE_LIST.map((x) => `${x.replace('型', '')} ${want[x]}`).join(' / ');
  return { ok, got, want, summary, expected, counted: got.total > 0 };
}
