/**
 * 跨行业二创：拿别的行业的爆款（拆解报告，或者直接贴的文案），借它的开篇、结构、拍法……
 * 换成这个账号自己的行业、自己的事来拍。
 *
 * 【方法依据】知识库「素材库的搭建」一课（库1·4）、综合知识手册 3.2：
 *   - 行业内看选题；**跨行业看开篇、金句、呈现形式**——避开同行内卷
 *   - 开篇：统一开篇结构，替换行业关键词即可复用（"信不信15秒让你放弃摆摊"适用于不同行业）
 *   - 文案结构：困境→转机这类结构适用于多个故事（卖豆腐脑还债 vs 卖粽子换大G）
 *   - 呈现形式五个可变维度：拍摄角度、出镜人物、出场方式、道具、剪辑方式
 *   - 案例："帮粉丝做账号"系列 ← 借鉴自"帮粉丝买车"系列
 *   案例引入型结构（库1·21）：案例 → 提炼知识 → 跨行业应用
 *
 * 【产品方定】自由度拉满：借哪几层、出几个方案、方案之间怎么拉开、写多深、什么目的、多长、
 * 要哪些产出，全交给用户选（2026-09-30）。
 */

export const REMIX_TASK_TYPE = '跨行业二创';

export interface Choice<T extends string = string> {
  id: T;
  label: string;
  hint: string;
}

/** 可以借的层。前三个是知识库说的"跨行业该借的"，默认选上 */
export const BORROW_LAYERS = [
  { id: 'opening', label: '开篇句式', hint: '前 3 秒怎么抓人：保留句式结构，换成你行业的词' },
  { id: 'structure', label: '结构骨架', hint: '段落顺序：比如困境→转机、结果前置→补原因' },
  { id: 'presentation', label: '呈现形式', hint: '怎么拍：口播/vlog/剧情、视角、出镜人物、道具' },
  { id: 'rhythm', label: '镜头节奏', hint: '多长切一刀、景别怎么跟着情绪变' },
  { id: 'emotion', label: '情绪曲线', hint: '情绪在哪几秒起伏、靠什么起伏' },
  { id: 'suspense', label: '悬念和兑现', hint: '钩子埋在哪、第几秒兑现' },
  { id: 'punchline', label: '金句', hint: '收尾那句让人想转发的话' },
  { id: 'persona', label: '人设和人物关系', hint: '谁出镜、跟谁对话、是什么身份' },
  { id: 'conversion', label: '结尾和转化', hint: '行动指令、怎么引到店/私信/下单' },
  { id: 'series', label: '系列化', hint: '能不能做成一个系列（"帮粉丝买车"→"帮粉丝做账号"）' },
  { id: 'topicAngle', label: '选题角度', hint: '同一个话题换你的行业讲。知识库建议同行业更该学选题，跨行业主要学表达' },
] as const satisfies readonly Choice[];
export type BorrowLayer = (typeof BORROW_LAYERS)[number]['id'];
export const DEFAULT_LAYERS: BorrowLayer[] = ['opening', 'structure', 'presentation'];

export const COUNT_OPTIONS = [1, 2, 3, 5] as const;
export type RemixCount = (typeof COUNT_OPTIONS)[number];

export const DIFFERENTIATE = [
  { id: 'auto', label: 'AI 自己拉开', hint: '每个方案尽量不一样' },
  { id: 'layer', label: '每个借不同的层', hint: '一个借开篇、一个借结构、一个借拍法……' },
  { id: 'topic', label: '借法一样，换选题', hint: '同一套借法，套到你店里不同的事上' },
  { id: 'form', label: '借法一样，换拍法', hint: '同一个选题，口播一版、vlog 一版、剧情一版' },
] as const satisfies readonly Choice[];
export type Differentiate = (typeof DIFFERENTIATE)[number]['id'];

export const DEPTHS = [
  { id: 'quick', label: '快速', hint: '方向 + 开头 + 口播要点，先挑一个再细化' },
  { id: 'full', label: '完整', hint: '按你勾的产出写全' },
  { id: 'deep', label: '深度', hint: '分镜细到每一镜的台词、动作、时长，再给 3 个备选开头' },
] as const satisfies readonly Choice[];
export type Depth = (typeof DEPTHS)[number]['id'];

export const ROLES = [
  { id: 'same', label: '跟原片一样', hint: '原片是什么目的就是什么' },
  { id: '流量型', label: '流量型', hint: '让更多人看到' },
  { id: '人设型', label: '人设型', hint: '让人记住你、信你' },
  { id: '变现型', label: '变现型', hint: '推到店、私信、下单' },
] as const satisfies readonly Choice[];
export type RemixRole = (typeof ROLES)[number]['id'];

export const DURATIONS = ['跟原片', '15 秒', '30 秒', '60 秒', '90 秒', '3 分钟'] as const;
export type RemixDuration = (typeof DURATIONS)[number];

export const OUTPUTS = [
  { id: 'script', label: '口播全文', hint: '按结构段落标好，照着念' },
  { id: 'shots', label: '分镜', hint: '每一镜拍什么、说什么' },
  { id: 'shootPlan', label: '拍摄清单', hint: '用你手上的人、设备、场地怎么拍' },
  { id: 'titles', label: '标题和封面', hint: '3 个标题 + 封面字' },
  { id: 'comment', label: '评论区置顶', hint: '一条引导互动的置顶评论' },
  { id: 'altOpenings', label: '备选开头', hint: '再给 3 个不同的开头' },
] as const satisfies readonly Choice[];
export type RemixOutput = (typeof OUTPUTS)[number]['id'];
export const DEFAULT_OUTPUTS: RemixOutput[] = ['script', 'shots', 'shootPlan'];

export interface RemixSource {
  kind: 'breakdown' | 'paste';
  /** 拆解报告全文，或者用户贴的文案/描述 */
  text: string;
  /** 原片叫什么（拆解时的文件名、或用户填的） */
  title?: string;
  /** 原片是什么行业（贴文案时用户填） */
  industry?: string;
}

export interface RemixOptions {
  layers: BorrowLayer[];
  count: RemixCount;
  differentiate: Differentiate;
  depth: Depth;
  role: RemixRole;
  duration: RemixDuration;
  outputs: RemixOutput[];
  /** 账号档案摘要（lib/profile-summary）；没有档案时为空，用 targetIndustry */
  profileSummary?: string;
  /** 档案里的硬禁忌 */
  restrictions?: string;
  /** 没档案时手填的"我是做什么的" */
  targetIndustry?: string;
  /** 补充要求 */
  notes?: string;
}

/** 拆解报告传过来之前先瘦身：逐个镜头的卡片最占字数、对二创用处最小，只留节奏一览和其余各节 */
export const MAX_SOURCE_CHARS = 14_000;
export function condenseBreakdown(report: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of report.split('\n')) {
    if (/^#{3,4}\s*镜头\s*\d/.test(line)) {
      skipping = true;
      continue;
    }
    // 碰到下一个标题（不是镜头卡片）或者加粗的小节名，就不跳了
    if (skipping && (/^#{1,4}\s/.test(line) || /^\*\*[^*]+\*\*\s*$/.test(line.trim()))) skipping = false;
    if (!skipping) out.push(line);
  }
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) + '\n……（后面省略）' : text;
}

const label = <T extends string>(list: readonly Choice<T>[], id: T) => list.find((c) => c.id === id)?.label ?? id;

/**
 * 每一层"借"具体指什么。只列用户勾的；没勾的层要换成他自己的，不许照搬原片。
 */
const LAYER_RULES: Record<BorrowLayer, string> = {
  opening: '开篇：保留原片开头的**句式结构**和抓人的机制（悬念/反常识/冲突……），把行业词、人物、事件换成这个账号的',
  structure: '结构：保留原片段落的**顺序和每段的作用**（比如结果前置→补原因→细节证据→转机），每段的内容全部换成这个账号自己的事',
  presentation: '呈现形式：借原片**怎么拍**——呈现方式（口播/vlog/剧情/采访）、视角、出镜人物、道具、出场方式；场景换成这个账号能拍到的',
  rhythm: '镜头节奏：借原片的**切镜频率和景别变化**（多长切一刀、什么时候上特写）',
  emotion: '情绪曲线：借原片**情绪起伏的位置和手法**（第几秒跌、第几秒升、靠什么），情绪点换成这个账号真实会发生的事',
  suspense: '悬念和兑现：借原片**埋钩子和兑现的节奏**（钩子在哪、隔多久兑现），钩子内容换成这个账号的',
  punchline: '金句：借原片金句的**句式**（对仗、反转、比喻），内容换成这个行业的道理',
  persona: '人设和人物关系：借原片**谁出镜、跟谁互动、以什么身份说话**，身份换成这个账号的老板/员工/客人',
  conversion: '结尾和转化：借原片**结尾的行动指令设计**，指向这个账号的转化路径（到店/私信/团购）',
  series: '系列化：看原片能不能抽成一个**可以连续拍的系列**（保留系列的格式，换成这个行业能一集集拍下去的主题）',
  topicAngle: '选题角度：借原片**讨论的话题或角度**，换成这个行业的说法（同一选题不同表达）',
};

export function buildRemixPrompt(source: RemixSource, o: RemixOptions): string {
  const layers = o.layers.length ? o.layers : DEFAULT_LAYERS;
  const notBorrowed = BORROW_LAYERS.filter((l) => !layers.includes(l.id)).map((l) => l.label);
  const outputs = new Set(o.outputs);
  const quick = o.depth === 'quick';
  const deep = o.depth === 'deep';
  const sourceText = source.kind === 'breakdown' ? condenseBreakdown(source.text) : source.text.trim().slice(0, MAX_SOURCE_CHARS);

  const sections: string[] = [
    `### 方案 1：一个让人一看就懂的名字`,
    `**一句话**：原片的「什么」→ 你店里的「什么」（例：原片"帮粉丝买车" → 你的"帮客人挑今天最新鲜的那块肉"）`,
    `**借了**：…… **换成自己的**：……`,
    '',
    `#### 迁移对照`,
    `| 层 | 原片 | 你的版本 |`,
    `（每个借的层一行，再加一行"事件/主角"——说清原片讲的是谁的什么事、你讲的是谁的什么事）`,
    '',
    `#### 开头（前 3 秒）`,
    `第一句话逐字写出来，再写这 3 秒画面里有什么`,
  ];
  if (quick) {
    sections.push('', `#### 口播要点`, `按结构分段列要点，每段一两句，不写全文`);
  } else {
    if (outputs.has('script')) sections.push('', `#### 口播全文`, `按结构分段，每段前面用【】标出这段的作用（如【开篇钩子】【铺垫】【证据】【兑现】【行动指令】），总长度符合要求的时长`);
    if (outputs.has('shots'))
      sections.push(
        '',
        `#### 分镜`,
        deep
          ? `每一镜一行列表：**镜头 N｜起止秒数**：画面（谁、在哪、做什么动作）｜景别和运镜｜台词或字幕原文｜这一镜的作用。镜头要细到能直接照着拍`
          : `每一镜一行列表：**镜头 N｜起止秒数**：画面｜台词或字幕。6～10 镜`
      );
    if (outputs.has('shootPlan')) sections.push('', `#### 用你手上的资源怎么拍`, `几个人、谁出镜、用什么设备、在哪拍、要准备什么道具、大概拍多久；档案里没有的资源不要安排`);
    if (outputs.has('titles')) sections.push('', `#### 标题和封面`, `3 个标题 + 封面上的字（封面字 10 个字以内）`);
    if (outputs.has('comment')) sections.push('', `#### 评论区置顶`, `一条引导互动的置顶评论`);
    if (outputs.has('altOpenings') || deep) sections.push('', `#### 备选开头`, `再给 3 个不同类型的开头，一句话一个`);
  }
  sections.push('', `#### 注意`, `原片学不来的部分（靠身份、高成本、偶然）这个方案怎么绕开；以及"这条不是搬运"：台词、画面、事件都是自己的`);

  const target = o.profileSummary?.trim()
    ? `## 这个账号（二创要落到它身上）\n${o.profileSummary.trim()}`
    : `## 这个账号\n${o.targetIndustry?.trim() ? `做的是：${o.targetIndustry.trim()}` : '用户没说自己是做什么的：按原片最容易迁移的实体店行业举例，并提醒他选好档案再做一次'}`;

  return `【任务：跨行业二创】你是带过上百个实体店起号的编导。下面是别的行业一条爆款的拆解（或文案），
帮这个账号把它**二创**成自己能拍的内容。目的不是照抄，是借走它火的"机制"，换上自己的血肉。

## 方法（知识库原则，必须守住）
- **行业内看选题，跨行业看开篇、金句、呈现形式**——这是避开同行内卷的办法
- 借的是**结构和机制**（句式、段落顺序、拍法、节奏），**不是具体内容**：
  原片的台词、画面、人物经历、数字一律不搬。"帮粉丝买车"→"帮粉丝做账号"是二创；把原片台词换两个词念一遍是搬运，平台会判搬运、不给流量
- 开篇：保留句式结构，替换行业关键词（"信不信15秒让你放弃摆摊"换任何行业都能用）
- 结构：困境→转机、结果前置→补原因这类骨架跨行业通用，每段的事要换成这个账号真实会发生的事
- 呈现形式有五个可变维度：拍摄角度、出镜人物、出场方式、道具、剪辑方式

## 原片${source.title ? `：${source.title}` : ''}${source.industry ? `（${source.industry}）` : ''}
${source.kind === 'breakdown' ? '（下面是这条视频的拆解报告，逐个镜头的卡片已省略，节奏一览还在）' : '（下面是用户贴的原片文案或描述）'}
${sourceText}

${target}
${o.restrictions?.trim() ? `\n## 硬禁忌（所有方案、例子、台词都不能碰）\n${o.restrictions.trim()}\n` : ''}
## 用户的选择（按他选的来）
- **借这几层**：
${layers.map((l) => `  - ${LAYER_RULES[l]}`).join('\n')}
${notBorrowed.length ? `- **没选的层**（${notBorrowed.join('、')}）：用这个账号自己的，不要照搬原片` : ''}
- **出 ${o.count} 个方案**${o.count > 1 ? `，方案之间：${label(DIFFERENTIATE, o.differentiate)}（${DIFFERENTIATE.find((d) => d.id === o.differentiate)?.hint}）` : ''}
- **深度**：${label(DEPTHS, o.depth)}（${DEPTHS.find((d) => d.id === o.depth)?.hint}）
- **目的**：${o.role === 'same' ? '跟原片一样（先判断原片是流量型/人设型/变现型）' : o.role}——结尾的行动指令按这个目的只选一个
- **时长**：${o.duration === '跟原片' ? '和原片差不多' : o.duration}
${o.notes?.trim() ? `- **补充要求**：${o.notes.trim()}` : ''}

## 输出格式（Markdown；${o.count} 个方案，每个都按下面这个样子，方案之间用 --- 隔开）
先用两三句话说：原片火的核心机制是什么、为什么能跨行业借。然后：

${sections.join('\n')}

最后一段 **### 我推荐先拍哪个**：说清为什么（最好拍、最贴这个账号、最容易出效果）。

## 要求
- 每个方案都必须是**这个账号手上的资源拍得出来的**（看档案里的团队、设备、场地）
- **不要替他编经历**：档案和前采要点里没有的人生经历、转折事件（辞职、创业、亏钱、家里出事……），
  不许写成真事。要用到的地方写成「【换成你的：……】」让他换成自己的真实经历，里面给一个参考方向，比如
  「【换成你的：开店时真实遇到过的一个难处，比如第一个月生意很差】」。
  （口播里标段落作用的【开篇钩子】【铺垫】是另一回事，要填的地方一定以"换成你的："开头，一眼分得清）
  实测：原片是真人真事，模型替老板编了"辞掉大厂工作、撕了 X 万年薪工资条"——档案里根本没有，照着拍就是假故事，
  而这类内容的核心恰恰是真实
- 不要替用户编数字：档案里没有的人数、金额、年限、播放量写成 X
- 不说"揭秘"，不用绝对化用语，不诋毁同行和客人
- 大白话，不要"赋能""打造""矩阵"这类词`;
}
