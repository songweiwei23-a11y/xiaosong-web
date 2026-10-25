/**
 * 36 计 与 四大脚本 的搭配比例（创作方向、内容规划共用）——全站唯一出处。
 *
 * 【为什么要有】36 计管"片子里发生什么"，四大脚本管"话怎么讲"。两套各有强项，
 * 编导要能自己定比例：全 36 计、全四大脚本，或者中间任意一个数。
 *
 * 【范围】只作用在人设型、变现型方向上。流量型一律用 36 计的流量计：四大脚本的结构里
 * 没有流量打法（教知识在 lib/content-roles 里归变现型）。
 *
 * 比例 0 = 和原来一样，提示词一字不变。
 */
import type { ContentRole } from './content-roles';

/** 滑条的步长：每 10 个点一档 */
export const SCRIPT_SHARE_STEP = 10;

export const TACTIC_MIX_PRESETS = [
  { id: 'tactic', label: '36计为主', share: 0, hint: '内容类型全从 36 计挑，四大脚本只管话怎么讲' },
  { id: 'balanced', label: '均衡', share: 50, hint: '人设、变现方向一半用四大脚本的结构' },
  { id: 'scripts', label: '四大脚本为主', share: 100, hint: '人设、变现方向全用四大脚本的结构' },
] as const;

/**
 * 四大脚本能用的结构名。写进「内容类型」，用的是脚本页认得的名字（脚本类型 + 结构），
 * 下一页 lib/creation-settings 的 settingsFromText 能把它认回脚本类型和结构。
 */
export const SCRIPT_STRUCTURES_FOR: Partial<Record<ContentRole, string[]>> = {
  人设型: ['讲故事·故事型', '聊观点·论证型'],
  变现型: ['晒过程·火车节', '晒过程·观察型', '教知识·解题型', '教知识·推荐型', '教知识·案例型'],
};

/** 任何输入都归到 0–100、步长 10 */
export function normalizeScriptShare(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const stepped = Math.round(n / SCRIPT_SHARE_STEP) * SCRIPT_SHARE_STEP;
  return Math.min(100, Math.max(0, stepped));
}

/**
 * 写进提示词的搭配规则。比例为 0 时返回空串，调用方拼上去就等于没拼。
 */
export function tacticMixRule(share: number): string {
  const s = normalizeScriptShare(share);
  if (s === 0) return '';
  const about = s === 100 ? '全部' : `大约 ${s}%`;
  const lists = (['人设型', '变现型'] as const)
    .map((r) => `${r}：${(SCRIPT_STRUCTURES_FOR[r] ?? []).join('、')}`)
    .join('；');
  return `人设型、变现型方向里，${about}的内容类型写四大脚本的结构名（${lists}，一字不差），其余写 36 计的计名。流量型方向一律只写 36 计的流量计。`;
}

/** 界面上显示「36 计 X% ｜ 四大脚本 Y%」用 */
export function tacticSplit(share: number): { tactic: number; scripts: number } {
  const scripts = normalizeScriptShare(share);
  return { tactic: 100 - scripts, scripts };
}
