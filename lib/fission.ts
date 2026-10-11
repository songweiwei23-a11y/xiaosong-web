/**
 * 跨行业二创的裂变（2026-10-12）：拿到拆解的二创结构后，用户可以选
 * - 数量：1 / 3 / 5 / 10 / 15 个变体（最多 15）
 * - 模式：1:1 复刻（结构完全一样，只换题材）/ 裂变（在勾选的拆解知识里取不同组合）
 * - 知识项：拆解里的每一类知识（开篇 36 计、六大钩子、四大脚本、八大爆款元素、情绪曲线、人设、作用、呈现方式、起号 36 计、景别、运镜、置景）
 *   都能勾选。没勾的类别不限；勾了的类别只能从勾中的里取。
 * 清单全部来自原来的知识模块，名字与拆解报告一致，保证拆解和二创用的是同一套知识。
 */
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from './viral-elements';
import { OPENING_CARDS } from './opening-cards';
import { GROWTH_TACTICS } from './growth-tactics';

export const FISSION_MAX = 15;

export const FISSION_MODES = [
  { id: 'copy', label: '1:1 复刻', hint: '分段、顺序、每段功能、用的知识、镜头数都和模版一样，只换题材和说法' },
  { id: 'vary', label: '裂变', hint: '在你勾选的拆解知识里取不同组合，每个变体换一种玩法，同一个爆点机制保留' },
] as const;
export type FissionMode = (typeof FISSION_MODES)[number]['id'];

export interface FissionItem { id: string; label: string; group?: string; hint?: string }
export interface FissionCategory { id: string; label: string; items: FissionItem[] }
/** 每个类别勾中的项：类别 id → 项 id 列表 */
export type FissionSelections = Record<string, string[]>;

const SIX_HOOKS = ['金钱', '盲盒', '对抗', '验证解密', '送温暖', '荷尔蒙'];
const EMOTION_CURVES = ['反转型', '盲盒型', '共鸣爆发型', '情感渗透型'];
const PERSONAS = ['崇拜者', '教导者', '分享者', '陪伴者', '衬托者', '搞笑者'];
const ROLES = ['流量型', '人设型', '变现型'];
const PRESENTATIONS = ['口播（自拍）', '口播（偷拍）', '口播（聊天）', '口播（采访视角）', 'vlog', '剧情', '图文'];
const SHOT_SIZES = ['远景', '全景', '中景', '近景', '特写'];
const CAMERA_MOVES = ['推', '拉', '横移', '摇', '跟随', '环绕', '固定'];
const SETTINGS = ['素背景', '包装型背景（行业现场）', '生活化背景'];

const simple = (cat: string, names: string[]): FissionItem[] => names.map((n) => ({ id: `${cat}:${n}`, label: n }));

export const FISSION_CATEGORIES: FissionCategory[] = [
  {
    id: 'opening',
    label: '开篇（开篇 36 计 + 六大钩子）',
    items: [
      ...OPENING_CARDS.map((c) => ({ id: `opening:${c.no}`, label: c.name, group: c.category, hint: c.formula })),
      ...simple('hook', SIX_HOOKS).map((i) => ({ ...i, group: '六大钩子' })),
    ],
  },
  { id: 'script', label: '结构（四大脚本）', items: SCRIPT_FAMILIES.map((s) => ({ id: `script:${s.name}`, label: s.name })) },
  { id: 'element', label: '爆款元素（八大）', items: VIRAL_ELEMENTS.map((e) => ({ id: `element:${e.name}`, label: e.name, hint: e.hook })) },
  { id: 'growth', label: '起号 36 计', items: GROWTH_TACTICS.map((t) => ({ id: `growth:${t.no}`, label: t.name })) },
  { id: 'emotion', label: '情绪曲线', items: simple('emotion', EMOTION_CURVES) },
  { id: 'persona', label: '人设', items: simple('persona', PERSONAS) },
  { id: 'role', label: '作用（流量 / 人设 / 变现）', items: simple('role', ROLES) },
  { id: 'presentation', label: '呈现方式', items: simple('presentation', PRESENTATIONS) },
  { id: 'shotSize', label: '景别', items: simple('shotSize', SHOT_SIZES) },
  { id: 'camera', label: '运镜', items: simple('camera', CAMERA_MOVES) },
  { id: 'setting', label: '置景', items: simple('setting', SETTINGS) },
];

/** 勾了的项转成提示词里的一句话；没勾的类别不写（不限） */
export function selectionLines(selections: FissionSelections): string[] {
  const out: string[] = [];
  for (const cat of FISSION_CATEGORIES) {
    const picked = (selections[cat.id] ?? []).filter((id) => cat.items.some((i) => i.id === id));
    if (!picked.length) continue;
    const labels = picked.map((id) => cat.items.find((i) => i.id === id)!.label);
    out.push(`- **${cat.label}**只从这几个里用：${labels.join('、')}（每个方案用其中一个或组合，名字要一字不差）`);
  }
  return out;
}

/** 裂变设置写进二创提示词的一段 */
export function buildFissionBlock(p: { count: number; mode: FissionMode; selections: FissionSelections }): string {
  const count = Math.min(Math.max(Math.round(p.count) || 1, 1), FISSION_MAX);
  const copy = p.mode === 'copy';
  const lines = [
    '## 裂变设置（按用户勾的来）',
    `- **变体数**：${count} 个。每个都是一个完整方案，用「### 方案 N：名称」标题，方案之间用 --- 隔开`,
    copy
      ? '- **模式：1:1 复刻**。每个方案的分段数量、顺序、每段功能、用的拆解知识、镜头数，都和拆解出的二创结构完全一致；只替换题材、人物、场景和具体说法'
      : '- **模式：裂变**。每个方案在勾选的拆解知识里取一个不同的组合；同一个方案内部保留原片的爆点机制；方案之间不能只是换词',
    ...selectionLines(p.selections),
    ...(Object.keys(p.selections).some((k) => (p.selections[k] ?? []).length) ? [] : ['- 没有勾选知识项：所有类别都不限，但段落功能和知识名要照原结构写']),
    '- 每个方案开头写明用了哪些拆解知识（名字一字不差）',
    count > 1 ? `- ${count} 个方案彼此要不同：题材、人物、开头句，至少有两项不一样` : '',
    count > 5 ? '- 变体多，每个方案压缩到一屏能看完：开头一句、分段一段一行（时间 · 功能 · 知识 · 台词要点）、一个行动指令' : '',
  ];
  return lines.filter(Boolean).join('\n');
}
