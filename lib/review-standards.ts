/**
 * 审稿优化的评判标准。
 *
 * 改造前，审稿的整个提示词只有三句话：逐项分析给评分、给优化建议、
 * 有对标就对比。没有评分标准、没有维度定义、没有及格线、没有范例——
 * 模型只能凭感觉打分，同一篇稿子今天 8 分明天 6 分，用户无从判断该信谁。
 *
 * 而脚本生成那边早就有一套成熟的体系（lib/quality-checker.ts）：
 * 七个维度带权重、三级话术禁忌、9.0 分的 MCN 线、9.5 分的参考范例。
 * 审稿完全没有复用它——同一个产品里，写稿和审稿用的是两把尺子。
 *
 * 这里把那把尺子搬过来，并且多做一件模型做不好的事：
 * 先用正则把能量化的部分（秒数标注几处、有没有金句、金句多少字、
 * 废话开场在不在）数清楚，把事实喂给模型，让它专心做判断而不是数数。
 */

import {
  FORBIDDEN_PHRASES,
  REQUIRED_ELEMENTS,
  evaluateScriptQualityStrict,
  getRelevantExample,
} from './quality-checker';
import { roleInferRule } from './content-roles';
import { continuationRules } from './creation-continuation';

export interface ReviewPromptParams {
  draftContent: string;
  platform: string;
  duration: string;
  scriptType: string;
  /** 用户勾选的审稿维度，已按分组拼好 */
  reviewDimensions: string;
  optimizationGoals: string;
  benchmarkScript: string;
  /** 是否输出「原文 vs 改写」的逐句对照 */
  compareMode: boolean;
  /** 是否给每个问题标注严重程度 */
  severityLabels: boolean;
  /**
   * 账号的创作上下文。审稿最需要它——「这句话好不好」离开了
   * 「说给谁听、这个号是什么语气、有什么绝对不能说的」根本判不了。
   * 此前审稿只拿到一篇孤零零的稿子，评的是通用好坏。
   */
  contextBlock?: string;
  /**
   * 用户的个人要求（2026-10-02 产品方："优先级最高，比如原稿时长短、有错误，我在个人要求里指出，按要求来"）。
   * 放在提示词最前面，并在优化稿那一节再提醒一次
   */
  personalRequirements?: string;
}

/** 时长选「AI 推荐」时传这个值 */
export const AI_DURATION = 'AI推荐';

/** 把七个评分维度连同权重写成表格，模型照着打分才有一致性 */
function rubricTable(): string {
  const rows = [
    ...REQUIRED_ELEMENTS.basic.map((e) => ({ name: e.name, weight: e.weight, note: basicNote(e.id) })),
    ...REQUIRED_ELEMENTS.advanced.map((e) => ({ name: e.name, weight: e.weight, note: advancedNote(e.id) })),
  ];
  return [
    '| 维度 | 权重 | 达标的含义 |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.name} | ${r.weight} 分 | ${r.note} |`),
  ].join('\n');
}

function basicNote(id: string): string {
  switch (id) {
    case 'hook': return '开头单独标注了钩子，且 3 秒内进入冲突/痛点/反常识/利益点';
    case 'emotion': return '全篇至少 3 处情绪波点，且落在情绪转折处而非随手撒符号';
    case 'timing': return '至少 3 处「X-X秒」的时间区间标注，总时长对得上';
    case 'scene': return '每个镜头都有画面描述，不是只有台词';
    default: return '';
  }
}

function advancedNote(id: string): string {
  switch (id) {
    case 'golden': return '结尾有独立成行的金句，8-20 字，能被单独摘出来传播';
    case 'cta': return '结尾有明确的行动指令，说清到哪里、怎么做';
    case 'colloquial': return '台词是说出来的话，不是写出来的字；至少 2 处生活化表达';
    default: return '';
  }
}

/**
 * 用代码先量一遍，把客观事实交给模型。
 * 模型数不准秒数标注有几处、金句几个字，但它很擅长判断「这个钩子够不够狠」。
 * 分工：数得清的交给代码，判断力的交给模型。
 */
function machineFindings(draft: string): string {
  const evalResult = evaluateScriptQualityStrict(draft);

  const timingCount = (draft.match(/\d+\s*-\s*\d+\s*秒/g) || []).length;
  const emotionCount = (draft.match(/(?:😰|😓|💕|🤝|⚡)|波点/g) || []).length;
  const shotCount = (draft.match(/【?镜头\s*\d*】?/g) || []).length;
  const wordCount = draft.replace(/\s/g, '').length;
  // 口播按 5 字/秒估算，和脚本页的统计口径保持一致
  const estimatedSeconds = Math.round(wordCount / 5);

  const lines = [
    '## 🔍 系统预检结果（客观数据，请以此为准，不要另行估算）',
    '',
    `- 正文字数：${wordCount} 字，按口播 5 字/秒估算约 **${estimatedSeconds} 秒**`,
    `- 时间区间标注：**${timingCount} 处**（达标线 3 处）`,
    `- 情绪波点标记：**${emotionCount} 处**（达标线 3 处）`,
    `- 镜头编号：**${shotCount} 处**`,
    `- 系统初判得分：**${evalResult.score.toFixed(1)} 分（${evalResult.level}）**`,
  ];

  if (evalResult.issues.length > 0) {
    lines.push('', '**机器已确认的缺失项**（这些是事实，请直接采信并给出修改方案）：');
    for (const issue of evalResult.issues) lines.push(`- ${issue}`);
  }
  if (evalResult.suggestions.length > 0) {
    lines.push('', '**机器已确认的待改进项**：');
    for (const s of evalResult.suggestions) lines.push(`- ${s}`);
  }

  return lines.join('\n');
}

/** 把话术禁忌列出来，并标明命中的后果，避免模型对同类问题时轻时重 */
function forbiddenSection(draft: string): string {
  const hitLevel2 = FORBIDDEN_PHRASES.level2.filter((p) => draft.includes(p));
  const hitLevel3 = FORBIDDEN_PHRASES.level3.filter((p) => draft.includes(p));

  const lines = [
    '## 🚫 话术禁忌（与脚本生成同一套标准）',
    '',
    `- **一级（致命）**：废话开场，如「${FORBIDDEN_PHRASES.level1.slice(0, 3).join('」「')}」等。出现即判不合格，必须重写开场。`,
    `- **二级（书面语）**：如「${FORBIDDEN_PHRASES.level2.slice(0, 4).join('」「')}」等。每处扣 0.5 分，必须换成口语。`,
    `- **三级（空洞）**：如「${FORBIDDEN_PHRASES.level3.slice(0, 4).join('」「')}」等。每处扣 0.2 分，必须替换为具体的人、事、数字。`,
  ];

  if (hitLevel2.length || hitLevel3.length) {
    lines.push('', '**本篇已命中**：');
    if (hitLevel2.length) lines.push(`- 二级：${hitLevel2.join('、')}`);
    if (hitLevel3.length) lines.push(`- 三级：${hitLevel3.join('、')}`);
    lines.push('这些是逐字比对出来的，请逐一给出替换写法，不要漏。');
  }

  return lines.join('\n');
}

/** 构建审稿优化的完整提示词 */
/**
 * 不许编事实。线上实测（2026-10-02）：原稿只说「牛肉每天新鲜、锅底自己熬」，优化稿写成了
 * 「有人开车50公里来吃」「回头客占8成」「牛油放了8斤熬4小时」——全是原稿和档案里没有的。
 * 评分标准鼓励"用具体数字增强说服力"，通用的承接规则放在最末尾管不住，所以就近写进这两节。
 */
const NO_INVENTED_FACTS = '⚠️ 原稿和档案里**没有**的数字（价格、人数、距离、时长、重量、比例、销量）和经历、事件不许编：要用数字增强说服力就写成 X（如「X公里」「回头客占X成」），要用真实经历的地方写「【换成你的：……】」并给一个参考方向。原稿里已有的数字照用。';

export function buildReviewPrompt(p: ReviewPromptParams): string {
  const draft = p.draftContent || '';

  const parts: string[] = [];

  parts.push('# 短视频脚本审稿与优化');
  parts.push('');
  parts.push('你是一位 MCN 机构的编导主管，正在给旗下编导的稿子做终审。');
  parts.push('你的判断要能落地：指出问题之后必须给出可以直接抄进脚本的改写，');
  parts.push('而不是「建议加强情绪」这类正确但没用的话。');
  parts.push('');

  const personal = p.personalRequirements?.trim();
  if (personal) {
    parts.push('## 🔝 用户的个人要求（优先级最高）');
    parts.push('');
    parts.push(personal);
    parts.push('');
    parts.push('以上要求的优先级**高于本提示词里的一切规则、评分标准和账号背景**：冲突时按用户的要求来；');
    parts.push('用户指出的错误必须改掉，用户要的时长、语气、结构必须做到。用户在这里给出的事实（价格、年限、经历等）可以直接用。');
    parts.push('总评里用一两句话说明你按个人要求做了哪些改动、哪里和通用标准有取舍。');
    parts.push('');
  }

  // 账号背景放在稿子之前：先知道这是谁的号、说给谁听，再看内容。
  // 顺序反过来的话，模型会先形成一个通用判断，再被背景信息拉扯
  if (p.contextBlock) {
    parts.push(p.contextBlock);
    parts.push('');
  }

  parts.push('## 📄 待审稿件');
  parts.push('');
  parts.push(draft || '未提供脚本内容');
  parts.push('');

  parts.push('## 📌 稿件背景');
  if (p.platform) parts.push(`- 目标平台：${p.platform}`);
  if (p.duration === AI_DURATION) {
    parts.push('- 目标时长：由你按内容、平台和视频目的判断最合适的时长；在优化后的完整脚本开头用一行标注「建议时长：XX秒」，并在总评里用一句话说明为什么是这个时长');
  } else if (p.duration) {
    parts.push(`- 目标时长：${p.duration}`);
  }
  if (p.duration) {
    // 原稿时长不够或超了是审稿里最常见的问题之一（产品方举的例子就是"原来的脚本时长短"）
    parts.push('- 目标时长指的是**优化后的稿子**要达到的长度：原稿不够就补足内容，超了就删减，口播按每秒 3～4 个字估算');
  }
  if (p.scriptType) parts.push(`- 脚本类型：${p.scriptType}`);
  parts.push('');

  // 七个维度只查"有没有"——有结尾指令就给分。但一条流量型视频结尾喊"私信我下单"，
  // 或者一条变现型视频同时要关注、评论、私信，指令"有"，却是错的
  parts.push(roleInferRule('review'));
  parts.push('');
  parts.push(
    '稿子用了起号 36 计的（策略卡里写着"用的计"，或者一看就是某一计的拍法），再查一条：' +
      '那一计的结构公式是不是真落在片子的事件上，还是只在开头提了一句。没落上的算问题。'
  );
  parts.push('');
  parts.push(
    `目的和结构、结尾指令对不上的，列进问题清单${p.severityLabels ? '（🔴 必须改）' : '，排在最前面'}，并在优化后的脚本里改过来。`
  );
  parts.push('');

  if (draft) {
    parts.push(machineFindings(draft));
    parts.push('');
  }

  parts.push('## 📏 评分标准（满分 100，换算成 10 分制）');
  parts.push('');
  parts.push(rubricTable());
  parts.push('');
  // 实测中模型把「2.5/100」直接写成了「2.5 分」，差了一个数量级。
  // 换算规则必须写死，否则它会按自己的直觉给一个看起来合理的数。
  parts.push('**换算规则**：把各维度得分相加得到百分制总分，再 **除以 10** 得到最终分数。');
  parts.push('例：各维度合计 82 分 → 最终 8.2 分；合计 25 分 → 最终 2.5 分。');
  parts.push('总评里的分数和逐维度表格的合计必须对得上，不要各写各的。');
  parts.push('');
  parts.push('**等级线**：9.0 以上为 MCN 级，8.5 以上优秀，8.0 以上良好，');
  parts.push('7.0-8.0 及格但不建议直接拍，7.0 以下不合格必须重写。');
  parts.push('这套标准与本产品的脚本生成模块完全一致——同一篇稿子在两边应当得到同一个分数。');
  parts.push('');

  parts.push(forbiddenSection(draft));
  parts.push('');

  if (p.reviewDimensions) {
    parts.push('## ✅ 用户勾选的重点审查维度');
    parts.push('');
    parts.push(p.reviewDimensions);
    parts.push('');
    parts.push('这些是用户最关心的，必须逐条回应，不能一笔带过。');
    parts.push('');
  }

  if (p.optimizationGoals) {
    parts.push('## 🎯 优化目标');
    parts.push('');
    parts.push(p.optimizationGoals);
    parts.push('');
  }

  if (p.benchmarkScript) {
    parts.push('## 📊 用户提供的对标脚本');
    parts.push('');
    parts.push(p.benchmarkScript);
    parts.push('');
    parts.push('请对比两者的钩子强度、情绪推进、信息密度，指出差距具体在哪几句上。');
    parts.push('');
  }

  // 达标范例。模型知道「什么算好」，判断才有参照物；
  // 这和脚本生成注入范例是同一个理由。
  parts.push('## 📎 达标范例（9.5 分，仅作参照，不要照抄其中的行业和台词）');
  parts.push('');
  parts.push(getRelevantExample(p.scriptType || '教知识型', p.duration && p.duration !== AI_DURATION ? p.duration : '60秒', ''));
  parts.push('');

  parts.push('## 📤 输出格式（严格按顺序）');
  parts.push('');
  parts.push('### 1. 总评');
  parts.push('- **综合得分**：X.X 分（等级）');
  parts.push('- **视频目的**：流量型 / 人设型 / 变现型，目的、结构、结尾指令是否一致');
  parts.push('- **一句话结论**：这稿子能不能直接拍，不能的话卡在哪');
  parts.push('');
  parts.push('### 2. 逐维度打分');
  parts.push('用表格输出：| 维度 | 得分/权重 | 问题 | 怎么改 |');
  parts.push('每个维度的「怎么改」必须是具体动作，不能写「需要优化」。');
  parts.push('');
  parts.push('### 3. 问题清单');
  if (p.severityLabels) {
    parts.push('每条标注严重程度：🔴 必须改（不改就别拍）／🟡 建议改／🟢 锦上添花');
  }
  parts.push('每条格式：【问题】原文哪一句 →【为什么不行】→【改成】可直接使用的新句子');
  parts.push(NO_INVENTED_FACTS);
  parts.push('');

  if (p.compareMode) {
    // 用户在界面上打开了「对比模式」。此前这个开关传到后端就被忽略了，
    // 界面上点了等于没点。
    parts.push('### 4. 原文 vs 改写 逐句对照');
    parts.push('用表格输出：| 位置 | 原文 | 改写 | 改动理由 |');
    parts.push('只列真正改动的句子，没问题的不要占篇幅。');
    parts.push('');
    parts.push('### 5. 优化后的完整脚本');
  } else {
    parts.push('### 4. 优化后的完整脚本');
  }
  parts.push('直接给出可以拿去拍的完整版本，保留秒数、镜头、台词、情绪、画面五要素，');
  parts.push('并确保它自己能通过上面那套评分标准（目标 9.0 分以上）。');
  if (personal) parts.push('⚠️ 最前面「用户的个人要求」必须在这一版里逐条落实——它比评分标准优先。');
  parts.push(NO_INVENTED_FACTS);
  parts.push('');
  /*
   * 纯文字文案（2026-10-02 产品方："审稿的结果也要像脚本生成一样有纯文字版本"）。
   * 规则和脚本板块的「第2步：纯文字文案」一样，标题里必须带「纯文字文案」四个字——
   * 页面上的「复制纯文案」按钮（lib/script-copy 的 extractPlainCopy）认的就是它。
   */
  parts.push(`### ${p.compareMode ? 6 : 5}. 纯文字文案`);
  parts.push('- 把上面优化后的完整脚本里**要念出来的话**按顺序整理成一段纯文案，方便直接复制去提词器、配音或发给出镜的人');
  parts.push('- 只要口播内容：**不写**秒数、镜头、画面、字幕、音效、动作，不要【】标注、emoji、加粗、序号、列表符号');
  parts.push('- 按说话的自然停顿分段，一句一行；结尾金句也写进去（不加"金句"两个字，也不加引号）');
  parts.push('- 必须和上面优化后脚本里的台词**逐字一致**，不要另写一版');
  parts.push('');
  parts.push('⚠️ 不要输出「希望对你有帮助」这类结尾寒暄，也不要复述上面的标准。');

  parts.push(continuationRules('review'));
  return parts.join('\n');
}

/**
 * 页面会在提示词后面再拼「连续设置」「延续规则」，它们离模型最近、容易压过开头的个人要求；
 * 所以有个人要求时，在整段提示词的最末尾再提醒一次
 */
export function personalRequirementsReminder(text?: string): string {
  const t = text?.trim();
  return t ? `\n\n⚠️ 最后再强调一次：用户的个人要求优先级最高，和上面任何设置（包括连续设置里的时长、结构）冲突时，按个人要求来——\n${t}` : '';
}
