/**
 * 选题标题认不认得出分到的爆款元素（2026-10-28）。
 *
 * 大流量的选题必须用上爆款元素，而且标题要光看就认得出是哪个元素（lib/sharp-rules 的 BIG_OPENING_RULE）。
 * 这里按每条选题正文里写明的元素（「- 怀旧：套『当年最火的X』」「- **最差**：…」），
 * 看标题里有没有这个元素的句式词根。认不出 = 元素只写在正文里，标题没有看点。
 *
 * 2026-10-28 补这道检查的原因：回归原来只查年限、广告法、事实这些硬规则，选题变得平淡（比如「赫本风旧外套，敞穿还是扣上？」），
 * 测试照样通过。词根来自 lib/viral-elements 的句式，只认句式里固定的词，不认泛泛的情绪词。
 */

export const ELEMENT_NAMES = ['头牌', '怀旧', '反差', '最差', '荷尔蒙', '奇葩', '人群', '成本'] as const;
export type ElementName = (typeof ELEMENT_NAMES)[number];

/** 每个元素在标题里的句式词根（与 lib/viral-elements 的 patterns 对应） */
export const ELEMENT_TITLE_CUES: Record<ElementName, RegExp> = {
  头牌: /最贵|最牛|最顶|天花板|有多贵|有多牛|好在哪/,
  怀旧: /当年|那年|20年前|二十年前|十年前|小时候|以前|那会儿|古代人|老式|经典|年代|怀旧/,
  反差: /vs|VS|对比|曾经|反差|南方人|北方人|穷人|富人/,
  最差: /贬值最快|差评最多|没面子|反人类|最差|翻车|踩坑|最难|下头/,
  荷尔蒙: /异性|多看你|多看两眼|下头|心动|对方眼里/,
  奇葩: /外行|内行|不知道|内幕|神奇|冷知识/,
  人群: /星座|MBTI|内向|外向|第一次/,
  成本: /花小钱|办大事|十分之一|便宜又有面子|省钱|省时|小钱|几块钱/,
};

const NAME_ALT = ELEMENT_NAMES.join('|');
/** 正文里写元素的方式：「- 怀旧：」「- **怀旧**：」「怀旧：」（行首可以没有列表符号），或「爆款元素：怀旧、最差」 */
const LIST_LINE = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?(${NAME_ALT})(?:\\*\\*)?\\s*[：:]`, 'gm');
const INLINE_LINE = /爆款元素[^\n]{0,8}?[：:]\s*([^\n]+)/g;

export interface TopicElementResult {
  title: string;
  elements: ElementName[];
  visible: boolean;
}

/** 一条选题的标题：「## 选题1：标题」或块里的「**标题：** …」 */
function titleOfBlock(block: string): string {
  const head = block.split('\n')[0].replace(/^##\s*选题\s*\d+\s*[：:]?\s*/, '').replace(/\*\*/g, '').trim();
  if (head) return head;
  const m = block.match(/\*\*标题[：:]\*\*\s*([^\n]+)|标题[：:]\s*\**([^\n*]+)/);
  return (m?.[1] ?? m?.[2] ?? '').replace(/\*\*/g, '').trim();
}

function elementsOfBlock(body: string): ElementName[] {
  const found = new Set<ElementName>();
  // 「爆款元素」那一段（到「开篇钩子」为止）里出现的元素名都算：模型也会写成「怀旧＋最差：…」（2026-10-28）
  const section = body.match(/爆款元素[\s\S]*?(?=开篇钩子|$)/)?.[0] ?? '';
  if (section && !/爆款元素\**\s*\n?\s*无/.test(section)) {
    for (const name of ELEMENT_NAMES) if (section.includes(name)) found.add(name);
  }
  for (const m of body.matchAll(LIST_LINE)) found.add(m[1] as ElementName);
  for (const m of body.matchAll(INLINE_LINE)) {
    for (const name of ELEMENT_NAMES) if (m[1].includes(name)) found.add(name);
  }
  return [...found];
}

/** 每条写了元素的选题：标题认不认得出它用的元素（用了多个元素的，认出任意一个就算） */
export function topicElementResults(output: string): TopicElementResult[] {
  const out: TopicElementResult[] = [];
  for (const block of output.split(/\n(?=##\s*选题\s*\d+)/)) {
    if (!/^##\s*选题\s*\d+/.test(block.trim())) continue;
    const trimmed = block.trim();
    const title = titleOfBlock(trimmed);
    const elements = elementsOfBlock(trimmed.split('\n').slice(1).join('\n'));
    if (!title || !elements.length) continue;
    out.push({ title, elements, visible: elements.some((e) => ELEMENT_TITLE_CUES[e].test(title)) });
  }
  return out;
}

/** 认不出元素的标题，给体检用：「标题」（元素：怀旧） */
export function elementTitleIssues(output: string): string[] {
  return topicElementResults(output)
    .filter((r) => !r.visible)
    .map((r) => `「${r.title.slice(0, 40)}」标题里认不出爆款元素（${r.elements.join('、')}）`);
}
