/**
 * 36 计与四大脚本的搭配比例（创作方向、内容规划共用）——全站唯一出处。
 *
 * 【为什么要有】36 计和四大脚本都只是把内容拍出来的形式，编导要能自己定比例：
 * 全 36 计、全四大脚本，或者中间任意一个数。比例对所有目的都生效。
 * 大流量由人、货、场、三有和爆款元素决定（见 lib/content-roles 的 BIG_TRAFFIC_STANDARD），不由比例决定。
 *
 * 比例 0 = 全部用 36 计，提示词与原来逐字相同。
 */

/** 滑条的步长：每 10 个点一档 */
export const SCRIPT_SHARE_STEP = 10;

export const TACTIC_MIX_PRESETS = [
  { id: 'tactic', label: '36计为主', share: 0, hint: '内容类型全从 36 计挑，四大脚本只管话怎么讲' },
  { id: 'balanced', label: '均衡', share: 50, hint: '一半内容类型用四大脚本的结构，一半用 36 计' },
  { id: 'scripts', label: '四大脚本为主', share: 100, hint: '内容类型全用四大脚本的结构' },
] as const;

/**
 * 四大脚本的结构名。写进「内容类型」，用的是脚本页认得的名字（脚本类型 + 结构），
 * 下一页 lib/creation-settings 的 settingsFromText 能把它认回脚本类型和结构。
 */
export const SCRIPT_STRUCTURE_NAMES: string[] = [
  '晒过程·火车节', '晒过程·观察型', '教知识·解题型', '教知识·推荐型', '教知识·案例型', '讲故事·故事型', '聊观点·论证型',
];

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
  return `所有方向里，${about}的内容类型写四大脚本的结构名（${SCRIPT_STRUCTURE_NAMES.join('、')}，一字不差），其余写 36 计的计名。` +
    '这个比例不分目的：大流量、人设、变现都按它分，大流量的标准照常要满足。';
}

/** 界面上显示「36 计 X% ｜ 四大脚本 Y%」用 */
export function tacticSplit(share: number): { tactic: number; scripts: number } {
  const scripts = normalizeScriptShare(share);
  return { tactic: 100 - scripts, scripts };
}
