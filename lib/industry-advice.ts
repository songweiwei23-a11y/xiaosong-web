/**
 * 行业建议（药方）。
 *
 * 账号定位是体检：这个号是什么、说给谁听。内容定位是查病根：长期发什么。
 * 行业建议开的是药方：这个号现在处在哪个阶段、为了哪个目的，接下来每一步
 * 针对哪类人、要达到什么结果、怎么拍、怎么判断该不该换阶段。
 *
 * 产出存进 account_positioning（类型「行业建议」），创作上下文里读最新一份，
 * 注入所有创作板块：选题、脚本、方向、起号……都照它走，不再各自乱猜。
 */

export const ADVICE_TYPE = '行业建议';

export const ADVICE_PURPOSES = [
  { key: 'traffic', label: '大流量', desc: '让陌生人看见：涨粉、破圈。结尾只留关注或评论。' },
  { key: 'persona', label: '人设型', desc: '让人认识你、信你：建立信任，结尾是关注或看主页。' },
  { key: 'monetize', label: '变现型', desc: '让目标客户咨询、到店、下单。结尾只选一个动作。' },
  { key: 'staged', label: '分阶段推进', desc: '先起量，再立人设，最后变现。当前重心由下面的阶段决定。' },
] as const;

export const ADVICE_STAGES = [
  { key: 'start', label: '起号期', desc: '几乎没有稳定数据，还在摸索什么内容有效。' },
  { key: 'accumulate', label: '积累期', desc: '有一些作品，大致知道能拍什么，但还没起量。' },
  { key: 'scale', label: '放量期', desc: '某类内容已经起量，要放大、复制。' },
  { key: 'monetize', label: '变现期', desc: '有稳定流量，要把它变成咨询、到店和成交。' },
] as const;

export type AdvicePurposeKey = (typeof ADVICE_PURPOSES)[number]['key'];
export type AdviceStageKey = (typeof ADVICE_STAGES)[number]['key'];

export interface AdviceInput {
  purpose: AdvicePurposeKey;
  stage: AdviceStageKey;
  /** 现状：发了多少条、哪类数据好、卡在哪。编导自己写 */
  situation: string;
  /** 这一阶段想达到的具体结果（选填） */
  goal?: string;
}

export function purposeLabel(key: string): string {
  return ADVICE_PURPOSES.find((p) => p.key === key)?.label ?? key;
}

export function stageLabel(key: string): string {
  return ADVICE_STAGES.find((s) => s.key === key)?.label ?? key;
}

export function buildIndustryAdvicePrompt(params: {
  profileSummary: string;
  /** 已确定的账号定位（六维地基）。没有就写明没有，让模型把话说圆 */
  baseline?: string;
  /** 商业定位深挖结论：成交路径、凭什么信你。没有就不带这一段 */
  businessBaseline?: string;
  /** 内容定位深挖结论：内容方向、系列、配比。没有就不带这一段 */
  contentBaseline?: string;
  input: AdviceInput;
  /** 作品数据汇总（lib/performance 的 performancePromptBlock）。没有就空 */
  performanceBlock?: string;
  taboos?: string;
}): string {
  const { profileSummary, baseline, businessBaseline, contentBaseline, input, performanceBlock, taboos } = params;
  const purpose = ADVICE_PURPOSES.find((p) => p.key === input.purpose);
  const stage = ADVICE_STAGES.find((s) => s.key === input.stage);

  return `你是一位短视频代运营的主编。你要开的是一份「行业建议」——给这个账号的药方。

账号定位是体检（这个号是什么、说给谁听），内容定位是查病根（长期发什么）。
你要做的是开药方：这个号在当前阶段、为了既定目的，每一步针对哪类人、要达到什么结果、怎么拍、怎么判断该不该进入下一阶段。

## 这次的目的与阶段（编导已选定，是方案的前提）

- **账号目的**：${purpose ? `${purpose.label}——${purpose.desc}` : input.purpose}
- **当前阶段**：${stage ? `${stage.label}——${stage.desc}` : input.stage}
- **现状（编导自述）**：${input.situation.trim() || '编导未填写，请按档案和数据推断，并在方案里明确标出是推断的'}
${input.goal?.trim() ? `- **这一阶段想达到的结果**：${input.goal.trim()}` : ''}

## 账号档案

${profileSummary}

${baseline ? `## 已确定的账号定位（这份方案必须与它一致）\n\n${baseline.slice(0, 6000)}` : '## 账号定位\n\n这个号还没有生成过账号定位。方案里要说明：哪些判断是基于档案推断的，定位出来后需要复核。'}

${contentBaseline ? `## 已做过的内容定位（内容方向的来源，方案要引用它）\n\n${contentBaseline.slice(0, 4000)}\n` : ''}
${businessBaseline ? `## 已做过的商业定位（成交路径的来源，方案要引用它）\n\n${businessBaseline.slice(0, 4000)}\n` : ''}
${performanceBlock ? `${performanceBlock}\n` : ''}${taboos ? `${taboos}\n` : ''}
## 输出要求

行业建议和创作简报同等重要：简报管写法，它管「这个号在这个行业里到底该做什么、不该做什么」。按下面的结构输出 Markdown，每一节都要落到这个账号和这个行业上，不写口号和通用道理：

1. **核心判断**：两三句话说清这个号在行业里的位置，以及现阶段最关键的矛盾（病根）。依据是档案、数据和已确定的内容定位、商业定位；数据不够就直说不够。
2. **行业真实打法**：这个赛道的客户在哪里做决定、靠什么成交（到店、咨询、下单、转介绍等），在抖音上什么内容能让他们信、愿意来。只写这个行业的规律，不写「做好内容很重要」这类废话。行业规律是推断的标「推断」，需要核实的标「待核实」。
3. **应该做什么**（3–5 条）：每条写清做什么内容，对准目标人群的哪个真实需求，服务商业定位里哪一步成交路径，或内容定位里哪一个系列。每个内容方向说清靠什么满足三有：有用处（观众带走什么）、有兴趣（开头为什么停下来）、有共鸣（说出他们心里的哪句话）；三条都说不出来的方向不要列。每条标明出自「内容定位」的哪一条，成交动作标明出自「商业定位」的哪一条。找不到出处的写【待确认】。
4. **不该做什么**（3–5 条）：每条写清不做什么，为什么这个阶段不能做（会伤到什么），用什么替代。档案禁忌里排除的内容一律列在这里。
5. **核心策略**：一句话的主线。三类视频（大流量 / 人设型 / 变现型）各占的配比，各自负责什么，每类只一个结尾动作。配比说的是目的，不是脚本类型。
6. **接下来 30 天的三条硬规则**：选题和脚本必须遵守的具体约束，要能直接拿来判断一条选题行不行（例如「每条都要带一个到店理由」，而不是「多做互动」）。
7. **进入下一阶段的条件**：出现哪些数据或迹象就该换阶段，换的时候重心怎么变。这个阶段的基线写清楚；没有基线就写「待建立」。

## 硬约束

- 不编造任何数字、案例、客户故事、效果承诺。缺的事实用【待确认】标出
- 价格、价位、人均、营业时间、地址、作息、门店活动，只有档案或素材里写了才能用。档案里没有的，写成「价格摆在明面」这类做法即可，具体数字用【待确认】占位，不要替它定价
- 阈值类数字（完播率、播放量、咨询人数、转化率）一律不给具体合格线，例如「完播低于 X% 就换」。改成和这个号自己过去的数据比较；没有历史数据就写「待建立」
- 「应该做」和「不该做」必须能追溯到内容定位或商业定位。${contentBaseline || businessBaseline ? '两者都已有，逐条标出处。' : '内容定位和商业定位都还没有做。这种情况下，所有打法都标为推断，并把「先补做内容定位、商业定位」列为应该做的第一条。'}
- 档案里写着「未填」「待补充」或留空的项，不当作事实使用，也不凭行业印象补成具体值；推断出来的内容要标明是推断
- 与账号档案的事实冲突时以档案为准
- 禁忌里写的不能说、不能拍，方案里一律不出现
- 不输出寒暄和过程说明，只输出方案正文`;
}

/**
 * 三有自检（知识库《小黄本课程》：内容被喜爱的三有原则）。
 * 只给产出选题、脚本、方向的板块：每条都要能说出靠什么满足三有。
 */
export function threeHavesBlock(): string {
  return [
    '## ✅ 三有自检（每一条都要过）',
    '',
    '- **有用处**：观众看完能带走一个具体的东西（一招、一个判断、一个避坑）。说不出来的，不出。',
    '- **有兴趣**：开头要让目标人群停下来，和他们的问题、场景直接相关，不是泛泛的知识。',
    '- **有共鸣**：说出他们心里想说却没说的话，或者他们正经历的处境。',
    '',
    '三条里说不出靠什么满足的，这条选题/脚本/方向就不要给；宁可少给，不凑数。',
  ].join('\n');
}

/**
 * 注入创作板块的块。没有行业建议就返回空串，调用方直接拼接。
 * 超长时在段落边界截断，不在句子中间断开。
 * 上限 6000：2026-10-19 实测新提示词的输出约 4100 字，核心策略、硬规则、复诊条件排在 3000 字之后，3000 会把它们截掉。
 */
export function adviceContextBlock(advice: string | null | undefined, maxLen = 6000): string {
  const body = advice?.trim();
  if (!body) return '';
  let text = body;
  if (text.length > maxLen) {
    const cut = text.slice(0, maxLen);
    const at = cut.lastIndexOf('\n');
    text = (at > maxLen * 0.6 ? cut.slice(0, at) : cut) + '\n（以下略）';
  }
  return [
    '## 🩺 这个账号的行业建议（药方）',
    '',
    text,
    '',
    '⚠️ 以上是这个账号当前阶段的打法。选题、脚本、方向、起号等规划都要照它执行；与它冲突的以它为准。与账号背景事实冲突的，以账号背景为准。',
  ].join('\n');
}
