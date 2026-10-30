/**
 * 脚本打法的唯一出处（2026-10-30）。
 *
 * 四大脚本（薛老师，管「话怎么讲」）和 36 计（小黄，管「事件怎么拍」）是两个派别。
 * 规则：一条脚本只用一派，选题标了哪一派，跳到脚本就用哪一派，不叠加。
 *   - 选题标了 36 计 → 脚本用那一计，脚本结构不带四大脚本
 *   - 选题标了四大脚本的某一种 → 脚本用那一种，不带 36 计
 *   - 什么都没标 → 脚本页让 AI 在两派里挑一派，只挑一派
 *
 * 脚本页、选题跳转、内容规划、创作方向都从这里取选项和判定，别在别处再写一份。
 */
import { FOUR_SCRIPT_CHOICES, fourScriptOfStructure, scriptFormOfTopic } from './creation-settings';
import { GROWTH_TACTICS } from './growth-tactics';
import { roleOfTactic } from './content-roles';
import { AUTO_TACTIC, tacticInText } from './creative-routes';
import { splitTopicSections } from './topic-library';
import { normalizeScriptShare, tacticMixRule } from './tactic-mix';

export type RouteSchool = 'four' | 'tactic';

export interface RouteOption {
  /** 'four:<结构 id>' 或 'tactic:<计名>'，全站只用这一种写法 */
  key: string;
  school: RouteSchool;
  /** 卡片标题：「晒过程·火车节」或「第32计 换个视角」 */
  title: string;
  /** 这一派的说法：四大脚本讲怎么讲，36 计讲怎么拍 */
  kind: string;
  /** 适合的目的：流量 / 人设 / 变现 */
  fit: string;
}

/** 四大脚本各对一个目的（薛老师的说法，和 lib/content-roles 的注释一致） */
const FOUR_FIT: Record<string, string> = { 教知识: '流量（涨粉）', 聊观点: '人设（吸真粉丝）', 晒过程: '变现（促成交）', 讲故事: '人设（高客单成交）' };

export const SCHOOL_LABEL: Record<RouteSchool, string> = {
  four: '四大脚本 · 薛老师 · 讲怎么讲',
  tactic: '36 计 · 小黄 · 怎么拍',
};

/** 两派的全部选项：先四大脚本（7 种），后 36 计（按序号） */
export function routeOptions(): RouteOption[] {
  const four: RouteOption[] = FOUR_SCRIPT_CHOICES.map((c) => ({
    key: `four:${c.structure}`,
    school: 'four',
    title: c.name,
    kind: '四大脚本 · 讲怎么讲',
    fit: FOUR_FIT[c.head] ?? '不限',
  }));
  const tactic: RouteOption[] = [...GROWTH_TACTICS].sort((a, b) => a.no - b.no).map((t) => ({
    key: `tactic:${t.name}`,
    school: 'tactic',
    title: `第${t.no}计 ${t.name}`,
    kind: '36 计 · 怎么拍',
    fit: roleOfTactic(t.name) ?? '不限',
  }));
  return [...four, ...tactic];
}

/** 选项 key 是 36 计时返回计名，否则 undefined（选题页要的是「打法」这个字段） */
export function tacticOfRoute(key: string): string | undefined {
  return key.startsWith('tactic:') ? key.slice('tactic:'.length) : undefined;
}

/** 一个选项归哪一派 */
export function schoolOf(key: string): RouteSchool | undefined {
  if (key.startsWith('four:')) return 'four';
  if (key.startsWith('tactic:')) return 'tactic';
  return undefined;
}

/**
 * 页面上的两个字段（打法 tactic、脚本结构 structure）→ 选项 key。
 * 36 计优先：两个都有时以 36 计为准（这种情况只来自旧数据，不能叠用）。什么都没有返回空串（AI 挑）。
 */
export function routeKeyOf(tactic: string | null | undefined, structure: string | null | undefined): string {
  if (tactic && tactic !== AUTO_TACTIC) return `tactic:${tactic}`;
  const four = fourScriptOfStructure(structure ?? undefined);
  return four ? `four:${four.structure}` : '';
}

/** 选项 key → 写进脚本页两个字段的值。一派只写它自己那一个字段，另一个归零 */
export function routeFields(key: string): { tactic: string; structure: string } {
  if (key.startsWith('tactic:')) return { tactic: key.slice('tactic:'.length), structure: 'auto' };
  if (key.startsWith('four:')) return { tactic: AUTO_TACTIC, structure: key.slice('four:'.length) };
  return { tactic: AUTO_TACTIC, structure: 'auto' };
}

/**
 * 一段选题正文标的是哪一派（只认明确标出的那一行；36 计先于四大脚本）。
 * 没标返回空串。
 */
export function topicRouteOf(body: string): string {
  const tactic = tacticInText(body);
  if (tactic) return `tactic:${tactic}`;
  // 四大脚本：写全名「晒过程·火车节」；只写类型「聊观点」时结构留空，不替编导选（脚本页会提示手选），见 scriptFormOfTopic
  const four = scriptFormOfTopic(body);
  return four.structure ? `four:${four.structure}` : '';
}

/** 一批选题里，每一条各自标的派别：标题 → 选项 key（没标的不出现在结果里） */
export function topicRoutesOf(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of splitTopicSections(markdown)) {
    const key = topicRouteOf(s.body);
    if (key) out[s.title] = key;
  }
  return out;
}

/**
 * 内容规划、创作方向写进提示词的打法规则（2026-10-30）。
 * 手选优先（picked 非空，只用选中的）；其次按比例（share：0 = 全用 36 计，100 = 全用四大脚本）；都没有就全用 36 计。
 * 两派只选一派，不叠加，各个方向都是这样。
 */
export function planRouteRule(p: { share?: number; picked?: string[] }): string {
  if (p.picked?.length) {
    const names = p.picked.map((k) => {
      const f = routeFields(k);
      return f.tactic !== AUTO_TACTIC ? `36计·${f.tactic}` : `四大脚本·${fourScriptOfStructure(f.structure)?.name ?? f.structure}`;
    });
    return `这批只用下面这些打法，没列的一概不用：${names.join('、')}。每个方向只用其中一派的一个，写的时候用这里的名字，一字不差。`;
  }
  const s = normalizeScriptShare(p.share);
  if (s > 0) return `${tacticMixRule(s)}两派只选一派，不叠加。`;
  return '全部用 36 计：内容类型从 36 计清单里选一计写计名（事件怎么拍），不用四大脚本的结构名。两派只选一派，不叠加。';
}

/** 提示词里写明的规则，内容规划、创作方向、脚本共用，保证三处说的是同一件事 */
export const ONE_SCHOOL_RULE = '一条内容只用一派：四大脚本（讲怎么讲）和 36 计（怎么拍）不叠加。用了 36 计，策略卡第一条写「用的计：36计·第N计 计名」；用了四大脚本，策略卡第一条写「用的脚本：四大脚本·具体结构名」。';
