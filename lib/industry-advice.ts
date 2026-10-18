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

行业建议只管「这个阶段怎么打」，不重复定位。账号是谁（账号定位）、长期拍什么（内容定位）、靠什么成交（商业定位）已经定好，这里只引用它们的原名。按下面的结构输出 Markdown，每一节都落到这个账号和这个阶段上：

1. **本阶段判断**：这个阶段和目的下，现状和目标之间差在哪里，依据是档案和作品数据。数据不够就直说不够。
2. **本阶段重心方向**：给 2–3 个建议方向，优先引用内容定位里已有的系列原名。每个写清：这一阶段它负责哪个目的（流量、人设、变现）、占本阶段的比例、为什么选它（对准哪个真实需求，依据档案的哪条事实）。这是建议，用户自己选定的方向优先。
3. **每类目的的结尾动作**：流量、人设、变现各一个结尾动作，每类只留一个。变现型的动作要对应商业定位里的哪一步，写出原步骤名。
4. **本阶段暂停什么**：2–3 条，每条写依据（禁忌、档案，或内容定位里的排除项）。
5. **30 天执行规则**：3 条，只约束选题和脚本怎么做（例如「每条都要在前 5 秒说出位置」），不重述定位。
6. **复诊条件**：出现哪些迹象就该换阶段，换的时候重心怎么变。只写可以观察的迹象（例如「连续几条都有陌生人在评论区问地址」），用这个号自己过去的数据比；**不写任何具体数字**（播放量、新客人数、连续条数都不写）。

## 硬约束

- 药方是建议，不是命令。用户选定的方向优先：用户的方向不在内容定位里，就照用户的方向给建议，并说明它和内容定位、本阶段重心的差距，不阻止、不改写。
- 不替用户新增或改写内容定位。如果本阶段反复需要内容定位里没有的方向，只写「建议把它加进内容定位」，由用户决定。
- 拍小票、结账、价格画面时，金额一律用【待确认】或「金额打码」，档案里没有的数字不写。
- 不重述账号定位（这个号是谁、说给谁、凭什么信）、内容定位（长期拍什么）、商业定位（靠什么赚钱）的内容，只引用原名。
- ${contentBaseline ? '内容定位已有，第 2 节优先引用它的原系列名。' : '内容定位还没有做。第 2 节写「【待内容定位】」，方向先按用户选定的来给建议，之后补做内容定位会更准；其余照常，但标为推断。'}
- ${businessBaseline ? '商业定位已有，第 3 节的变现动作写出原步骤名。' : '商业定位还没有做。第 3 节的变现动作写【待商业定位】。'}
- 不编造任何数字、案例、客户故事、效果承诺。缺的事实用【待确认】标出
- 价格、价位、人均、营业时间、地址、作息、门店活动，只有档案或素材里写了才能用。档案里没有的，写成「价格摆在明面」这类做法即可，具体数字用【待确认】占位，不要替它定价
- 阈值类数字（完播率、播放量、咨询人数、转化率）一律不给具体合格线，例如「完播低于 X% 就换」。改成和这个号自己过去的数据比较；没有历史数据就写「待建立」
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
export function adviceContextBlock(advice: string | null | undefined, maxLen = 6000, stale: string[] = []): string {
  const body = advice?.trim();
  if (!body) return '';
  let text = body;
  if (text.length > maxLen) {
    const cut = text.slice(0, maxLen);
    const at = cut.lastIndexOf('\n');
    text = (at > maxLen * 0.6 ? cut.slice(0, at) : cut) + '\n（以下略）';
  }
  const lines = [
    '## 🩺 这个账号的行业建议（药方）',
    '',
    text,
    '',
    '⚠️ 以上是这个账号当前阶段的打法：选题、脚本、方向、起号照它执行。它是建议，不是命令：用户选定的方向优先，和用户的选择有差距时提示差距，不阻止。与账号背景事实冲突的，以账号背景为准。',
  ];
  if (stale.length) {
    lines.push(`⚠️ ${stale.join('、')}在这份药方生成之后更新过，药方可能已经过期，**先复诊再照做**。`);
  }
  return lines.join('\n');
}

/**
 * 药方生成之后，哪些上游定位又更新过了（按生成时间比较）。
 * 上游的时间取的是这类定位最新一份的生成时间；没有时间的不算。
 */
export function staleUpstream(adviceAt: string | null | undefined, upstream: { name: string; at?: string | null }[]): string[] {
  const base = adviceAt ? Date.parse(adviceAt) : NaN;
  if (!Number.isFinite(base)) return [];
  return upstream
    .filter((u) => u.at && Number.isFinite(Date.parse(u.at)) && Date.parse(u.at) > base)
    .map((u) => u.name);
}
