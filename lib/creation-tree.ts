/**
 * 内容创作树的数据契约（2026-10-30）。
 *
 * 树顶层两个大类：四大脚本（话怎么讲，下挂教知识/晒过程/聊观点/讲故事各自的结构）和 36 计（事件怎么拍）。
 * 每一跳（方向 → 选题 → 脚本 …）都用这里的字段传递，提示词按它写，解析器按它读，跳转时整组带过去。
 * 结构名一律写全名：「聊观点·论证型」「36计·第32计 换个视角」，不只写类型头。
 */
import { FOUR_SCRIPT_CHOICES, fourScriptIn } from './creation-settings';
import { GROWTH_TACTICS } from './growth-tactics';
import { AUTO_TACTIC } from './creative-routes';
import { VIRAL_ELEMENTS } from './viral-elements';

export const BIG_TYPES = ['四大脚本', '36计'] as const;
export type BigType = (typeof BIG_TYPES)[number];

export const PURPOSES = ['流量型', '人设型', '变现型'] as const;
export type Purpose = (typeof PURPOSES)[number];

/** 四大脚本下的类型（36 计没有这一层） */
export const FOUR_KINDS = ['教知识', '晒过程', '聊观点', '讲故事'] as const;
export type FourKind = (typeof FOUR_KINDS)[number];

export interface TreeNode {
  bigType: BigType;
  /** 四大脚本的类型；36 计为空串 */
  kind: FourKind | '';
  /** 具体结构全名：「聊观点·论证型」或「36计·第32计 换个视角」 */
  structure: string;
  purpose: Purpose | '';
  /** 这一跳要完成的任务，一句话 */
  task: string;
  /** 爆款元素（八大爆款元素的名字） */
  elements: string[];
  /** 来源：方向卡或选题的标题 */
  source: string;
}

/** 字符串转目的：三种目的之一返回它，其余返回空串 */
export function purposeOf(s: string): Purpose | '' {
  return (PURPOSES as readonly string[]).includes(s) ? (s as Purpose) : '';
}

/** 36 计的全名：「36计·第N计 计名」 */
export function tacticStructureName(no: number, name: string): string {
  return `36计·第${no}计 ${name}`;
}

/** 注册表里全部的合法结构名：四大脚本的结构（全名）+ 36 计（全名） */
export function allStructureNames(): string[] {
  const four = FOUR_SCRIPT_CHOICES.map((c) => c.name);
  const tactic = GROWTH_TACTICS.map((t) => tacticStructureName(t.no, t.name));
  return [...four, ...tactic];
}

/** 结构名是不是注册表里的 */
export function isKnownStructure(structure: string): boolean {
  return allStructureNames().includes(structure);
}

/** 大类由结构名推出来：36 计的结构名以「36计·」开头，其余属于四大脚本 */
export function bigTypeOfStructure(structure: string): BigType | '' {
  if (!structure) return '';
  if (structure.startsWith('36计·')) return '36计';
  if (FOUR_SCRIPT_CHOICES.some((c) => c.name === structure)) return '四大脚本';
  return '';
}

/** 四大脚本结构名对应的类型（头两个字之前的那一段）；36 计返回空串 */
export function kindOfStructure(structure: string): FourKind | '' {
  if (bigTypeOfStructure(structure) !== '四大脚本') return '';
  const head = structure.split('·')[0];
  return (FOUR_KINDS as readonly string[]).includes(head) ? (head as FourKind) : '';
}

/** 生成一个契约节点，并检查结构名是否合法；不合法的结构直接报错，不静默放过 */
export function makeTreeNode(p: { structure: string; purpose?: string; task?: string; elements?: string[]; source?: string }): TreeNode {
  if (!isKnownStructure(p.structure)) throw new Error(`结构名不在注册表里：${p.structure}`);
  const bigType = bigTypeOfStructure(p.structure) as BigType;
  return {
    bigType,
    kind: kindOfStructure(p.structure),
    structure: p.structure,
    purpose: (PURPOSES as readonly string[]).includes(p.purpose ?? '') ? (p.purpose as Purpose) : '',
    task: (p.task ?? '').trim(),
    elements: [...new Set((p.elements ?? []).map((x) => x.trim()).filter(Boolean))],
    source: (p.source ?? '').trim(),
  };
}

/**
 * 从脚本页的输入推出契约节点：tactic 是 36 计的计名（有就以它为准），否则看四大脚本的结构 id。
 * 两个都没有（AI 自选）返回 null，由调用方决定怎么写。
 */
export function treeNodeOfScriptInputs(p: { tactic?: string; scriptStructure?: string; purpose?: string; elements?: string[]; source?: string }): TreeNode | null {
  if (p.tactic && p.tactic !== AUTO_TACTIC) {
    const t = GROWTH_TACTICS.find((x) => x.name === p.tactic);
    if (!t) return null;
    return makeTreeNode({ structure: tacticStructureName(t.no, t.name), purpose: p.purpose, elements: p.elements, source: p.source });
  }
  const four = FOUR_SCRIPT_CHOICES.find((c) => c.structure === p.scriptStructure);
  if (!four) return null;
  return makeTreeNode({ structure: four.name, purpose: p.purpose, elements: p.elements, source: p.source });
}

/** 四大脚本的全名转成脚本页的结构 id（如「聊观点·论证型」→ argue）；认不出返回 undefined */
export function structureIdOfFourName(name: string): string | undefined {
  return FOUR_SCRIPT_CHOICES.find((c) => c.name === name)?.structure;
}

/** 一节的正文：从小节标题的下一行起，到下一个小节（或 markdown 标题）为止 */
const NEXT_SECTION = /^\s*(#{1,4}\s|[0-9]️?⃣|🅰|🅱)/u;
function sectionLines(text: string, heading: RegExp): string[] {
  const lines = text.replace(/\*\*/g, '').split('\n');
  const i = lines.findIndex((l) => heading.test(l));
  if (i < 0) return [];
  const out: string[] = [];
  for (let k = i; k < lines.length; k++) {
    if (k > i && NEXT_SECTION.test(lines[k])) break;
    if (k === i) {
      // 标题行本身可能就带了内容（「视频目的：人设型」），也要读
      const rest = lines[k].replace(heading, '').replace(/^[\s:：]+/, '').trim();
      if (rest) out.push(rest);
      continue;
    }
    if (lines[k].trim()) out.push(lines[k].trim());
  }
  return out;
}

/** 选题正文里挑出这一条：标题对得上的那一段；只有一条时就用整段；对不上返回 null（不猜） */
function pickTopicSection(body: string, topicTitle: string): string | null {
  const parts = body.split(/\n(?=#{2,4}\s)/);
  if (parts.length <= 1) return body;
  const key = topicTitle.replace(/\s+/g, '').slice(0, 8);
  if (key) {
    const hit = parts.find((p) => p.split('\n')[0].replace(/\s+/g, '').includes(key));
    if (hit) return hit;
  }
  const topics = parts.filter((p) => /打法|视频目的/.test(p));
  return topics.length === 1 ? topics[0] : null;
}

/** 打法小节里认出结构：四大脚本写全名（或只写类型，取这一类第一种），36 计写「第N计 计名」 */
function structureInSection(section: string): string {
  const lines = sectionLines(section, /打法/);
  for (const l of lines) {
    const t = l.match(/36计\s*[·:：]?\s*第\s*(\d+)\s*计\s*([^：:，,\s]+)/);
    if (t) {
      const no = Number(t[1]);
      const hit = GROWTH_TACTICS.find((x) => x.no === no && x.name === t[2]) ?? GROWTH_TACTICS.find((x) => x.name === t[2]);
      if (hit) return tacticStructureName(hit.no, hit.name);
    }
  }
  for (const l of lines) {
    const four = fourScriptIn(l);
    if (four) return four.name;
    const head = l.match(/四大脚本\s*[·:：]\s*(教知识|晒过程|讲故事|聊观点)/)?.[1];
    if (head) {
      const first = FOUR_SCRIPT_CHOICES.find((c) => c.name.startsWith(`${head}·`));
      if (first) return first.name;
    }
  }
  return '';
}

/**
 * 从选题正文读出这一条的完整契约：结构（以选题写的为准）、视频目的、视频任务、爆款元素。
 * 结构认不出、或正文里找不到这一条，返回 null，由调用方明示，不猜。
 */
export function treeNodeOfTopicBody(body: string, topicTitle = ''): TreeNode | null {
  const section = pickTopicSection(body, topicTitle);
  if (!section) return null;
  const structure = structureInSection(section);
  if (!structure || !isKnownStructure(structure)) return null;
  const purpose = sectionLines(section, /视频目的/).join(' ').match(/流量型|人设型|变现型/)?.[0] ?? '';
  const task = sectionLines(section, /视频任务/)[0]?.replace(/^[-*]\s*/, '') ?? '';
  const elementText = sectionLines(section, /爆款元素/).join(' ');
  const elements = VIRAL_ELEMENTS.map((e) => e.name).filter((name) => elementText.includes(name));
  return makeTreeNode({ structure, purpose, task, elements, source: topicTitle });
}

/**
 * 从一段上游正文读出契约，写成提示词块。上游可以是选题正文（有「打法」小节），也可以是脚本的策略卡（写着「实际采用形式」「用户目的」）。
 * 读不出结构就返回空串，不写假的块。
 */
export function contractBlockFromText(text: string, title = ''): string {
  const t = text || '';
  if (!t.trim()) return '';
  const fromTopic = treeNodeOfTopicBody(t, title);
  if (fromTopic) return formatTreeBlock(fromTopic);
  // 脚本策略卡：结构全名出现在「实际采用形式」等行里，取最长的那个（避免「解题型」误认成别的）
  const structure = [...allStructureNames()].sort((a, b) => b.length - a.length).find((n) => t.includes(n));
  if (!structure) return '';
  // 标签后面可能夹着加粗符号（「**用户目的**：人设型」），所以冒号前允许 **
  const purpose = purposeOf(t.match(/(?:用户目的|视频目的|内容目的)\**\s*[：:]\s*\**\s*(流量型|人设型|变现型)/)?.[1] ?? '');
  const task = (t.match(/视频任务\**\s*[：:]\s*\**\s*([^\n]+)/)?.[1] ?? '').trim();
  return formatTreeBlock(makeTreeNode({ structure, purpose, task, source: title }));
}

/** 写进提示词的块。字段名固定，解析器按这些字段名读回来 */
export function formatTreeBlock(node: TreeNode): string {
  return [
    '【内容树】',
    `- 大类：${node.bigType}`,
    node.kind ? `- 类型：${node.kind}` : '',
    `- 具体结构：${node.structure}（必须按这个结构写，不另选）`,
    node.purpose ? `- 目的：${node.purpose}` : '',
    node.task ? `- 任务：${node.task}` : '',
    node.elements.length ? `- 爆款元素：${node.elements.join('、')}` : '',
    node.source ? `- 来源：${node.source}` : '',
  ].filter(Boolean).join('\n');
}

/** 从文字里读回契约节点（块的字段名固定）。没有块或结构认不出返回 null，由调用方明示，不猜 */
export function parseTreeBlock(text: string): TreeNode | null {
  const field = (label: string) => text.match(new RegExp(`^\\s*[-*]?\\s*${label}[：:]\\s*(.+?)\\s*$`, 'm'))?.[1]?.replace(/（必须.*$/, '').trim() ?? '';
  const structure = field('具体结构');
  if (!structure || !isKnownStructure(structure)) return null;
  const elements = field('爆款元素').split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
  return makeTreeNode({ structure, purpose: field('目的'), task: field('任务'), elements, source: field('来源') });
}
