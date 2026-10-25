import { buildContextBlock, type CreatorContext, type CreatorProfile } from '@/lib/creator-context';
import type { MemoryDefaults, MemoryField } from '@/lib/settings-memory';
import { evaluateScriptQualityStrict, formatQualityReport } from '@/lib/quality-checker';
import { extractScriptContext } from '@/lib/positioning-utils';
import { getScriptDetails, getHookDetails } from '@/lib/script-details';
import { buildAdaptiveScriptPrompt } from '@/lib/script-design';
import { enhancePromptWithMCNStandards } from '@/lib/enhance-prompt';
import { recommendFormula, generateFormulaGuide } from '@/lib/formula-enforcer';
import { getStructureNarrative } from '@/lib/script-structure-details';
import { PRIORITY_ORDER } from '@/lib/output-rules';
import { getRelevantExample } from '@/lib/quality-checker';
import { AI_SCRIPT_LENGTH_RULE, AI_SCRIPT_TARGET_TEXT, EXAMPLE_LENGTH_NOTE, scriptLengthRule } from '@/lib/ai-recommend';
import { tacticBrief, tacticsBlockedBy } from '@/lib/growth-standards';
import { AUTO_TACTIC, ROUTES_GUIDE, tacticIndex } from '@/lib/creative-routes';
import { dealReasonsForPurpose, roleBrief, type ContentRole } from '@/lib/content-roles';
import {
  creationSettingsBlock,
  durationSeconds,
  mergeCreationSettings,
  normalizeCreationReasons,
  resolveCreationSettings,
  type CreationSettings,
} from '@/lib/creation-settings';
import {
  getAudienceProfile,
  getDifferentiation,
  getAvoidStyles,
  getShouldSayExamples,
  getShouldNotSayExamples,
  getContentFocus,
  getSmartHookRecommendation,
  getTimeAllocation,
  getStepTasks,
} from '@/lib/script-helpers';
import {
  SCRIPT_TYPES,
  DEAL_REASONS,
  BOOM_ELEMENTS,
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  DIRECTOR_THOUGHTS,
  DURATIONS,
  PLATFORMS,
} from '@/app/dashboard/script/constants';

/**
 * 脚本板块的查询拼装。脚本页面和开物助理共用这一份，保证两边给模型的提示词一致。
 *
 * 页面负责收集状态（选了哪个类型、时长、档案、结构、钩子等），拼装的逻辑全在这里。
 * 返回的提示词已经带上创作设置；续写原文、自动目的等请求体后缀仍由页面按自己的状态追加。
 */

export interface ScriptBoardInput {
  topic: string;
  platform: string;
  /** 脚本类型（SCRIPT_TYPES 的键） */
  scriptType: string;
  /** 用户没有选脚本类型：由模型自己判断 */
  autoScriptType: boolean;
  /** 这条视频的目的（「自动」已经解析成具体的类型） */
  effectiveRole: ContentRole;
  /** 广告引流（页面上是 activeTab === "ad"） */
  isAd: boolean;
  industry: string;
  customIndustry: string;
  targetGroup: string;
  customTargetGroup: string;
  style: string;
  customStyle: string;
  durationMode: 'preset' | 'custom' | 'ai';
  duration: string;
  customDuration: string;
  /** 选中的账号档案（没选时为 null） */
  profile: CreatorProfile | null;
  /** 选中的账号定位全文（没选时为 null） */
  positioningContent: string | null;
  scriptStructure: string;
  hookType: string;
  boomElements: string[];
  directorThoughts: string[];
  tactic: string;
  openingLine: string;
  openingCard: string;
  productInfo: string;
  priceInfo: string;
  scene: string;
  device: string;
  budget: string;
  personnel: string;
  accountPositioning: string;
  additionalInfo: string;
  /** 选中的成交理由（id） */
  dealReasons: string[];
  /** 续写时带来的原文 */
  originContent: string;
  /** 自动承接的方案里的内容重点 */
  focusContent: string;
  currentSettings: CreationSettings;
}

/**
 * 脚本页面打开时的初始值。助理替编导填表时用这一组，和页面不动任何选项时一样。
 * 页面里对应的 useState 初始值要和这里一致（tests/board-script.test.ts 会检查）。
 */
export const SCRIPT_PAGE_DEFAULTS = {
  scriptType: 'teach',
  scriptRole: '自动' as const,
  platform: '抖音',
  durationMode: 'ai' as const,
  duration: '60秒',
  style: '专业',
  targetGroup: '',
  scriptStructure: 'auto',
  hookType: 'auto',
  directorThoughts: ['emotion', 'picture'],
  scene: '室内',
  device: '手机',
  budget: '低成本(0-500)',
  personnel: '一人',
  tactic: AUTO_TACTIC,
};

export interface ScriptSettingsInput {
  topic: string;
  platform: string;
  durationMode: 'preset' | 'custom' | 'ai';
  duration: string;
  customDuration: string;
  scriptType: string;
  autoScriptType: boolean;
  /** 页面上的「视频目的」，「自动」时按脚本类型给默认目的 */
  scriptRole: '自动' | ContentRole;
  effectiveRole: ContentRole;
  style: string;
  customStyle: string;
  targetGroup: string;
  customTargetGroup: string;
  industry: string;
  customIndustry: string;
  boomElements: string[];
  dealReasons: string[];
  additionalInfo: string;
  scriptStructure: string;
  hookType: string;
  tactic: string;
  openingLine: string;
  openingCard: string;
  scene: string;
  device: string;
  budget: string;
  personnel: string;
  originContent: string;
  /** 从别处带过来的设置（没有就是空对象） */
  autoSettings: CreationSettings;
  /** 是否是从别的板块带过来的（带过来时备注取它的备注，不取补充要求） */
  fromHandoff: boolean;
  creatorContext: CreatorContext | null;
}

/**
 * 脚本板块的创作设置。脚本页面和开物助理都用这一个算法，同样的输入得到同样的设置。
 */
export function scriptCreationSettings(input: ScriptSettingsInput): CreationSettings {
  const auto = input.autoSettings;
  return resolveCreationSettings({
    from: '脚本生成',
    sourceContent: input.originContent || input.topic,
    settings: mergeCreationSettings(auto, {
      topic: input.topic,
      platform: input.platform,
      duration: input.durationMode === 'custom' && input.customDuration ? input.customDuration + '秒' : input.durationMode === 'ai' ? 'AI推荐' : input.duration,
      scriptType: input.autoScriptType ? undefined : input.scriptType,
      purpose: input.scriptRole === '自动' ? auto.purpose : input.effectiveRole,
      structure: input.scriptStructure,
      hookType: input.hookType,
      style: input.customStyle || input.style,
      audience: input.customTargetGroup || input.targetGroup,
      industry: input.customIndustry || input.industry,
      elements: input.boomElements.map((id) => (id === 'crowd' ? 'people' : id)),
      // 大流量视频不带成交理由（2026-10-25）：流量型的脚本设置里不存成交理由
      dealReasons: dealReasonsForPurpose(input.scriptRole === '自动' ? auto.purpose : input.effectiveRole, normalizeCreationReasons([...auto.dealReasons || [], ...input.dealReasons])),
      notes: input.fromHandoff ? auto.notes : input.additionalInfo,
      tactic: input.tactic === AUTO_TACTIC ? undefined : input.tactic,
      openingLine: input.openingLine,
      openingCards: input.openingCard ? [input.openingCard] : [],
      scene: input.scene,
      device: input.device,
      budget: input.budget,
      personnel: input.personnel,
    }),
  }, input.creatorContext);
}

export interface ScriptMemoryState {
  durationMode: 'preset' | 'custom' | 'ai';
  scriptRole: '自动' | ContentRole;
  scriptStructure: string;
  platform: string;
}

export interface ScriptMemoryPatch {
  durationMode?: 'preset' | 'custom' | 'ai';
  duration?: string;
  customDuration?: string;
  scriptRole?: ContentRole;
  scriptStructure?: string;
  platform?: string;
  /** 这次填上的是哪几项（页面上会提示「已按上次的习惯填好」） */
  applied: MemoryField[];
}

/**
 * 记忆预填：只填页面上还是默认值的那几项。页面的 prefillFromMemory 和助理用的是这一条规则。
 */
export function scriptMemoryPatch(defaults: MemoryDefaults, state: ScriptMemoryState): ScriptMemoryPatch {
  const patch: ScriptMemoryPatch = { applied: [] };
  if (defaults.duration && state.durationMode === 'ai') {
    const v = defaults.duration.value;
    if ((DURATIONS as readonly string[]).includes(v)) {
      patch.duration = v;
      patch.durationMode = 'preset';
      patch.applied.push('duration');
    } else if (durationSeconds(v)) {
      patch.customDuration = String(durationSeconds(v));
      patch.durationMode = 'custom';
      patch.applied.push('duration');
    }
  }
  if (defaults.purpose && state.scriptRole === '自动') {
    patch.scriptRole = defaults.purpose.value as ContentRole;
    patch.applied.push('purpose');
  }
  if (defaults.structure && state.scriptStructure === 'auto' && SCRIPT_STRUCTURES.some((s) => s.id === defaults.structure!.value)) {
    patch.scriptStructure = defaults.structure.value;
    patch.applied.push('structure');
  }
  if (defaults.platform && state.platform === '抖音' && defaults.platform.value !== '抖音' && (PLATFORMS as readonly string[]).includes(defaults.platform.value)) {
    patch.platform = defaults.platform.value;
    patch.applied.push('platform');
  }
  return patch;
}

/**
 * 脚本生成完以后，结果后面要追加质检报告（页面显示的、存进历史的都是带报告的版本）。
 * 页面和助理共用这一步，保证两边的结果一样。
 */
export function scriptResultWithQuality(text: string): string {
  if (!text.trim()) return text;
  const evaluation = evaluateScriptQualityStrict(text, { adaptive: true });
  return `${text}\n\n---\n\n${formatQualityReport(evaluation)}`;
}

export function buildScriptBoardQuery(input: ScriptBoardInput): string {
  const {
    topic, platform, scriptType, autoScriptType, effectiveRole, isAd,
    industry, customIndustry, targetGroup, customTargetGroup, style, customStyle,
    durationMode, duration, customDuration, profile, positioningContent,
    scriptStructure, hookType, boomElements, directorThoughts, tactic,
    openingLine, openingCard, productInfo, priceInfo, scene, device, budget,
    personnel, accountPositioning, additionalInfo, originContent,
    focusContent, currentSettings,
  } = input;
  // 大流量视频不带成交理由（2026-10-25）：流量型的脚本一律不带成交理由，下面的提示词只看这里过滤后的
  const dealReasons = dealReasonsForPurpose(effectiveRole, input.dealReasons);

      // 构建结构化的query给Dify
      const dealReasonsText = dealReasons.length > 0 
        ? dealReasons.map(id => DEAL_REASONS.find(r => r.id === id)?.label).join("、") 
        : "未选择";
      
      const selectedIndustry = customIndustry || industry || "未分类";
      const selectedTargetGroup = customTargetGroup || targetGroup || "通用受众";
      const selectedStyle = customStyle || style || "专业";
        
        // 时长：三种模式 — AI推荐 / 自定义秒数 / 预设选择
        const isAiDuration = durationMode === "ai";
        const finalDuration = isAiDuration
          ? "由AI根据主题和平台智能判断"
          : durationMode === "custom" && customDuration
            ? `${customDuration}秒`
            : duration;
        
      // 提取档案和定位信息
      let profileInfo = "";
      let positioningInfo = "";

      // 这里原本只传 6 个字段：名称、平台、赛道、阶段、粉丝量级、风格。
      // 写脚本真正要的东西一个都没在里面——说话语气、核心卖点、用户痛点、
      // 已验证的开场钩子，以及「绝对不能说：最好、第一、全网最便宜」。
      // 最后一条是硬禁忌，漏掉它模型就会照常写出违规文案。
      /*
       * 2026-10-19 按板块分配（方案 D）：脚本只给档案和写作底线，不带简报、行业建议、定位。
       * 对照测试里这样编造从 11 条降到 2 条，盲评持平。板块清单（lib/context-manifest）是准的，
       * 这里只传档案即可；传了也会被清单忽略。
       */
      if (profile) {
        profileInfo = "\n\n" + buildContextBlock(
          { profile: profile, positioning: null, dealReasons: [] },
          'script'
        );
      }

      if (positioningContent !== null) {
        const scriptContext = extractScriptContext(positioningContent);
        positioningInfo = `

【账号定位-脚本创作参考】
${scriptContext}
`;
      }


      // ========== MCN级提示词增强 ==========
      const structureDetail = getScriptDetails(scriptStructure);
      const hookDetail = getHookDetails(hookType);
      const elementsWithNames = boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label).filter(Boolean).join('、');
      const mcnEnhancement = enhancePromptWithMCNStandards({
        structureDetail,
        hookDetail,
        elementsWithNames,
        duration: isAiDuration ? AI_SCRIPT_TARGET_TEXT : finalDuration,
        role: effectiveRole,
      });
      const { structureGuide, hookGuide, formatRequirements } = mcnEnhancement;
      // ========== MCN级提示词增强结束 ==========

      const helperProfile = profile || {
        profile_name: topic || "当前创作者",
        account_track: [selectedIndustry],
        content_style: [selectedStyle],
        fans_level: "",
      };
      const structureName = SCRIPT_STRUCTURES.find(s => s.id === scriptStructure)?.label || "AI推荐";
      const smartHook = getSmartHookRecommendation(topic, selectedTargetGroup, boomElements);
      const audienceProfile = getAudienceProfile(helperProfile);
      const differentiation = getDifferentiation(helperProfile);
      const avoidStyles = getAvoidStyles([selectedStyle]);
      const shouldSayExamples = getShouldSayExamples(helperProfile);
      const shouldNotSayExamples = getShouldNotSayExamples(helperProfile);
      const contentFocus = getContentFocus(helperProfile.fans_level || "");
      const smartHookRecommendation = `${smartHook.hookType}：${smartHook.reason}`;
      // AI模式下用平台常见默认值兜底时间分配计算，避免 parseInt 得到 NaN
      // AI 推荐时不拿 60 秒去挑范例：范例多长，模型就照着写多长（范例只学节奏和标注，这里给它不按时长挑的那份）
      const durationForCalc = isAiDuration ? "" : finalDuration;
      const timeAllocation = isAiDuration
        ? "由AI依据主题与平台节奏分配各段时长（开场钩子→主体→情绪高潮→结尾CTA），各段合计约 90～100 秒"
        : getTimeAllocation(structureName, durationForCalc);
      const stepTasks = getStepTasks(structureName);

      // ========== 公式分段蓝图 + MCN 范例 ==========
      // enhancePromptWithMCNStandards 给出的是原则（要点、禁忌），粒度到不了
      // 「0-8秒该放什么、必须包含哪些元素」。formula-enforcer 提供四套公式的
      // 分段蓝图与参考话术，补的正是这一层。
      //
      // 另外 enhance-prompt 里两处写着「请参考上下文知识库中的 MCN 级脚本示例」，
      // 但生成前从未真正注入过范例。getRelevantExample 提供的就是 9.5 分范例。
      const formulaType = recommendFormula(scriptType, structureName);
      // coreLogic / emotionCurve 是 script-details 没有的两个字段：
      // 前者点明该结构适用于什么用户处境，后者给出情绪推进路径——
      // 波点该落在哪里由它决定，而不是让模型凭感觉撒 emoji。
      const narrative = getStructureNarrative(scriptStructure);
      const formulaSection = `
${narrative ? `## 🧠 本结构的设计意图

- **核心逻辑**：${narrative.coreLogic}
- **情绪曲线**：${narrative.emotionCurve}

情绪曲线里的每个箭头都是一次情绪转折，波点必须落在转折处。
台词、画面、语速都要服务于这条推进路径，不要在平缓段强行标波点。
` : ''}
${generateFormulaGuide(formulaType)}

## 📎 MCN级参考范例（9.5分标准）

下面是达标脚本的完整范例。**只学它的分段节奏、波点标注位置和台词口语化程度，
不要照搬其中的行业、案例或具体台词**——照搬会让脚本失去与本次主题的相关性。${EXAMPLE_LENGTH_NOTE}。

${getRelevantExample(scriptType, durationForCalc, scriptStructure)}
`;
      // ========== 公式蓝图结束 ==========

      // ========== 拍法（起号 36+1 计）==========
      // 从起号页选题页一路带过来的那一计。
      // 它和上面的"脚本结构"不是一回事，容易混，所以这里把分工写明：
      //   脚本结构 = 时间怎么分（0-3秒钩子、3-15秒铺垫…）
      //   拍法公式 = 事件怎么走（常规A → 反向B → 真实反应）
      // 两者叠加，不是二选一。不说清楚的话模型会拿其中一个覆盖另一个。
      const tacticText = tactic && tactic !== AUTO_TACTIC ? tacticBrief(tactic) : '';
      const blockedTactics = tacticsBlockedBy(
        [profile?.content_restrictions, profile?.avoid_content].filter(Boolean).join('\n')
      );
      const tacticSection = tactic === AUTO_TACTIC
        ? `
## 🎬 拍法：给这条叠一计起号打法（小黄 36 计）

${ROUTES_GUIDE}

${tacticIndex({ exclude: blockedTactics })}

**硬要求**：
1. 从上面清单挑**一计**，优先标了【${effectiveRole}】的；挑他拍得出来的
2. 在脚本策略卡第一条写：**用的计：36计·第N计 计名**，再用一句话说这一计的公式套到这条上是什么事件
3. 片子的事件走向落在那一计的公式上，话怎么讲仍按上面的脚本结构——两者叠加，不要只在开头提一句
4. 实在没有合适的（比如讲自己真实经历的人设型，硬套会显得假），策略卡第一条写"用的计：不叠计"并说明为什么，按四大脚本写
`
        : tacticText
        ? `
## 🎬 本条用的拍法：${tactic}

${tacticText}

**怎么和上面的脚本结构配合**：
- 脚本结构决定**时间怎么分**（哪一秒放什么）
- 这一计的结构公式决定**事件怎么走**（片子里发生了什么）
- 两者同时成立，不要用其中一个替掉另一个

**硬要求**：
1. 片子的事件走向必须落在这一计的结构公式上，不能只在开头提一句就没了
2. 上面的「边界」是红线，宁可换个拍法也不要碰线
3. 在脚本策略卡里写明：这一计的每一段分别落在第几秒
`
        : '';
      // ========== 拍法结束 ==========

      // ========== 这条视频的目的 ==========
      // 目的决定结构和结尾指令（SOP 05）。放在脚本结构说明之后，
      // 用户选的结构和目的不配时，以目的为准挑结构里的写法
      const roleSection = `
## 🎯 这条视频的目的：${effectiveRole}

${roleBrief(effectiveRole)}

**硬要求**：
1. 按用户明确目的执行；混合目的按原要求保留，不为分类擅自删掉其中一个，也不新增营销目标
2. 上面选的脚本结构是"时间怎么分"，上面这几种是"这类视频该怎么讲"——按这里挑一个骨架填进去
3. 仅在用户目的需要互动或转化时设计一个行动指令；否则自然收束，不强加关注、私信或到店
`;
      // ========== 目的结束 ==========

      // ========== 已选定的开头 ==========
      // 用户在开篇页把 N 种开法横着比了一轮才挑的这一句，
      // 不锁死的话模型会"参考"一下然后另写一个，那一轮比较就白做了。
      const openingSection = openingLine.trim()
        ? `
## 🎯 开头已经定了，必须用这一句

> ${openingLine.trim()}

${openingCard ? `这句用的是「${openingCard}」这张开篇卡。\n` : ''}
**硬要求**：
1. 脚本的第一句话就是上面这句，**一字不改**（口播顺不过来时可以调语气词，但意思和钩子不能变）
2. 不要再另写一个开头，也不要在它前面加铺垫
3. 开头许的东西，正文必须兑现——这是完播率的关键，开头一套正文另一套比不抓人更糟
4. 后面的分段节奏照常按脚本结构走

这一句本身就是前 3 秒的钩子，已经在开篇板块里横向比过一轮才选出来的，
不需要再为它设计一个钩子。
`
        : '';

      // 开头锁死时就别再发"开场钩子要求"了：那一段是教模型怎么造钩子的，
      // 和"用这一句、一字不改"直接打架，两条同时给，模型多半会另写一个。
      const effectiveHookGuide = openingLine.trim() ? '' : hookGuide;
      // ========== 开头结束 ==========

      const fourStepWorkflow = `
## 🧭 生成流程（必须按顺序输出）

### 第1步：脚本策略卡
- 用3-5条说明本条脚本的核心策略：用户目的、目标用户、核心问题、主切口、信息递进、适合本条的自然收束或行动
- 不写空泛定位，必须和主题、行业、账号信息直接相关

### 第2步：纯文字文案
- 把这条视频要**念出来的话**按顺序整理成一段纯文案，方便直接复制去提词器、配音或发给出镜的人
- 只要口播内容：**不写**秒数、镜头、画面、字幕、音效、动作，不要【】标注、emoji、加粗、序号、列表符号
- 按说话的自然停顿分段，一句一行；有自然收束原句就保留，不强写金句
- 先定好这段文案，第3步再把它拆进镜头：**第3步的口播台词必须和这段逐字一致**，不要两边各写一版${openingLine.trim() ? "\n- 开头已经定了，这段文案的第一句就是那句开头，一字不改" : ""}

### 第3步：正文脚本
- ${isAiDuration
  ? `时长：AI 推荐，${AI_SCRIPT_LENGTH_RULE}。不需要标注时长，据此完整输出可直接拍摄的脚本`
  : `按${finalDuration}完整输出可直接拍摄的脚本。${scriptLengthRule(finalDuration)}`}
- 必须包含秒数、镜头/画面、口播台词、字幕/音效/动作建议
- 开头3秒直接进入冲突、痛点、反常识或利益点，禁止废话开场

**格式硬性要求（不满足会被判定为缺失，务必遵守）：**
1. 开场必须单独成行标注钩子，格式示例：【开场钩子】0-8秒：（用半角冒号，秒数区间按实际填）
2. 结尾按内容自然收束；有适合摘出的原句才标注金句，不强制字数，不编感悟
3. 每个镜头标注时间区间（如 8-15秒）和【镜头X】编号
4. 按真实信息和情绪变化提示节奏，不凑情绪波点数量；采访、记录不预设受访者的情绪或回答

### 第4步：优化建议（只写建议，不要打分）
- 用3-5条指出正文脚本还能加强的地方（钩子、节奏、画面、转化）
- ⚠️ 禁止输出任何自评分数、“X分/10分”“综合评分”“MCN级”等字样，最终分数由系统质检统一给出
`;

      const executionContext = `
## 🧩 自动补齐的执行上下文
- **受众画像**：${audienceProfile}
- **差异化抓手**：${differentiation}
- **内容重心**：${contentFocus}
- **智能钩子建议**：${smartHookRecommendation}
- **时间分配**：${timeAllocation}
- **分步任务**：${stepTasks}
- **应避免风格**：${avoidStyles}
- **建议表达示例**：${shouldSayExamples}
- **避免表达示例**：${shouldNotSayExamples}
`;

      // ========== 智能判断：补充要求的详细程度 ==========
      const additionalInfoLength = (additionalInfo || '').length;
      const isDetailedRequirement = additionalInfoLength > 100; // 超过100字认为是详细要求
      
      /*
       * 优先级（2026-10-05 质量整改）：原来补充要求不到 100 字时写的是「MCN 标准 > 用户补充要求」——
       * 「别改正文，只换开头」只有十来个字，却排在模板下面。现在用户的明确要求不按字数决定地位，永远排在模板前面；
       * 字数只决定「没写到的部分」由谁来补：用户给了详细框架就照框架写，没给就按 MCN 标准补全。顺序见 lib/output-rules。
       */
      const promptStrategy = isDetailedRequirement
        ? '⚠️ **用户已提供详细脚本框架，请严格按照用户补充要求生成**，MCN标准只作格式参考。'
        : '⚠️ **用户补充要求里的明确约束必须严格遵守**（哪怕只有一句，比如「只换开头」「别提价格」「控制在 30 秒」）；没写到的部分按 MCN 标准补全。';

      const priorityNote = `
## 📋 生成策略

**优先级**：${PRIORITY_ORDER}

${isDetailedRequirement
  ? `用户已提供详细的脚本框架（${additionalInfoLength}字）：
1. **首要**：严格按照【补充要求】中的脚本框架、秒数、台词方向生成，不要偏离用户的思路
2. **其次**：参考MCN标准中的格式要求（钩子、金句、秒数、镜头、波点等）`
  : `用户补充要求较简单（${additionalInfoLength}字）：
1. **首要**：补充要求里说了的（改哪里、不改哪里、提不提什么、多长）一字不差地遵守
2. **其次**：补充要求没说到的部分，按MCN标准的脚本结构、钩子要求、爆款元素补全`}
`;
      // ========== 智能判断结束 ==========
      const query = (autoScriptType || !isAd) ? buildAdaptiveScriptPrompt({
        topic, platform, duration: isAiDuration ? 'AI推荐' : finalDuration,
        context: profileInfo + positioningInfo,
        source: [originContent, focusContent].filter(Boolean).join('\n\n'),
        requirements: additionalInfo,
        settings: currentSettings,
        structureGuide: scriptStructure !== 'auto' ? structureGuide : undefined,
        hookGuide: openingLine.trim() ? undefined : hookType !== 'auto' ? hookGuide : undefined,
        tacticGuide: tactic && tactic !== AUTO_TACTIC ? tacticSection : undefined,
        scriptTypeGuide: !autoScriptType ? formulaSection : undefined,
        craftFocus: [
          boomElements.length ? `用户勾选元素：${boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label ?? id).join('、')}` : '',
          directorThoughts.length ? `表达重点：${directorThoughts.map(id => DIRECTOR_THOUGHTS.find(d => d.id === id)?.label ?? id).join('、')}` : '',
        ].filter(Boolean).join('\n'),
      }) : isAd ? `# 广告引流短视频脚本生成

${promptStrategy}

${priorityNote}
${fourStepWorkflow}
${executionContext}

⚠️ **重要提示**：这是一个广告引流类脚本，请使用广告公式和成交理由知识库，重点突出产品卖点和转化行动。

## 基础信息
- **广告类型**：${SCRIPT_TYPES[scriptType as keyof typeof SCRIPT_TYPES].label}
- **行业**：${selectedIndustry}
- **平台**：${platform}
- **时长**：${isAiDuration ? "不限，以效果最好为准" : finalDuration}
- **主题/活动**：${topic}

${profileInfo}${positioningInfo}

${structureGuide}
${formulaSection}
${roleSection}
${tacticSection}
${openingSection}
${effectiveHookGuide}

## 产品信息（核心）
${productInfo ? `**产品介绍**：${productInfo}` : "⚠️ 未填写产品信息"}
${priceInfo ? `**价格策略**：${priceInfo}` : ""}

## 目标用户
- **精准人群**：${selectedTargetGroup}
- **沟通风格**：${selectedStyle}

## 成交策略（核心要求）
**选中的成交理由**：${dealReasonsText}

⚠️ **必须严格执行**：
1. 脚本中必须明确体现每一个成交理由，不能只是泛泛而谈
2. 每个成交理由至少要有1处具体的场景或话术体现
3. 在脚本最后增加【成交理由应用自检】：
   - 列出每个成交理由在脚本中的具体体现位置
   - 确认每个理由都被真实应用，而非空泛提及

示例格式：
【成交理由应用自检】
✅ 性价比：引用已确认价格或真实可拍的产品信息，无资料不写数字
✅ 品质保证：拍摄用户确实提供的制作过程，不虚构年限或认证
✅ 老板好：使用已提供的真实服务行为，不编折扣承诺

## 创意要求
- **开场方式**：${HOOK_TYPES.find(h => h.id === hookType)?.label || "AI推荐"}（3秒内抓住目标用户）
- **脚本结构**：${SCRIPT_STRUCTURES.find(s => s.id === scriptStructure)?.label || "推荐型"}
- **爆款元素**：${boomElements.length > 0 ? boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label).join("、") : "根据行业推荐"}

## 拍摄执行
- **场景**：${scene} | **设备**：${device} | **预算**：${budget} | **人员**：${personnel}
- **编导思路**：${directorThoughts.map(id => DIRECTOR_THOUGHTS.find(d => d.id === id)?.label).join("、")}

${accountPositioning ? `## 账号定位信息
${accountPositioning}

` : ""}${additionalInfo ? `## 补充要求
${additionalInfo}` : ""}

---
**生成要求**：
1. 使用【广告公式知识库】和【成交理由知识库】
2. 开场3秒必须直击痛点或利益点
3. 中段重点展示产品卖点和成交理由
4. 结尾只要一个明确的行动指令（到店、团购、加微信里选最贴这条的一个，说清楚怎么做）
5. 全程植入产品信息，自然不生硬
6. 价格、优惠和限时限量仅使用用户已确认信息；未提供就不用，不编福利或经营承诺

${formatRequirements}

请生成完整的广告引流脚本。` : `# 内容创作短视频脚本生成

${promptStrategy}

${priorityNote}
${fourStepWorkflow}
${executionContext}

⚠️ **重要提示**：这是一个内容创作类脚本，请使用编导技巧和脚本公式知识库，重点突出价值输出和情感共鸣。

## 基础信息
- **内容类型**：${SCRIPT_TYPES[scriptType as keyof typeof SCRIPT_TYPES].label}
- **行业领域**：${selectedIndustry}
- **平台**：${platform}
- **时长**：${isAiDuration ? "不限，以效果最好为准" : finalDuration}
- **主题**：${topic}

${profileInfo}${positioningInfo}

${structureGuide}
${formulaSection}
${roleSection}
${tacticSection}
${openingSection}
${effectiveHookGuide}

## 目标定位
- **目标受众**：${selectedTargetGroup}
- **内容风格**：${selectedStyle}

## 创意设计
- **开场钩子**：${HOOK_TYPES.find(h => h.id === hookType)?.label || "AI推荐"}（吸引目标受众停留）
- **脚本结构**：${SCRIPT_STRUCTURES.find(s => s.id === scriptStructure)?.label || "AI推荐"}
- **爆款元素**：${boomElements.length > 0 ? boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label).join("、") : "根据主题推荐"}

## 价值主张
${dealReasons.length > 0 && effectiveRole !== '变现型' ? `**这个号的卖点（背景）**：${dealReasonsText}

这条是${effectiveRole}视频，卖点只作背景，**不要在片子里讲卖点、不要引导成交**——那是变现型视频的活。` : dealReasons.length > 0 ? `**核心价值点**：${dealReasonsText}

⚠️ **必须严格执行**：
1. 脚本必须围绕这些价值点设计，每个价值点至少体现1次
2. 不能只是提及，要有具体的实用技巧或方法
3. 在脚本最后增加【价值点应用自检】：
   - 列出每个价值点在脚本中的具体体现
   - 确认内容真正帮助用户解决了问题

示例格式：
【价值点应用自检】
✅ 性价比：推荐了3款50元以内的平价好物
✅ 节省时间：提供了5分钟快速上妆的具体步骤` : "**核心价值**：提供实用价值，建立信任关系"}

## 拍摄执行
- **场景**：${scene} | **设备**：${device} | **预算**：${budget} | **人员**：${personnel}
- **编导思路**：${directorThoughts.map(id => DIRECTOR_THOUGHTS.find(d => d.id === id)?.label).join("、")}

${accountPositioning ? `## 账号定位信息
${accountPositioning}

` : ""}${additionalInfo ? `## 补充要求
${additionalInfo}` : ""}

---
**生成要求**：
1. 使用【编导技巧知识库】和【脚本公式知识库】
2. 开场清楚点出当前议题或现场切口，正文能够兑现；不为制造冲突改变主题
3. 中段沿用户目的与材料逐层展开；采访写主问、追问与证据，不编未知回答
4. 结尾自然收束；用户需要互动或转化时才设计一个与目的对应的行动
5. 全程注重情感连接，建立信任
6. 避免硬广，自然输出价值

${formatRequirements}

请生成完整的内容创作脚本。`;
  return query + creationSettingsBlock(currentSettings);
}
