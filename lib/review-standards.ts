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
}

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
export function buildReviewPrompt(p: ReviewPromptParams): string {
  const draft = p.draftContent || '';

  const parts: string[] = [];

  parts.push('# 短视频脚本审稿与优化');
  parts.push('');
  parts.push('你是一位 MCN 机构的编导主管，正在给旗下编导的稿子做终审。');
  parts.push('你的判断要能落地：指出问题之后必须给出可以直接抄进脚本的改写，');
  parts.push('而不是「建议加强情绪」这类正确但没用的话。');
  parts.push('');

  parts.push('## 📄 待审稿件');
  parts.push('');
  parts.push(draft || '未提供脚本内容');
  parts.push('');

  parts.push('## 📌 稿件背景');
  if (p.platform) parts.push(`- 目标平台：${p.platform}`);
  if (p.duration) parts.push(`- 目标时长：${p.duration}`);
  if (p.scriptType) parts.push(`- 脚本类型：${p.scriptType}`);
  parts.push('');

  if (draft) {
    parts.push(machineFindings(draft));
    parts.push('');
  }

  parts.push('## 📏 评分标准（满分 100，换算成 10 分制）');
  parts.push('');
  parts.push(rubricTable());
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
  parts.push(getRelevantExample(p.scriptType || '教知识型', p.duration || '60秒', ''));
  parts.push('');

  parts.push('## 📤 输出格式（严格按顺序）');
  parts.push('');
  parts.push('### 1. 总评');
  parts.push('- **综合得分**：X.X 分（等级）');
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
  parts.push('');
  parts.push('⚠️ 不要输出「希望对你有帮助」这类结尾寒暄，也不要复述上面的标准。');

  return parts.join('\n');
}
