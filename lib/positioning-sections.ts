/**
 * 账号定位的单节重生成。
 *
 * 【为什么需要】定位 12466 字、跑一次 5 分钟。用一段时间发现某个细节不对
 * （人设标签不准、人群写偏了），今天唯一的路是整份重生成——
 * 其他九成对的内容也会跟着变，等于为改一句话把整份方案重赌一次。
 * 结果是**用户不敢点重新生成**，这比不能改更糟。
 *
 * 所以给三个层次：
 *   ① 直接改      0 秒，覆盖八成场景
 *   ② 单节重生成  20-30 秒，只动这一节，其余一个字不动  ← 本文件
 *   ③ 整份重生成  方向整个变了才用
 *
 * 【产出要求从哪来】直接从 OUTPUT_FULL 里切，**不另写一份**。
 * 两处各记一份，迟早对不上——整份生成按 A 要求写，单节重生成按 B 要求写，
 * 用户会发现同一节两次生成的结构不一样。
 * 下面有测试确认每一节都真的切到了要求。
 */

import { OUTPUT_FULL, POSITIONING_REFS } from './positioning-standards';

export interface SectionDef {
  key: string;
  /** 界面上显示的名字 */
  label: string;
  /** 匹配标题：容忍 emoji、序号、括号后缀的差异 */
  match: RegExp;
  /** 顶层小节是 ##，六维是 ### */
  level: 2 | 3;
  /** 重生成这一节要带哪些参考资料。带全了浪费 token，带少了质量掉 */
  refs: Array<keyof typeof POSITIONING_REFS>;
  /** 一句话说明这节管什么，写在编辑区旁边 */
  hint: string;
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'summary',
    label: '核心结论',
    match: /核心结论/,
    level: 2,
    refs: [],
    hint: '整份方案的摘要。改了它不影响其他节，但其他节改了它就该跟着改',
  },
  {
    key: 'industry',
    label: '先说这一行',
    match: /先说这一行/,
    level: 2,
    refs: ['industry'],
    hint: '这门生意的规律。觉得说得不对你这行，重生成时把实情告诉它',
  },
  {
    key: 'interview',
    label: '我会先问老板的几个问题',
    match: /先问老板/,
    level: 2,
    refs: ['stance'],
    hint: '前采问题和推测。推测错了正好在这里纠正',
  },
  {
    key: 'oneline',
    label: '一句话定位',
    match: /一句话定位/,
    level: 2,
    refs: [],
    hint: '最常需要微调的一句。直接改往往比重生成快',
  },
  {
    key: 'persona',
    label: '人设定位',
    match: /人设定位/,
    level: 3,
    refs: ['persona', 'stance'],
    hint: '人设标签、验证、在同行里的位置',
  },
  {
    key: 'audience',
    label: '用户定位',
    match: /用户定位/,
    level: 3,
    refs: ['industry'],
    hint: '说给谁听。人群写偏是最常见的偏差',
  },
  {
    key: 'content',
    label: '内容定位',
    match: /内容定位/,
    level: 3,
    refs: ['contentMix', 'audienceChange'],
    hint: '主打类型和配比',
  },
  {
    key: 'presentation',
    label: '呈现定位',
    match: /呈现定位/,
    level: 3,
    refs: ['presentation'],
    hint: '用什么形式拍、一周能出几条',
  },
  {
    key: 'tone',
    label: '风格调性',
    match: /风格调性/,
    level: 3,
    refs: ['tone'],
    hint: '气质、会说和不会说的话',
  },
  {
    key: 'monetize',
    label: '变现定位',
    match: /变现定位/,
    level: 3,
    refs: ['economy'],
    hint: '只给结论。完整拆解在「商业定位」板块',
  },
  {
    key: 'memory',
    label: '记忆点设计',
    match: /记忆点/,
    level: 2,
    refs: ['memory'],
    hint: '口头禅、手势、道具',
  },
  {
    key: 'diff',
    label: '差异化',
    match: /差异化/,
    level: 2,
    refs: ['diff'],
    hint: '常规做法 + 一个变量',
  },
  {
    key: 'fivepack',
    label: '账号五件套',
    match: /五件套/,
    level: 2,
    refs: [],
    hint: '头像、昵称、简介、背景图、置顶',
  },
  {
    key: 'coherence',
    label: '自洽检验',
    match: /自洽检验/,
    level: 2,
    refs: ['coherence'],
    hint: '遮字幕、只听声音、三件套是否像同一个号',
  },
  {
    key: 'risk',
    label: '最大的风险',
    match: /最大的风险/,
    level: 2,
    refs: [],
    hint: '说实话的那一节，不要粉饰',
  },
];

const BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));
export const sectionOf = (key: string) => BY_KEY.get(key);

/** 一段 markdown 按小节切开。顶层按 ##，六维按 ### */
interface Chunk {
  key: string;
  heading: string;
  body: string;
}

function splitChunks(markdown: string): Chunk[] {
  const lines = markdown.split('\n');
  const out: Chunk[] = [];
  let cur: Chunk | null = null;

  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) {
      const level = m[1].length as 2 | 3;
      // 只认注册过的小节。模型自己分的 H3（前采问题、记忆点分类…）不算
      const hit = SECTIONS.find((s) => s.level === level && s.match.test(m[2]));
      if (hit) {
        if (cur) out.push(cur);
        cur = { key: hit.key, heading: line.trim(), body: '' };
        continue;
      }
      /*
       * 「## 六维地基」这类容器标题：它下面才是真正的小节（六维）。
       * 既不能当独立小节，也不能并进上一节——并进去的话
       * 「一句话定位」那节末尾会多出一行 `## 六维地基`，
       * 替换时还会把它一起换掉。直接丢弃，结束当前节。
       */
      if (level === 2) {
        if (cur) out.push(cur);
        cur = null;
        continue;
      }
    }
    if (cur) cur.body += line + '\n';
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * 快速版包含哪几节。
 *
 * 【为什么要有快速版】完整版 15 节、12000 多字，实测跑一次 287 秒。
 * 而线上漏斗是：100% 的人建了档案 → 40% 做完账号定位 → **10% 做到创作简报**。
 * 新用户在第二步就要对着一个五分钟不动的等待，走掉是必然的。
 *
 * 【为什么是这五节】用户明确说过重点是「人设、用户、内容」这三维，
 * 加上开头的核心结论（整份摘要）和一句话定位（最常被引用的那句）。
 * 其余十节是深化——等他真的要用的时候再补，不该挡在第一次体验前面。
 *
 * 顺序按 SECTIONS 来，不在这里另排，免得两处顺序对不上。
 */
export const QUICK_SECTION_KEYS = ['summary', 'oneline', 'persona', 'audience', 'content'] as const;

/**
 * 拼出快速版的产出要求。
 *
 * 直接从 OUTPUT_FULL 里切那几节，**不另写一份**——
 * 两处各记一份的话，快速版和完整版生成出来的同一节结构会不一样，
 * 用户补完剩下几节后会发现前后对不上。
 */
export function buildQuickOutputSpec(): string {
  const chunks = splitChunks(OUTPUT_FULL);
  const picked = QUICK_SECTION_KEYS.map((k) => chunks.find((c) => c.key === k)).filter(
    (c): c is NonNullable<typeof c> => Boolean(c)
  );

  return [
    '## 📤 输出格式',
    '',
    '按下面的顺序输出，标题原样保留。不要有前言，不要复述我给你的档案。',
    '',
    '# 🎯 账号定位方案',
    '',
    ...picked.map((c) => `${c.heading}\n${c.body.trimEnd()}`),
    '',
    '---',
    '',
    '⚠️ **只输出上面这几节，不要自己补别的小节。**',
    '这是快速版：先把最要紧的几件事说清楚，其余部分用户需要时会单独再要。',
  ].join('\n\n');
}

/** 解析定位全文 → 各小节内容 */
export function parsePositioning(markdown: string | null | undefined): Record<string, string> {
  if (!markdown?.trim()) return {};
  const out: Record<string, string> = {};
  for (const c of splitChunks(markdown)) out[c.key] = c.body.trim();
  return out;
}

/**
 * 把改好的一节换回原文，**其余一个字不动**。
 * 这是单节重生成的关键——不能整份重写。
 */
export function replaceSection(
  markdown: string,
  key: string,
  nextBody: string
): string {
  const def = sectionOf(key);
  if (!def) return markdown;

  const lines = markdown.split('\n');
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    if (start === -1) {
      if (level === def.level && def.match.test(m[2])) start = i;
      continue;
    }
    // 找到下一个注册小节，或任何不深于本节的标题，就是本节结束
    const isRegistered = SECTIONS.some((s) => s.level === level && s.match.test(m[2]));
    if (isRegistered || level < def.level) {
      end = i;
      break;
    }
  }

  if (start === -1) return markdown; // 原文里没有这一节，不乱插
  const body = nextBody.trim();
  return [...lines.slice(0, start + 1), '', body, '', ...lines.slice(end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * 从 OUTPUT_FULL 里切出每一节的产出要求。
 * 不另写一份——两处各记一份迟早对不上。
 */
function extractSpecs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of splitChunks(OUTPUT_FULL)) out[c.key] = c.body.trim();
  return out;
}

export const SECTION_SPECS = extractSpecs();

/**
 * 单节重生成的提示词。
 *
 * 只发这一节需要的东西：它自己的产出要求、对应的参考资料、
 * 用来保持一致的锚点（一句话定位 + 核心结论），以及用户说的哪里不对。
 * **不发整份方法论**——那是 12000 字，为一节付这个成本不值。
 */
export function buildSectionPrompt(params: {
  sectionKey: string;
  /** 定位全文，用来取锚点和这一节的现状 */
  positioningFull: string;
  /** 用户说哪里不对、想改成什么 */
  note: string;
  profileSummary?: string;
}): string {
  const def = sectionOf(params.sectionKey);
  if (!def) return '';

  const parsed = parsePositioning(params.positioningFull);
  const current = parsed[def.key] || '';
  const refs = def.refs.map((k) => POSITIONING_REFS[k]).filter(Boolean).join('\n\n');

  // 锚点：让重写的这一节和其余部分对得上，不要自成一套
  const anchors = [
    parsed.oneline ? `**一句话定位**：${parsed.oneline}` : '',
    parsed.summary ? `**核心结论**：\n${parsed.summary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return `你是一位做实体店短视频代运营的资深编导。
一份账号定位方案已经做好了，现在**只重写其中的「${def.label}」这一节**。

## ⚠️ 只改这一节

- 其余各节保持不变，你不需要输出它们
- 重写的内容必须和下面的锚点保持一致，不要另起一套
- **直接输出这一节的正文**，不要写小节标题，不要写前言，不要解释你在改什么

## 📌 这份方案已经定下的东西（保持一致）

${anchors || '（暂无）'}
${params.profileSummary?.trim() ? `\n## 📇 账号档案\n\n${params.profileSummary.trim()}\n` : ''}
## 📄 这一节现在写的是

${current || '（这一节目前是空的）'}

## 🔧 用户说哪里不对

${params.note.trim() || '（用户没说具体问题，请按下面的要求重做一版，换个角度）'}
${refs ? `\n## 📚 判断依据\n\n${refs}\n` : ''}
## 📤 这一节的产出要求

${SECTION_SPECS[def.key] || '（沿用原有结构）'}

## ✍️ 写作要求

- **针对用户说的问题改**，不要把整节推倒重来
- 具体到能执行，不要写"要注重…"这类空话
- 所有建议必须在这个账号的真实资源之内
- 只输出正文`;
}
