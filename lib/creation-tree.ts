/**
 * 内容创作树的数据契约（2026-10-30，2026-10-31 整改）。
 *
 * 树顶层两个大类：四大脚本（话怎么讲，下挂教知识/晒过程/聊观点/讲故事各自的结构）和 36 计（事件怎么拍）。
 * 每一跳（方向 → 选题 → 脚本 …）都用这里的字段传递，提示词按它写，解析器按它读，跳转时整组带过去。
 * 结构名一律写全名：「聊观点·论证型」「36计·第32计 换个视角」，不只写类型头。
 *
 * 认结构的规则（2026-10-31）：只要注册表里的名字（或「类型·结构」的短写）出现在打法那一行就认出来，
 * 编号写不写都行，空格、标点、大小写都不影响。认不出时读取函数返回 node 为 null 和具体原因，
 * 由页面明示、让用户手选，不静默回退。
 */
import { FOUR_SCRIPT_CHOICES } from './creation-settings';
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

export type ContractProblemCode =
  | 'no-section' // 选题正文里找不到这一条
  | 'no-tactic' // 这一条没有写打法
  | 'unknown' // 写了打法，注册表里认不出
  | 'ambiguous' // 打法里写了好几种结构，认不出用哪一个
  | 'kind-only' // 只写了四大脚本的类型，没写具体结构
  | 'no-purpose' // 没写视频目的
  | 'no-task'; // 没写视频任务

export interface ContractProblem {
  code: ContractProblemCode;
  /** 给编导看的一句话 */
  text: string;
}

/** node 为 null 表示结构没认出来：下游不能往下走，页面要明示、让用户手选 */
export interface ContractReading {
  node: TreeNode | null;
  problems: ContractProblem[];
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

/** 比对用的写法：去掉空格和标点、统一大小写（「软组合：用A方式做B事」和「软组合用a方式做b事」当成一样） */
export function normKey(s: string): string {
  return s.toLowerCase().replace(/[\s/／·・、，,：:（）()【】[\]「」"'“”*_—-]+/g, '');
}

const TACTIC_KEYS = GROWTH_TACTICS.map((t) => ({ no: t.no, name: t.name, key: normKey(t.name) }));
const FOUR_KEYS = FOUR_SCRIPT_CHOICES.map((c) => {
  const [kind, shape = ''] = c.name.split('·');
  return { choice: c, kind: kind as FourKind, kindKey: normKey(kind), full: normKey(c.name), stem: normKey(shape.replace(/型$/, '')) };
});

export interface StructureHit {
  /** 在这一行（去掉标点后）里出现的位置，取最靠前的那个 */
  pos: number;
  /** 认出的结构全名；只写了类型时为空串 */
  structure: string;
  /** 四大脚本的类型；36 计为空串 */
  kind: FourKind | '';
}

/**
 * 一行里认出的结构：位置最靠前的那个（打法行的结构名写在最前面，后面的解释里再提到别的名字不算）。
 * 36 计认计名（编号写不写都行，只写「第N计」也认）；四大脚本认全名，或「类型·结构」的短写（「教知识·推荐」）。
 * 只写了类型（「晒过程」）时 structure 为空串。一个都认不出返回 null。
 */
export function findStructure(line: string): StructureHit | null {
  const k = normKey(line);
  const hits: StructureHit[] = [];
  for (const t of TACTIC_KEYS) {
    const pos = k.indexOf(t.key);
    if (pos >= 0) hits.push({ pos, structure: tacticStructureName(t.no, t.name), kind: '' });
  }
  for (const f of FOUR_KEYS) {
    const pos = k.indexOf(f.full);
    if (pos >= 0) hits.push({ pos, structure: f.choice.name, kind: f.kind });
  }
  for (const kind of FOUR_KINDS) {
    const pos = k.indexOf(normKey(kind));
    if (pos < 0) continue;
    const after = k.slice(pos);
    const f = FOUR_KEYS.find((x) => x.kind === kind && x.stem && after.includes(x.stem));
    hits.push({ pos, structure: f ? f.choice.name : '', kind });
  }
  if (!hits.length) {
    // 只写了「第N计」：编号对得上注册表也算认出（名字都没有时才用它）
    const num = k.match(/第(\d+)计/);
    const t = num ? GROWTH_TACTICS.find((x) => x.no === Number(num[1])) : undefined;
    if (num && t) return { pos: num.index ?? 0, structure: tacticStructureName(t.no, t.name), kind: '' };
    return null;
  }
  return hits.reduce((a, b) => (b.pos < a.pos ? b : a));
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
  const key = normKey(topicTitle).slice(0, 10);
  if (key) {
    const hit = parts.find((p) => normKey(p.split('\n')[0]).includes(key));
    if (hit) return hit;
  }
  const topics = parts.filter((p) => /打法|视频目的/.test(p));
  return topics.length === 1 ? topics[0] : null;
}

/** 模板行（提示词里「四大脚本·结构（全部名字，写全名）」那种）不是模型的选择，不参与认定 */
const CHOICE_LINE = /^(?:[-*•]\s*)?(?:36\s*计|第\s*\d+\s*计|四大脚本)/;
function choiceLines(lines: string[]): string[] {
  const real = lines.filter((l) => !l.includes('写全名'));
  const picked = real.filter((l) => CHOICE_LINE.test(l.trim()));
  return picked.length ? picked : real;
}

/** 选题的一条：读打法、视频目的、视频任务、爆款元素；结构认不出 node 为 null，原因写在 problems 里 */
function readTopicSection(section: string, title: string): ContractReading {
  const lines = sectionLines(section, /^\s*(?:[0-9]️?⃣|🅰|🅱)?\s*打法/);
  const choice = choiceLines(lines);
  const problems: ContractProblem[] = [];
  const found = new Set<string>();
  const kinds = new Set<FourKind>();
  for (const l of choice) {
    const h = findStructure(l);
    if (!h) continue;
    if (h.structure) found.add(h.structure);
    else if (h.kind) kinds.add(h.kind);
  }
  let structure = '';
  if (found.size > 1) {
    problems.push({ code: 'ambiguous', text: `打法里写了 ${[...found].join('、')}，认不出用哪一个，只能选一派、选一个结构` });
  } else if (found.size === 1) {
    structure = [...found][0];
  } else if (kinds.size) {
    problems.push({ code: 'kind-only', text: `打法只写了「${[...kinds][0]}」，没写具体结构` });
  } else if (choice.length) {
    problems.push({ code: 'unknown', text: `打法写的是「${choice[0].slice(0, 40)}」，注册表里认不出这个结构` });
  } else {
    problems.push({ code: 'no-tactic', text: '这一条没有写「🅰 打法」，认不出用的是哪个结构' });
  }
  if (!structure) return { node: null, problems };

  const purpose = sectionLines(section, /^\s*(?:[0-9]️?⃣)?\s*视频目的/).join(' ').match(/流量型|人设型|变现型/)?.[0] ?? '';
  const task = sectionLines(section, /^\s*(?:[0-9]️?⃣)?\s*视频任务/)[0]?.replace(/^[-*]\s*/, '') ?? '';
  const elementText = sectionLines(section, /^\s*(?:[0-9]️?⃣)?\s*爆款元素/).join(' ');
  const elements = VIRAL_ELEMENTS.map((e) => e.name).filter((name) => elementText.includes(name));
  if (!purpose) problems.push({ code: 'no-purpose', text: '这一条没有写「视频目的」，目的沿用跳转带来的' });
  if (!task) problems.push({ code: 'no-task', text: '这一条没有写「视频任务」' });
  return { node: makeTreeNode({ structure, purpose, task, elements, source: title }), problems };
}

/** 选题正文里这一条的契约。正文里找不到这一条、或结构认不出，node 为 null，原因写在 problems 里 */
export function readTopicContract(body: string, topicTitle = ''): ContractReading {
  const section = pickTopicSection(body, topicTitle);
  if (!section) {
    return {
      node: null,
      problems: [{ code: 'no-section', text: topicTitle ? `选题正文里找不到「${topicTitle}」这一条，标题对不上` : '选题正文分不出是哪一条' }],
    };
  }
  return readTopicSection(section, topicTitle);
}

/** 脚本策略卡（「实际采用形式」「用户目的」「视频任务」）的契约。脚本页的结果用它直接读，不经过选题的小节判断 */
export function readStrategyContract(text: string, title = ''): ContractReading {
  return readStrategy(text, title);
}

function readStrategy(text: string, title: string): ContractReading {
  const lines = text.split('\n');
  const adopted = lines.filter((l) => /实际采用形式|用的计|用的脚本|采用形式/.test(l));
  const problems: ContractProblem[] = [];
  let structure = '';
  let kindOnly: FourKind | '' = '';
  for (const l of [...adopted, ...lines]) {
    const h = findStructure(l);
    if (!h) continue;
    if (h.structure) {
      structure = h.structure;
      break;
    }
    kindOnly = kindOnly || h.kind;
  }
  if (!structure) {
    problems.push(
      kindOnly
        ? { code: 'kind-only', text: `策略卡只写了「${kindOnly}」，没写具体结构` }
        : { code: 'no-tactic', text: '策略卡里没有写「实际采用形式」，认不出用的是哪个结构' }
    );
    return { node: null, problems };
  }
  const purpose = purposeOf(text.match(/(?:用户目的|视频目的|内容目的)\**\s*[：:]\s*\**\s*(流量型|人设型|变现型)/)?.[1] ?? '');
  const task = (text.match(/视频任务\**\s*[：:]\s*\**\s*([^\n]+)/)?.[1] ?? '').trim();
  if (!purpose) problems.push({ code: 'no-purpose', text: '策略卡没有写「用户目的」' });
  if (!task) problems.push({ code: 'no-task', text: '策略卡没有写「视频任务」' });
  return { node: makeTreeNode({ structure, purpose, task, source: title }), problems };
}

/**
 * 从一段上游正文读出契约：有「打法」小节的按选题读，否则按脚本策略卡读。空文字返回空读数（没有上游，不算认不出）。
 */
export function readContract(text: string, title = ''): ContractReading {
  const t = text || '';
  if (!t.trim()) return { node: null, problems: [] };
  return /打法/.test(t) ? readTopicContract(t, title) : readStrategy(t, title);
}

/** 选题正文里挑出这一条的契约节点；认不出返回 null */
export function treeNodeOfTopicBody(body: string, topicTitle = ''): TreeNode | null {
  return readTopicContract(body, topicTitle).node;
}

/**
 * 从一段上游正文读出契约，写成提示词块。读不出结构就返回空串，不写假的块；
 * 页面要不要提示，看 readContract 的 problems。
 */
export function contractBlockFromText(text: string, title = ''): string {
  const node = readContract(text, title).node;
  return node ? formatTreeBlock(node) : '';
}

/**
 * 契约行（净化时不能改它的字）：打法小节里写着结构名的行，以及同一行带「用的计 / 实际采用形式」标签的行。
 * 否则「内幕揭秘」会被平台词替换成「拆解」，「教知识·揭秘型」会变成「教知识·拆解型」，下游就认不出了。
 * 按小节判断：遇到下一个小节（编号小节、🅰、markdown 标题）就结束打法小节。
 */
const TACTIC_HEAD = /^\s*(?:[0-9]️?⃣|🅰|🅱)?\s*(?:打法|用的计|用的脚本|实际采用形式)/;
const SECTION_HEAD = /^\s*(?:#{1,6}\s|(?:[0-9]️?⃣|🅰|🅱))/u;
export function contractLineFlags(lines: string[]): boolean[] {
  let inTactic = false;
  return lines.map((line) => {
    const clean = line.replace(/\*\*/g, '');
    if (TACTIC_HEAD.test(clean)) {
      inTactic = true;
      return true;
    }
    if (SECTION_HEAD.test(clean)) inTactic = false;
    return inTactic && findStructure(clean) !== null;
  });
}

/** 单独一行是不是契约行（同一行带标签并写着结构名）。整段判断请用 contractLineFlags */
export function isContractLine(line: string): boolean {
  return contractLineFlags([line])[0];
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
