import type { HandoffPayload } from '@/lib/handoff';
import { carriesScript, carriedIntent, intentBlock, continuationRules } from '@/lib/creation-continuation';
import { VIRAL_ELEMENTS, viralElementById, viralElementPrompt } from '@/lib/viral-elements';
import { tacticBrief, tacticsBlockedBy } from '@/lib/growth-standards';
import { rolesGuide, roleBrief, type ContentRole } from '@/lib/content-roles';
import { mixPromptBlock, type ResolvedMix } from '@/lib/content-mix';
import { TITLE_CRAFT, ONE_POINT_RULE, REAL_PEOPLE_RULE, REALITY_RULE } from '@/lib/sharp-rules';
import { taboosPromptBlock } from '@/lib/taboos';
import { ROUTES_GUIDE, tacticIndex, type CreativeRoute } from '@/lib/creative-routes';
import { topicSourceRules, topicDesignStandards, topicRoutePrompt, topicDesignFinalCheck, topicPreferredTactic } from '@/lib/topic-design';
import { buildContextBlock, describeExecutionConstraints, describeRestrictions, type CreatorContext, type CreatorProfile } from '@/lib/creator-context';
import {
  creationSettingsBlock,
  mergeCreationSettings,
  normalizeCreationReasons,
  resolveCreationSettings,
  REVIEW_SCRIPT_TYPES,
  scriptTypeForLabel,
  type CreationSettings,
} from '@/lib/creation-settings';

/**
 * 选题板块的查询拼装。选题页面和开物助理共用这一份，保证两边给模型的提示词一致。
 *
 * 页面负责收集状态（选了哪些平台、赛道、打法、档案等），拼装的逻辑全在这里。
 * 「这批选题用了哪种配比」会回传给页面展示（页面自己决定怎么显示）。
 */

export interface TopicBoardInput {
  creatorContext: CreatorContext;
  selectedProfile: CreatorProfile | null;
  positioningForCtx: CreatorContext['positioning'];
  topicCount: number;
  topicType: string;
  topicRole: '按配比' | ContentRole;
  mode: string;
  sourceReference: string;
  sourceFrom: string;
  incomingSetup: HandoffPayload | null;
  keyword1: string;
  keyword2: string;
  keyword3: string;
  personalRequirement: string;
  currentSettings: CreationSettings;
  accountStage: string;
  fansLevel: string;
  avgViewsInput: string;
  selectedPlatforms: string[];
  selectedTracks: string[];
  selectedContentTypes: string[];
  selectedStyles: string[];
  positioningExtra: string;
  selectedElements: string[];
  /** 选中的成交理由（已经换成名称） */
  dealReasonLabels: string[];
  benchmarkAccounts: string;
  viralCases: string;
  difficulty: string;
  withHook: boolean;
  tactic: string;
  route: CreativeRoute;
  routeExplicit: boolean;
  resolvedMix: ResolvedMix;
  quickTopics: boolean;
}

export interface TopicBoardQuery {
  /** 发给 /api/dify/stream 的完整提示词（已经带上创作设置） */
  query: string;
  /** 这批选题按配比用的分配（页面展示用；不是按配比时为 null） */
  mixUsed: { resolved: ResolvedMix; count: number } | null;
}

  export interface TopicSettingsInput {
  keyword1: string;
  personalRequirement: string;
  sourceReference: string;
  selectedPlatforms: string[];
  selectedTracks: string[];
  selectedContentTypes: string[];
  selectedStyles: string[];
  selectedElements: string[];
  /** 页面上勾选的成交理由（id） */
  selectedDealReasons: string[];
  topicRole: '按配比' | ContentRole;
  topicCount: number;
  tactic: string;
  /** 从原内容带过来的设置（没有就是空对象） */
  autoSettings: CreationSettings;
  creatorContext: CreatorContext | null;
}

/**
 * 选题板块的创作设置。选题页面和开物助理都用这一个算法，同样的输入得到同样的设置。
 */
export function topicCreationSettings(input: TopicSettingsInput): CreationSettings {
  const { autoSettings } = input;
  return resolveCreationSettings({
    from: '选题策划',
    sourceContent: input.sourceReference || input.keyword1 || input.personalRequirement,
    settings: mergeCreationSettings(autoSettings, {
      topic: input.keyword1,
      direction: input.personalRequirement,
      platform: input.selectedPlatforms[0],
      industry: input.selectedTracks.join('、'),
      scriptType: REVIEW_SCRIPT_TYPES[autoSettings.scriptType!] === input.selectedContentTypes[0]
        ? autoSettings.scriptType
        : scriptTypeForLabel(input.selectedContentTypes[0]),
      style: input.selectedStyles.join('、'),
      purpose: input.topicRole === '按配比' ? undefined : input.topicRole,
      elements: input.selectedElements,
      topicCount: input.topicCount,
      tactic: input.tactic,
      dealReasons: normalizeCreationReasons([...autoSettings.dealReasons || [], ...input.selectedDealReasons]),
    }),
  }, input.creatorContext);
}

export const extractRelevantPositioningInfo =(fullContent: string): string => {
    if (!fullContent) return '';
    
    const lines = fullContent.split('\n');
    let relevantContent = '';
    let skipSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 需要跳过的章节（对选题策划无用）
      if (
        line.includes('15天') || 
        line.includes('冷启动') ||
        line.includes('执行计划') ||
        line.includes('Day ') ||
        line.includes('第1-') ||
        line.includes('第2-') ||
        line.includes('第3-') ||
        line.includes('变现路径') ||
        line.includes('时间节点') ||
        line.includes('数据指标') ||
        line.includes('发布时间') ||
        line.includes('具体操作') ||
        line.includes('内容战略矩阵') ||
        line.includes('人设IP完整设计') ||
        line.includes('对标账号参考') ||
        line.includes('参考账号') ||
        line.includes('视觉呈现设计') ||
        line.includes('视觉呈现（') ||
        line.includes('话术风格设计') ||
        line.includes('独特记忆点') ||
        line.includes('内容配比') ||
        line.includes('内容方向与配比') ||
        line.includes('流量型') ||
        line.includes('变现型') ||
        line.includes('人设型') ||
        line.includes('拍摄方向') ||
        line.includes('拍摄目的') ||
        line.includes('占比') ||
        line.includes('发布节奏') ||
        line.includes('差异化卖点') ||
        line.includes('执行清单') ||
        line.includes('具体执行') ||
        line.includes('检查清单') ||
        line.includes('判断标准') ||
        line.includes('优化建议') ||
        line.includes('核心人设标签') ||
        line.includes('人设三要素') ||
        line.includes('妆容设计') ||
        line.includes('穿搭设计') ||
        line.includes('拍摄场景') ||
        line.includes('主场景') ||
        line.includes('辅助场景') ||
        line.includes('道具：') ||
        line.includes('主赛道') ||
        line.includes('副赛道') ||
        line.includes('方向1：') ||
        line.includes('方向2：') ||
        line.includes('方向3：') ||
        line.includes('方向4：') ||
        line.includes('方向5：') ||
        line.includes('选题公式') ||
        line.includes('脚本类型') ||
        line.includes('卖点1：') ||
        line.includes('卖点2：') ||
        line.includes('卖点3：') ||
        line.includes('如何体现？') ||
        line.includes('视频中的呈现') ||
        line.includes('画面**：') ||
        line.includes('话术**：') ||
        line.includes('底妆：') ||
        line.includes('眼妆：') ||
        line.includes('口红：') ||
        line.includes('上衣：') ||
        line.includes('下装：') ||
        line.includes('配色：') ||
        line.includes('测试出') ||
        line.includes('至少产出') ||
        line.includes('收到第') ||
        line.includes('适合方向判断') ||
        line.includes('最适合方向') ||
        line.includes('支撑理由') ||
        line.includes('3个支撑理由') ||
        line.includes('个支撑理由')
      ) {
        skipSection = true;
        continue;
      }
      
      // 遇到新的章节标题，检查是否在黑名单中
      if (line.startsWith('##') || line.startsWith('###')) {
        // 如果章节标题在黑名单中，保持skipSection=true
        if (line.includes('内容方向与配比') || 
            line.includes('内容配比') ||
            line.includes('拍摄方向') ||
            line.includes('执行计划') ||
            line.includes('流量型') ||
            line.includes('变现型')) {
          skipSection = true;
        } else {
          skipSection = false;
        }
      }
      
      // 需要保留的章节（对选题策划有用）
      if (
        line.includes('账号定位') ||
        line.includes('目标人群') ||
        
        line.includes('差异化') ||
        line.includes('选题方向') ||
        line.includes('内容风格') ||
        line.includes('核心价值')
      ) {
        skipSection = false;
      }
      
      // 如果不在跳过区域，保留内容
      if (!skipSection && line.trim() !== '') {
        relevantContent += line + '\n';
      }
    }
    
    // 如果提取失败，返回前500字符作为摘要
    if (relevantContent.trim().length < 50) {
      return fullContent.substring(0, 500) + '...';
    }
    
    return relevantContent.trim();
  };

export function buildTopicBoardQuery(input: TopicBoardInput): TopicBoardQuery {
  const {
    creatorContext,
    selectedProfile,
    positioningForCtx,
    topicCount,
    topicType,
    topicRole,
    mode,
    sourceReference,
    sourceFrom,
    incomingSetup,
    keyword1,
    keyword2,
    keyword3,
    personalRequirement,
    currentSettings,
    accountStage,
    fansLevel,
    avgViewsInput,
    selectedPlatforms,
    selectedTracks,
    selectedContentTypes,
    selectedStyles,
    positioningExtra,
    selectedElements,
    dealReasonLabels,
    benchmarkAccounts,
    viralCases,
    difficulty,
    withHook,
    tactic,
    route,
    routeExplicit,
    resolvedMix,
    quickTopics,
  } = input;

      const topicContext = buildContextBlock(
        {
          profile: selectedProfile ?? null,
          positioning: positioningForCtx,
          dealReasons: [],
          // 数据回流：这个号发出去的真实数据，出选题时参考（lib/performance）
          performance: creatorContext.performance,
          // 行业建议（药方）：选题也要照它来，不然存过的药方在选题页上等于没有（2026-10-19 发现）
          advice: creatorContext.advice,
          adviceAt: creatorContext.adviceAt,
          adviceStale: creatorContext.adviceStale,
          // 内容定位的系列清单：选题只能从这里的系列里选（lib/context-manifest 的 deep=content）
          contentPositioning: creatorContext.contentPositioning,
        },
        'topic'
      );
      const customModeContext = selectedProfile
        ? describeRestrictions(selectedProfile)
        : '';

      let mixUsed: { resolved: ResolvedMix; count: number } | null = null;
      let query = `【工作任务】生成${topicCount}条${topicType}\n\n`;
      /*
       * 带着内容来的：这份内容是这批选题的出发点，放在最前面、说清楚是硬要求（2026-10-05）。
       * 原来它夹在配比、36 计清单中间，后面还有「结合当前热点」「个人要求：所有选题必须围绕大方向」，
       * 模型按大方向另编了一批故事，和带过来的脚本不相干
       */
      const sourced = Boolean(sourceReference.trim());
      if (sourced) {
        // 原方向的方向、目的、思路、拍法（2026-10-05 产品方：带去做选题要基于原来的方向、思路、目的设计）
        const intent = intentBlock(carriedIntent(incomingSetup));
        query += `【这批选题从带来的内容出发】🚨 最重要，压过下面所有设置\n`;
        if (carriesScript(incomingSetup)) {
          query += `下面是编导从「${sourceFrom || '前一步'}」带过来的一条脚本。${topicCount} 条选题每一条都必须直接取材于这条脚本里的具体人物、事件、场景、细节、对话或观点，同时守住原方向的思路和目的，比如：\n`;
          query += `- 同一件事换一个角度、换一个人的视角讲\n- 把其中一个细节、一句对话放大成一条\n- 拆成前因、经过、后续，做成系列\n- 把里面的观点或做法单独拿出来讲透\n`;
          query += `不许只沿用大方向、系列名或账号定位，另编和这条脚本无关的新故事；也不要通用的行业选题。\n`;
        } else {
          query += `下面是编导从「${sourceFrom || '前一步'}」带过来的内容（方向 / 方案 / 思路）。${topicCount} 条选题每一条都必须按它的方向、核心思路和目的来设计：是这个方向下面能拍的具体一期，拍法照它写的来。\n`;
          query += `- 它写了目的，每条选题的目的就从这里面选，不出别的目的\n`;
          query += `不许借这个方向的名头，出和它的核心思路无关的选题；也不要通用的行业选题。\n`;
        }
        query += `下面的配比、打法、爆款元素都在这个范围里用。\n\n`;
        query += `${topicSourceRules(carriesScript(incomingSetup))}\n\n`;
        if (intent) query += `${intent}\n`;
        query += `${sourceReference}${continuationRules('topic')}\n\n`;
      }
      query += `${topicDesignStandards({ source: sourceReference, direction: personalRequirement, userIntent: currentSettings.userIntent || [keyword1, keyword2, keyword3].filter(Boolean).join('、') })}\n\n`;
      query += `🚨 核心原则：可落地、易执行\n`;
      query += describeExecutionConstraints(selectedProfile ?? null) + `\n`;
      query += `- 真实性：基于真实场景，不能天马行空或过度夸张\n\n`;

      // 模式说明
      if (mode === "quick") {
        query += `【模式】⚡ 快速模式（使用已保存的档案和定位）\n\n`;
        // 档案和定位统一由 buildContextBlock 拼。原来这里是手写的 15 行「- 字段：值」，
        // 有两个毛病：一是漏掉了「绝对不能说」这条硬禁忌；二是没值时输出一片
        // 「未设置」，等于花 token 告诉模型"我不知道"。
        if (topicContext) query += topicContext + `\n\n`;
      } else {
        query += `【模式】🎨 自定义模式（手动填写）\n\n`;
        // 自定义模式下平台、赛道、阶段这些用户自己填了，以他填的为准。
        // 但禁忌和拍摄条件表单里根本没问——不带上的话，
        // 「全网最便宜不能说」会因为换了个模式就凭空消失
        if (customModeContext) query += customModeContext + `\n\n`;
      }

      // 基础信息
      query += `【基础信息】\n`;
      if (accountStage) query += `- 账号阶段：${accountStage}\n`;
      if (fansLevel) query += `- 粉丝级别：${fansLevel}\n`;
      if (avgViewsInput) query += `- 平均播放量：${avgViewsInput}\n`;
      if (selectedPlatforms.length > 0) query += `- 平台：${selectedPlatforms.join('、')}\n`;
      if (selectedTracks.length > 0) query += `- 赛道：${selectedTracks.join('、')}\n`;
      if (selectedContentTypes.length > 0) query += `- 内容类型：${selectedContentTypes.join('、')}\n`;
      // 脚本类型分配（如果选择了内容类型）
      if (selectedContentTypes.length > 0) {
        query += `\n【脚本类型约束】🎬 重要！必须严格遵守\n`;
        query += `用户选择了 ${selectedContentTypes.length} 种脚本类型，生成的 ${topicCount} 条选题必须按以下分配：\n`;
        
        // 计算平均分配
        const countPerType = Math.floor(topicCount / selectedContentTypes.length);
        const remainder = topicCount % selectedContentTypes.length;
        
        selectedContentTypes.forEach((type, index) => {
          const count = countPerType + (index < remainder ? 1 : 0);
          query += `- ${type}：${count}条\n`;
        });
        
        query += `\n⚠️ 每条选题必须明确标注使用的脚本类型！\n`;
        query += `⚠️ 严格按照上述数量分配，不得超出或减少！\n`;
        query += `\n💡 脚本类型不等于目的，目的也不由脚本决定：同一种脚本可以做大流量、人设或变现。\n`;
        query += `大流量看出发点（人、货、场，三有，爆款元素），脚本只是把它拍出来的形式。每条先定目的和出发点，再选结构。\n\n`;
      }
      if (selectedStyles.length > 0) query += `- 风格：${selectedStyles.join('、')}\n`;
      if (positioningExtra) {
        // 再次过滤，确保不包含内容配比等执行层信息
        const filteredExtra = extractRelevantPositioningInfo(positioningExtra);
        // 定位现在是完整摘要而非 300 字残片，多行内容挂在「- 」后面会
        // 破坏列表结构，模型容易把后续行读成并列的基础信息，所以单独成段
        query += `\n【账号定位】\n${filteredExtra}\n`;
        query += `⚠️ 以上是这个账号已经确定的定位，生成的每条选题都必须符合它，不能偏离赛道和目标人群。\n`;
      }
      query += `\n`;

      /*
       * 爆款元素连句式一起发。
       *
       * 原来这里只发名字（「- 八大爆款元素：成本、人群」），模型拿到的是
       * 两个词，出来的选题跟这套方法没什么关系。真正有用的是原文那些
       * 固定句式——「贬值最快的X」「外行人绝对不知道的X」，
       * 模型套上去就能直接出选题。
       */
      const elementBlock = viralElementPrompt(selectedElements);
      if (elementBlock) {
        query += `${elementBlock}\n\n`;
      }
      
      /*
       * 这批选题的目的。原来是二选一：勾了成交理由就是"变现选题"，没勾就是
       * "大流量选题，不考虑转化"——人设型整个没有，而且流量型被写成了"纯粹为了播放量"，
       * 涨来的都是泛粉。现在按三种视频来，定义全站只有 lib/content-roles 一份。
       */
      const dealReasonsText = dealReasonLabels.join('、');
      if (topicRole === '按配比') {
        /*
         * 原来是一句"按上面账号定位里定好的配比分配"——配比只在定位文字里，模型每次理解不一样，
         * 也没人核对。现在由 lib/content-mix 算出确定的条数（档案设置 / 这次临时改的 / 系统按阶段推荐）
         */
        query += `\n【这批选题的目的】流量型、人设型、变现型按配比搭配\n\n`;
        query += `${mixPromptBlock(resolvedMix, { count: topicCount })}\n\n`;
        query += `${rolesGuide()}\n\n`;
        mixUsed = { resolved: resolvedMix, count: topicCount };
      } else {
        mixUsed = null;
        query += `\n【这批选题的目的】全部是${topicRole}\n\n${roleBrief(topicRole)}\n\n`;
      }
      if (topicRole === '流量型') {
        // 举例从同一份数据取，别再手写——上一版写的「反差」原文里根本没有（叫「对立选题」）
        query += `- 大流量的出发点：先看这个档案的行业、人、货、场和团队条件，只从八大爆款元素（${VIRAL_ELEMENTS.map((e) => e.name).join('、')}）里挑普通人拍得出来的那几个；围绕它至少符合三有（有用、有趣、有共鸣）中的一条，做出看点和噱头、吸引眼球。每条流量选题必须用上至少一个爆款元素（必填，写明用哪个，设计进选题本身）；不为了爆款而爆款。元素定好之后，再推荐脚本结构（36 计或四大脚本）\n`;
        query += `- 覆盖要广，但人群要对——垂直是人群垂直：选这个号的目标人群也关心的话题，不是随便什么热闹都蹭\n\n`;
      }
      if (topicRole === '人设型') {
        query += `- 人设型的逻辑：让人记住你、信你这个人（深度信任），也让消费者对你这个人产生兴趣、喜欢你。先看档案，定一两个要让人记住的性格、人品或举动，以及支撑它的真实经历（成长、职业、与客户家人员工的相处、价值边界）；用具体行为拍出来；故事、观点、过程都可以，不局限于某个脚本；不带成交理由，素材不编造\n\n`;
      }
      if (dealReasonsText && topicRole !== '流量型' && topicRole !== '人设型') {
        query += `- 成交理由（只给变现型选题用）：${dealReasonsText}\n`;
        query += `⚠️ 变现型选题的逻辑：围绕人、货、场，突出一个成交理由（用户为什么选你），要在画面、过程或结果里看得见，不局限于某个脚本；标题可以体现它，但不能只写在标题里。流量型选题不带成交理由，人设型也不写成交理由\n\n`;
      } else if (topicRole === '变现型') {
        query += `⚠️ 用户没选成交理由：从档案的核心卖点和客人常问里找出这个号的成交理由，每条变现型选题落在其中一个上\n\n`;
      }

      // 高级设置
      
      // 个人要求
      if (personalRequirement) {
        query += `\n【🎯 个人要求】\n`;
        query += `${personalRequirement}\n`;
        query += `⚠️ 重要：所有选题必须围绕上述个人要求展开，确保满足用户的具体需求！\n\n`;
      }

      query += `【高级设置】\n`;
      if (keyword1 || keyword2 || keyword3) {
        const keywords = [keyword1, keyword2, keyword3].filter(k => k);
        query += `- 关键词组合：${keywords.join(' + ')}\n`;
      }
      if (benchmarkAccounts) query += `- 竞品账号：${benchmarkAccounts}\n`;
      if (viralCases) query += `- 爆款案例：${viralCases}\n`;
      query += `- 生成数量：${topicCount}条\n`;
      query += `- 创意难度：${difficulty}\n`;
      query += `- 开头钩子：${withHook ? '✅ 需要生成3秒钩子' : '❌ 不需要'}\n\n`;
      
      // 明确输出格式要求
      // 拍法。放在输出格式之前，让这条约束离"开始写"最近。
      // 打法决定的是形式不是内容：同一条选题用「反向操作」和用「情境还原」
      // 是两条完全不同的片子，所以它必须影响每一条选题的拍摄思路。
      if (tactic) {
        const brief = tacticBrief(tactic);
        if (brief) {
          query += `【本批选题的拍法】🎬 必须遵守\n\n`;
          query += `${brief}\n\n`;
          query += `⚠️ 这 ${topicCount} 条选题都要能用这一计拍出来：\n`;
          query += `- 每条选题的拍摄思路要落在上面那个结构公式上，不是只在标题里提一句\n`;
          query += `- 拍不出来的选题就别给——宁可换个角度，也不要凑数\n`;
          query += `- 上面的「边界」是红线，碰线的选题直接不要\n\n`;
        }
      } else {
        // 没整批指定某一计：按用户选的路子分配，36 计连公式一起给，只给计名模型不知道怎么拍
        const preferred = topicPreferredTactic({ source: sourceReference, direction: personalRequirement, explicit: routeExplicit });
        query += `${topicRoutePrompt({ route, count: topicCount, sourced, explicit: routeExplicit })}\n\n`;
        if (preferred) {
          query += `【承接原拍法】本轮所有选题继续用${preferred}，差异来自问题与追问。四大脚本只用于组织真实回答，不另换节目。\n${tacticBrief(preferred)}\n\n`;
        } else query += `${ROUTES_GUIDE}\n\n`;
        if (!preferred && route !== '四大脚本') {
          const blocked = tacticsBlockedBy(
            [selectedProfile?.content_restrictions, selectedProfile?.avoid_content, selectedProfile ? taboosPromptBlock(selectedProfile) : ''].filter(Boolean).join('\n')
          );
          query += `${tacticIndex({ roles: topicRole === '按配比' ? undefined : [topicRole], exclude: blocked })}\n\n`;
          if (blocked.length) query += `⛔ 这几计和账号禁忌冲突，已从清单拿掉，不要用：${blocked.join('、')}\n\n`;
        }
      }

      query += `【创新要求】🎨 重要！\n`;
      query += `- ⚡ 新意来自更好的问题、证据和表达，先把用户最想拍的那一期做扎实，不为追求冷门绕开它\n`;
      query += `- 🎯 每条选题都要有独特的切入点\n`;
      // 带着内容来的，新意在这份内容里找；去追热点就跑出原内容了
      query += sourced ? `- 💡 新角度在带来的内容范围里找，不另外去追热点、时事\n` : `- 💡 结合当前热点、时事、流行文化\n`;
      query += `- 🔥 创造记忆点，让人眼前一亮\n\n`;
      // 一针见血：标题有具体的东西和一个反差，每条只押一个看点，人和事只写真的
      query += `【一针见血】\n${TITLE_CRAFT}\n${ONE_POINT_RULE}\n${REAL_PEOPLE_RULE}\n${REALITY_RULE}\n\n`;

      query += `【选题三关】（小黄第17节）每条都要过：覆盖的人够不够多、给了什么明确价值、是不是比用户多一步认知\n\n`;
      query += `【输出格式要求】\n`;
      query += `每条选题必须包含以下部分：\n\n`;
      query += `## 选题X：[标题]\n\n`;
      if (sourced) query += `**承接**：这条取自带来内容里的哪一处（引原文一句，或点名那个细节、那条思路）\n\n`;
      query += `**0️⃣ 视频目的**\n`;
      query += `流量型 / 人设型 / 变现型，只写一个，后面一句话说为什么\n\n`;
      // 这一行的写法固定，页面要从它认出用的哪一计，带到脚本页
      query += `**🅰 打法**\n`;
      query += `二选一照这个格式写：\n`;
      query += `- 36计·第N计 计名：把这一计的结构公式套到这条上，写成具体的事件（如「常规A → 反向B → 真实反应」写成这条里真正发生的事）\n`;
      query += `- 四大脚本·脚本类型（聊观点 / 晒过程 / 教知识 / 讲故事）：一句话说这条怎么讲\n\n`;
      query += `**1️⃣ 爆款元素**\n`;
      if (selectedElements.length > 0) {
        // 用全名（「最差选题」而不是「最差」），和上面那段句式对得上
        const elementsText = selectedElements
          .map((id) => viralElementById(id)?.name ?? id)
          .join('、');
        query += `注明用了哪个元素（限 ${elementsText}）以及套的是哪一条句式\n\n`;
      } else {
        query += `四大脚本的选题用2-3个元素及应用方式；36计的选题叠1个就够，不叠写"无"\n\n`;
      }
      query += `**2️⃣ 开篇钩子**\n`;
      query += withHook ? `结合知识库设计一句能实际说出口的开头，尽快进入这条的真实问题。尚未采访时写「今天去问/到底有没有变化」的提问型开头，不能写「我问过/发现/没想到」的结果型开头。只写文案，不拆成三个每秒一句的口号。\n\n` : `用户本次不需要开篇钩子，不生成开头文案。\n\n`;
      query += `**3️⃣ 内容方向及目的（重中之重！）**\n`;
      query += `⚠️ 这是整个选题的核心，决定视频成败\n`;
      query += `- 核心内容方向：[这条视频到底要讲什么？用1句话说清楚]\n`;
      query += `- 核心问题与观众价值：[具体要弄明白什么，目标人群为什么在意]\n`;
      query += `- 取材与内容推进：[对象怎么选，主问题及追问/验证动作是什么，真实材料怎样一步步回答问题；采访稿要给可直接问出口的问题]\n`;
      query += `- 事实边界：[哪些素材已提供，哪些需现场获得；不同结果出现时如何呈现，不编受访者答案]\n`;
      query += `- 关键画面（3个）：[需采集的动作、采访问题或现场证据；受访者回答写「保留现场原话」，不写示范答案]\n`;
      query += `- 场景设置：[在哪拍？什么环境？]\n`;
      query += `以上已经讲清观众价值，不再重复一段空泛的共鸣、焦虑或认知说明。\n\n`;
      query += `**4️⃣ 脚本结构**\n`;
      /*
       * 原来是"从 19 种结构中推荐 3 个"：解题/推荐/揭秘/案例/火车节/论证/故事/对比/清单/
       * 时间线/问答/情景剧/测评/挑战/教程/反转/盘点/采访/观察——大半是知识库里没有的
       * 通用词，而且跟这条视频的目的无关。现在从目的对应的结构里挑（知识库原文）。
       */
      query += `从这条目的对应的结构里挑1个最合适的（见上面「三种视频」），把每步对应的具体问题、动作或证据写清楚，能直接指导拍摄和剪辑。结构标签不能替代内容。\n`;
      query += `用 36 计的：计的公式管事件怎么走，这里的结构管话怎么讲，两者叠加；纯按计的公式拍、不另套结构的，写"按计的公式走"\n\n`;
      query += `**5️⃣ 结尾行动指令**\n`;
      query += `只写一个，按目的来：流量型要关注或评论，人设型要关注或看主页，变现型要私信、到店或留资中的一个\n\n`;
      query += `**6️⃣ 执行要点**\n`;
      query += `按本轮已提供的人员、设备、时间与预算落地，不擅自安排全天跟拍或多人剧情。\n`;
      query += `写清素材准备、对象沟通、收声与必要注意事项，详略以实际能执行为准。\n\n`;
      
      if (topicRole !== '流量型' && topicRole !== '人设型') {
        query += `**7️⃣ 成交理由**（只有变现型选题写这一项）\n`;
        query += `- 体现的理由：[${dealReasonsText ? `从${dealReasonsText}中选1-2个` : '这个号的哪个卖点'}]\n`;
        query += `- 转化路径：[观看→互动→到店/购买，最多15字]\n\n`;
      }

      query += `---\n\n`;
      query += `\n⚠️ 核心要求（必须严格遵守）：\n`;
      query += `🎯 可落地性原则：\n`;
      query += `- 生成的选题必须100%可执行，不能天马行空\n`;
      query += describeExecutionConstraints(selectedProfile ?? null) + `\n`;
      query += `- 贴合现实：基于真实场景，不能太夸张\n\n`;
      if (sourced) query += `🔗 交稿前逐条检查：这条能在带来的内容里找到出处吗？找不到就换成找得到的\n\n`;
      query += `📋 具体要求：\n`;
      query += withHook ? `1. 开篇钩子只写文案，结合知识库优化，不能先编出现场结论\n` : `1. 用户不需要开头文案，本批不生成开篇钩子\n`;
      query += `2. 内容方向及目的是重中之重：核心方向一句话，用户价值要明确\n`;
      query += `3. 每条都写「🅰 打法」；用 36 计的，计名和清单一字不差，公式要落在事件上，不是只在标题提一句\n`;
      query += `4. 每条只担一个目的；脚本结构和结尾行动指令都按目的来，结尾指令只要一个\n`;
      query += `5. 变现型选题必须写成交理由和转化路径（最多15字）\n`;
      // 原来「严格控制在220字以内」：把选题的内容方向、关键画面压得太薄（2026-10-06 产品方：不框死上限，先保证质量）
      query += `6. 每条把上面各项写清楚、写具体，去废话、不注水；不用为了凑短省掉关键画面和内容方向。最后不用再写总览表和「自检确认」清单（页面会自动核对），篇幅留给选题本身\n`;
      if (quickTopics && topicCount <= 3) query += `7. 用户选的是「快速 3 条」：每条只写视频目的、打法、开篇钩子、脚本结构（三四行）、结尾行动指令，每项一两句；爆款元素、执行要点、成交理由合成一句写在结构后面。每条 500 字以内\n`;
      query += `\n${topicDesignFinalCheck()}\n`;

  return { query: query + creationSettingsBlock(currentSettings), mixUsed };
}
