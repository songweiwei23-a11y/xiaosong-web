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
  getRelevantExample,
} from './quality-checker';
import { roleInferRule } from './content-roles';
import { continuationRules } from './creation-continuation';
import { reviewDraftStats } from './script-result-utils';
import { creativeCraftRules } from './creative-craft';
import { AI_LENGTH_RULE, EXAMPLE_LENGTH_NOTE } from './ai-recommend';

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

export const AMBIGUOUS_REVIEW_DURATION = /(?:^|[^\d])1\s*[-—－]\s*30\s*秒/;

export function reviewDimensionLabels(selected: string[], options: { id: string; label: string }[]): string {
  return selected.map(value => options.find(option => option.id === value || option.label === value)?.label ?? value).filter(Boolean).join('、');
}

/** 把七个评分维度连同权重写成表格，模型照着打分才有一致性 */
function rubricTable(): string {
  return [
    '| 维度 | 权重 | 达标的含义 |', '|---|---|---|',
    '| 核心目的与开场钩子 | 20 分 | 切中用户核心问题、立场与人群，开头承诺能由正文兑现，不强制3秒冲突 |',
    '| 信息递进与情绪波点适配 | 20 分 | 主体有具体问题、有效细节与递进；情绪服务真实内容，不要求数量或符号 |',
    '| 事实与证据 | 20 分 | 事实有材料支持，未知回答与结果不冒充事实；比较口径一致，追问能获得证据。**逐条对照【档案关键事实】看意思**：品类是哪几样、年限是谁的、店在哪，稿子换了说法、意思对不上的（如把六种风格说成六类家具、把从业年限说成店龄）要列为问题，不能只因为词在档案里出现过就给满分 |',
    '| 表达与人设 | 15 分 | 清楚自然、符合用户口吻，采访保留真实原话，不套统一俚语 |',
    '| 拍摄执行与时长 | 15 分 | 镜头、资源、台词与时长可执行；纯文字或局部优化不因缺镜头标注扣分 |',
    '| 收束与目的兑现 | 10 分 | 核心问题得到回应；金句与行动指令仅在内容和用户目的需要时使用 |',
  ].join('\n');
}

/**
 * 用代码先量一遍，把客观事实交给模型。
 * 模型数不准秒数标注有几处、金句几个字，但它很擅长判断「这个钩子够不够狠」。
 * 分工：数得清的交给代码，判断力的交给模型。
 */
function machineFindings(draft: string): string {
  const timingCount = (draft.match(/\d+\s*-\s*\d+\s*秒/g) || []).length;
  const emotionCount = (draft.match(/(?:😰|😓|💕|🤝|⚡)|波点/g) || []).length;
  const shotCount = (draft.match(/【?镜头\s*\d*】?/g) || []).length;
  const stats = reviewDraftStats(draft);
  return [
    '## 🔍 系统预检结果（格式计数，仅作线索）', '',
    stats.chars ? `- ${stats.estimated ? '原稿纯文本估算' : '可识别口播'}：${stats.chars} 字，按口播5字/秒约 ${stats.seconds} 秒；停顿、同期声与动作需另留时间` : '- 原稿含拍摄或分析说明，暂不能分离口播；时长未知，不得据此认定原稿为0字或0秒',
    `- 时间区间标注：**${timingCount} 处**；镜头编号：**${shotCount} 处**`,
    `- 情绪波点标记：**${emotionCount} 处**，不设数量达标线`,
    '- 系统初判得分：不采用固定格式分；请按本次内容适用的编辑标准判断。',
    '缺少金句、CTA、emoji或秒数标签不等于内容差；不需要的项目不用补。用户只改局部时只评和改那一部分。',
  ].join('\n');
}

/** 把话术禁忌列出来，并标明命中的后果，避免模型对同类问题时轻时重 */
function forbiddenSection(draft: string): string {
  const hitLevel2 = FORBIDDEN_PHRASES.level2.filter((p) => draft.includes(p));
  const hitLevel3 = FORBIDDEN_PHRASES.level3.filter((p) => draft.includes(p));

  const lines = [
    '## 🚫 话术检查（结合句意，不机械扣分）',
    '',
    `- 检查开场是否空转，如「${FORBIDDEN_PHRASES.level1.slice(0, 3).join('」「')}」；先看它出现的位置和后面有没有具体内容，中段口语、人物原话不能因命中词表就判致命。`,
    `- 书面表达如「${FORBIDDEN_PHRASES.level2.slice(0, 4).join('」「')}」仅是检查线索，判断是否符合这位作者的口吻，再给自然替换，不逐词机械扣分。`,
    `- 空泛赞美如「${FORBIDDEN_PHRASES.level3.slice(0, 4).join('」「')}」检查是否有原稿细节支撑。已有细节可压缩重组，没有依据的不要为了具体去编数字，也不编动作、神态或物件来增色。`,
    `- **有分寸的说法不算问题**：「可能」「我觉得」「先试试看」这类，原稿是在表达不确定、或者是个人观点时要保留，不要改成「一定」「必然」。`,
  ];

  if (hitLevel2.length || hitLevel3.length) {
    lines.push('', '**本篇已命中**：');
    if (hitLevel2.length) lines.push(`- 二级：${hitLevel2.join('、')}`);
    if (hitLevel3.length) lines.push(`- 三级：${hitLevel3.join('、')}`);
    lines.push('这些仅是逐字命中；逐一结合语境判断，合适的保留，需要改的再给替换。');
  }

  return lines.join('\n');
}

/** 构建审稿优化的完整提示词 */
/**
 * 不许编事实。线上实测（2026-10-02）：原稿只说「牛肉每天新鲜、锅底自己熬」，优化稿写成了
 * 「有人开车50公里来吃」「回头客占8成」「牛油放了8斤熬4小时」——全是原稿和档案里没有的。
 * 评分标准鼓励"用具体数字增强说服力"，通用的承接规则放在最末尾管不住，所以就近写进这两节。
 */
const NO_INVENTED_FACTS = '⚠️ 这是编辑现有稿件：改写只重组原稿和用户本轮明确提供的信息。没有的数字、经历、事件、物品品种、动作次数、气味、神态、天气和作者感受都不补造；画面感从已有动作、声音、物件与空间中提炼。不能为了具体而替原稿加一个现场事实，包括问题清单、怎么改和逐句对照里的示范句。未提供的必要信息写在文案外说明待补，原稿里已有的数字与原话照用，不擅自改变人物行为。';

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
  parts.push('## 编辑工作方法');
  parts.push('先读懂本条的题眼、人物关系、叙述视角和观众想知道的问题，再指出原稿已有的有效细节与值得保留的声音。每个问题必须引用对应原句，区分素材缺失、表达可优化与拍摄标注缺失；文字稿已有动作、声音、物件和人物原话，即使没有镜头编号，也有画面。');
  parts.push('观察记录、探访、日常过程：让观众跟着作者发现具体的人和事，用已有现场细节推进。开场压缩背景，尽早交代地点、时间和好奇点；不同场景各留下一个不同的发现，转场由前后信息关系带动，收尾回扣开场。保留有意味的停顿和克制反应，不把所有情绪都改成煽情判断或营销金句。');
  parts.push('口语化不是统一换成网络俚语；把拗口、重复、解释过满的句子改成作者能自然说出的短句。画面感优先从原稿的动作、声音、物件与空间提炼，拍摄建议与文案事实分开；新增可拍建议不能伪装成已经发生的事实。用户提供的原话按原稿素材保留，不把未核实标签塞进口播，也不擅自改变人物行为、回答或作者情绪。');
  parts.push('先按当前素材做最小必要改写。素材充分时直接交付；关键缺口说明需要补什么。时长写法若有歧义（如“1-30秒”），明确说明两种理解及影响，优先确认；不得自行当成30秒而删掉主要场景。用户明确30秒时集中一个切口，明确90秒时保留可支撑主题的多场景递进。');
  parts.push('');

  parts.push('## 📌 稿件背景');
  if (p.platform) parts.push(`- 目标平台：${p.platform}`);
  if (!p.duration || p.duration === AI_DURATION) {
    // AI 推荐 = 要质量最好的那一版，不设上限（2026-10-06 产品方）：原稿里好的情节、细节不为了变短删掉
    parts.push(`- 目标时长：由你按内容需要定——${AI_LENGTH_RULE}。原稿里讲得好的情节、细节不要为了变短删掉；在优化后的完整脚本开头用一行标注「建议时长：XX秒」，并在总评里用一句话说明为什么是这个时长`);
  } else {
    parts.push(`- 目标时长：${p.duration}`);
  }
  if (p.duration && p.duration !== AI_DURATION) {
    // 原稿时长不够或超了是审稿里最常见的问题之一（产品方举的例子就是"原来的脚本时长短"）
    parts.push('- 目标时长指优化后的成片：超时则取舍重复信息，时长不足先用已有动作、环境音和自然停顿。用户要扩充内容时深化已有问题与表达；缺少新素材就明确补采建议，不编情节或数字凑时长。口播按每秒约5字估算，停顿和同期声另计。');
  }
  if (p.scriptType) parts.push(`- 脚本类型：${p.scriptType}`);
  parts.push('');

  // 七个维度只查"有没有"——有结尾指令就给分。但一条流量型视频结尾喊"私信我下单"，
  // 或者一条变现型视频同时要关注、评论、私信，指令"有"，却是错的
  parts.push(roleInferRule('review'));
  parts.push('');
  parts.push(
    '稿子用了起号 36 计的（策略卡里写着"用的计"，或者一看就是某一计的拍法），再查一条：' +
      '检查用户明确采用的那一计是否服务核心目的；若只是候选标签，不能据此重写真实事件。合适的节点要落实，不合适的说明理由，不编素材去凑公式。'
  );
  parts.push('');
  parts.push(
    `实际内容违背用户目的、人群、立场或限制的，列进问题清单${p.severityLabels ? '（🔴 必须改）' : '，排在最前面'}，并在优化后的脚本里改过来。`
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
  parts.push('总评里的分数和逐维度表格的合计必须对得上，不要各写各的。权重严格为20、20、20、15、15、10，合计100，各项得分不得超过其权重；检索资料或旧稿中的其他评分表不适用于本轮。');
  parts.push('');
  parts.push('**等级线**：9.0 以上为 MCN 级，8.5 以上优秀，8.0 以上良好，');
  parts.push('7.0-8.0表示还有明确改进点；低于7.0先解释问题，改动范围服从用户要求，不自动推翻原稿。');
  parts.push('这是当前稿件的编辑判断，不是程序验证结果；分数不能证明事实真实或传播效果。金句、CTA、波点不适用时不扣分，也不为了评分强行补入。');
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
  // AI 推荐时不拿 60 秒去挑范例（范例多长模型就照着写多长）
  if (/教知识|测评/.test(p.scriptType)) parts.push(getRelevantExample(p.scriptType, p.duration && p.duration !== AI_DURATION ? p.duration : '', ''));
  else parts.push('先辨认稿件形式。采访保留主问、具体追问、不同回答与证据，未知回答保持待实拍；观察保留现场信息；讨论保留论点与依据。不要拿教学或广告范例改写其他形式。');
  parts.push(EXAMPLE_LENGTH_NOTE);
  parts.push('');

  parts.push('## 📤 输出格式（严格按顺序）');
  parts.push('');
  parts.push('### 1. 总评');
  parts.push('- **综合得分**：X.X 分（等级）');
  parts.push('- **用户目的与核心问题**：明确当前要解决什么、给谁看、哪些不做；混合目的照原要求保留');
  parts.push('- **一句话结论**：这稿子能不能直接拍，不能的话卡在哪');
  parts.push('- **值得保留**：引用两三处原稿有效细节，说明它们如何服务当前题眼；不能只列缺点后整篇推翻');
  parts.push('');
  parts.push('### 2. 逐维度打分');
  parts.push('用表格输出：| 维度 | 得分/权重 | 问题 | 怎么改 |');
  parts.push('每个维度说明具体判断；已合适的写保留及理由，确需修改的给有素材依据的具体动作，不能为填表发明缺点或新事实。');
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
  parts.push('按当前内容形式给出可用完整版本；原稿是纯文字或用户只改局部时不强行扩成五要素镜头稿，已有镜头稿保留适用的秒数、镜头、台词与画面，');
  parts.push('重点解决核心问题、信息深度、依据和执行性，不为达到目标分数补金句、情绪高潮或营销结尾。采访尚未实拍时补具体追问与取证动作，不编受访者回答。');
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
  parts.push('- 按说话的自然停顿分段，一句一行；适用的自然收束原句保留，不强写金句，不把未知采访答案放进纯文案');
  parts.push('- 必须和上面优化后脚本里的台词**逐字一致**，不要另写一版');
  parts.push('');
  parts.push('⚠️ 不要输出「希望对你有帮助」这类结尾寒暄，也不要复述上面的标准。');

  parts.push(continuationRules('review'));
  parts.push(creativeCraftRules({ source: p.draftContent, context: p.contextBlock }));
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
