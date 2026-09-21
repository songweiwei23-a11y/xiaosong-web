"use client";
import ContinuousDialog from "@/components/ContinuousDialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { extractScriptContext } from "@/lib/positioning-utils";
import { getScriptDetails, getHookDetails } from "@/lib/script-details";
import { enhancePromptWithMCNStandards } from "@/lib/enhance-prompt";
import { recommendFormula, generateFormulaGuide } from "@/lib/formula-enforcer";
import { getStructureNarrative } from "@/lib/script-structure-details";
import { 
  getAudienceProfile, 
  getDifferentiation, 
  getAvoidStyles, 
  getShouldSayExamples, 
  getShouldNotSayExamples,
  getContentFocus,
  getSmartHookRecommendation,
  getTimeAllocation,
  getStepTasks
} from "@/lib/script-helpers";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { evaluateScriptQualityStrict, formatQualityReport, getRelevantExample } from "@/lib/quality-checker";

import { useState, useEffect, useCallback } from "react";
// 复制/下载/历史相关的图标已随结果区一起移入 ResultPanel 与 HistoryPanel
import {
  Sparkles, AlertCircle, Loader2, ChevronDown, ChevronUp, Settings, Target, Lightbulb, Film, FileText,
  BookOpen, Clapperboard, MessageSquare, Feather, UserPlus, Ticket, Store, Package, CheckCircle, Tag,
} from "lucide-react";
import { notify } from '@/components/ui/feedback';

// 静态配置与折叠组件已抽离
import {
  SCRIPT_TYPES,
  PLATFORMS,
  DURATIONS,
  CONTENT_INDUSTRIES,
  AD_INDUSTRIES,
  DEAL_REASONS,
  STYLES,
  TARGET_GROUPS,
  BOOM_ELEMENTS,
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  DIRECTOR_THOUGHTS,
  SCENES,
  DEVICES,
  BUDGETS
} from "./constants";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { useScriptHistory } from "./useScriptHistory";
// 统一走通用组件，脚本页原先那份已删除
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { putHandoff, takeHandoff } from "@/lib/handoff";
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import QuotaReminder from "@/components/quota-reminder";
import QuotaExhausted from "@/components/quota-exhausted";
import { supabase } from "@/lib/supabase/client";
import { Field, OptionCard } from "@/components/form/Field";

/*
 * 表单控件的共用样式。抽成常量而不是每处写一遍长串类名：
 * 这个页面有十七个字段，散着写的结果就是圆角、内边距、聚焦色各不相同
 * ——改版前正是如此，光 rounded 就有三种值。
 */
const CONTROL_BASE =
"w-full rounded-xl border border-border bg-background/50 text-[13px] text-foreground " +
"placeholder:text-muted-foreground/70 transition-colors " +
"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const SELECT_CLS = `${CONTROL_BASE} px-3 py-2.5`;
const INPUT_CLS = `${CONTROL_BASE} px-3 py-2.5`;
const TEXTAREA_CLS = `${CONTROL_BASE} resize-none px-3.5 py-3 leading-relaxed`;

/** 可点选的小标签：平台、时长、爆款元素等多处共用 */
function chipCls(selected: boolean) {
  return `glass-interactive rounded-lg border px-2.5 py-1.5 text-[12px] ${
    selected ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
  }`;
}

/**
 * 脚本类型的图标与身份色。
 *
 * 四个纯文字卡片并排时几乎分辨不出差异，得逐个读标题才知道点哪个；
 * 给每类配一个固定的图标与颜色后，用熟了扫一眼就能定位。
 * 颜色按语义选：教学偏理性用蓝，过程展示用暖橙，观点表达用紫，
 * 故事用绿；广告四类统一走主题色，避免与内容类混淆。
 */
const SCRIPT_TYPE_STYLE: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; accent: "sky" | "amber" | "violet" | "emerald" | "primary" }
> = {
  teach: { icon: BookOpen, accent: "sky" },
  show: { icon: Clapperboard, accent: "amber" },
  discuss: { icon: MessageSquare, accent: "violet" },
  story: { icon: Feather, accent: "emerald" },
  ad_lead: { icon: UserPlus, accent: "primary" },
  ad_group: { icon: Ticket, accent: "primary" },
  ad_offline: { icon: Store, accent: "primary" },
  ad_product: { icon: Package, accent: "primary" },
};

export default function ScriptPage() {
  const [scriptType, setScriptType] = useState("teach");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [customDuration, setCustomDuration] = useState("");
  // 时长模式：preset=预设选择 / custom=自定义秒数 / ai=AI推荐（由Dify判断）
  const [durationMode, setDurationMode] = useState<"preset" | "custom" | "ai">("preset");
  const [style, setStyle] = useState("专业");
  const [targetGroup, setTargetGroup] = useState("");
  const [boomElements, setBoomElements] = useState<string[]>([]);
  const [hookType, setHookType] = useState("auto");
  const [scriptStructure, setScriptStructure] = useState("auto");
  const [directorThoughts, setDirectorThoughts] = useState<string[]>(["emotion", "picture"]);
  const [scene, setScene] = useState("室内");
  const [device, setDevice] = useState("手机");
  const [budget, setBudget] = useState("低成本(0-500)");
  const [personnel, setPersonnel] = useState("一人");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [accountPositioning, setAccountPositioning] = useState("");
  
  // 新增state
  const [activeTab, setActiveTab] = useState<"content" | "ad">("content");
  const [dealReasons, setDealReasons] = useState<string[]>([]);
  const [customTargetGroup, setCustomTargetGroup] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [productInfo, setProductInfo] = useState("");
  const [priceInfo, setPriceInfo] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);

  const [result, setResult] = useState("");

  // 历史记录 + 持续对话（已抽离为 hook）
  const {
    scriptHistory,
    loadScriptHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    lastResult,
  } = useScriptHistory();

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult);

  // 当前结果区展示的是哪条历史，用于在列表里高亮。
  // 新生成时清空——此时结果区的内容还没入库，不属于任何一条历史。
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const router = useRouter();

  /**
   * 接收从别的功能带过来的内容。
   *
   * 选题页会把解析出来的选题列表一并带来，这里存下供用户挑一条；
   * 只带了单个主题时直接填进主题框。
   */
  const [handoffTopics, setHandoffTopics] = useState<string[]>([]);
  const [handoffFrom, setHandoffFrom] = useState("");

  useEffect(() => {
    const data = takeHandoff();
    if (!data) return;
    setHandoffFrom(data.from || "");
    if (data.topic) setTopic(data.topic);
    if (data.topicOptions?.length) setHandoffTopics(data.topicOptions);
    if (data.note) setAdditionalInfo(data.note);
  }, []);

  // 档案和定位关联
  const [profiles, setProfiles] = useState<any[]>([]);
  const [positionings, setPositionings] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPositioningId, setSelectedPositioningId] = useState("");

  // 额度提醒相关状态
  const [quotaWarnings, setQuotaWarnings] = useState<any[]>([]);
  const [showQuotaReminder, setShowQuotaReminder] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [showQuotaBanner, setShowQuotaBanner] = useState(false);
  const [planName, setPlanName] = useState("免费版");


  // 加载档案和定位
  useEffect(() => {
    loadProfiles();
    loadPositionings();
  }, []);

  // 检查额度
  useEffect(() => {
    const checkQuota = async () => {
      try {
        await checkQuotaStatus();
      } catch (error) {
        console.error("额度检查初始化失败:", error);
      }
    };
    checkQuota();
  }, []);

  const checkQuotaStatus = useCallback(async () => {
    console.log("🔍 开始检查用户额度...");
    
    // 检查是否在24小时内已经提醒过
    const lastReminderTime = localStorage.getItem('quota_reminder_time');
    if (lastReminderTime) {
      const timeDiff = Date.now() - parseInt(lastReminderTime);
      const hours = timeDiff / (1000 * 60 * 60);
      if (hours < 24) {
        console.log(`✓ ${hours.toFixed(1)}小时内已提醒过，跳过额度检查`);
        return;
      }
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("用户未登录，跳过额度检查");
        return;
      }

      const userId = session.user.id;
      const res = await fetch(`/api/quota/check?userId=${userId}`);
      
      if (!res.ok) {
        console.error("额度检查API返回错误:", res.status);
        return;
      }
      
      const data = await res.json();
      
      if (data.planName) {
        setPlanName(data.planName);
      }
      
      if (data.exhausted) {
        // 检查本次会话是否已经看过额度用尽提示
        const lastExhaustedTime = localStorage.getItem('quota_exhausted_time');
        let shouldShow = true;
        if (lastExhaustedTime) {
          const timeDiff = Date.now() - parseInt(lastExhaustedTime);
          const hours = timeDiff / (1000 * 60 * 60);
          shouldShow = hours >= 24;
          console.log(`⏰ 距离上次提示已过 ${hours.toFixed(1)} 小时`);
        }
        if (shouldShow) {
          setQuotaExhausted(true);
          console.log("⚠️ 额度已用尽，显示提示页面");
        } else {
          console.log("✓ 24小时内已看过额度用尽提示，允许继续浏览");
        }
      } else if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
        setQuotaWarnings(data.warnings);
        setShowQuotaReminder(true);
      }
    } catch (error) {
      console.error("检查额度失败:", error);
      // 不阻塞页面正常使用
    }
  }, []);

  const loadProfiles = async () => {
    console.log("🔍 开始加载档案...");
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        console.log("✅ 档案加载成功:", data.length, "条"); setProfiles(data);
      }
    } catch (error) {
      console.error("加载档案失败:", error);
    }
  };

  const loadPositionings = async () => {
    console.log("🔍 开始加载定位...");
    try {
      const res = await fetch("/api/positioning");
      if (res.ok) {
        const data = await res.json();
        console.log("✅ 定位加载成功:", data.length, "条"); setPositionings(data);
      }
    } catch (error) {
      console.error("加载定位失败:", error);
    }
  };

  const toggleBoomElement = (id: string) => {
    setBoomElements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleDirectorThought = (id: string) => {
    setDirectorThoughts(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleDealReason = (id: string) => {
    setDealReasons(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const isAdScript = () => activeTab === "ad";

  const handleSmartRecommend = () => {
    if (platform === "抖音") {
      setDurationMode("preset"); setDuration("60秒"); setStyle("幽默");
    } else if (platform === "小红书") {
      setDurationMode("preset"); setDuration("90秒"); setStyle("干货");
    } else if (platform === "视频号") {
      setDurationMode("preset"); setDuration("60秒"); setStyle("温情");
    } else if (platform === "快手") {
      setDurationMode("preset"); setDuration("30秒"); setStyle("接地气");
    } else if (platform === "B站") {
      setDurationMode("preset"); setDuration("3-5分钟"); setStyle("专业");
    } else {
      setDurationMode("ai");
    }
    notify("✅ 已根据平台智能推荐时长和风格！");
  };

  const handleGenerate = async () => {
    // 0. 检查配额
    const remainingQuota = await checkQuota();
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("❌ 您的配额已用完，请联系管理员或升级会员");
      return;
    }

    // 1. 检查主题是否填写
    if (!topic.trim()) {
      notify("请输入视频主题");
      return;
    }

    setIsGenerating(true);
    setResult("");
    setActiveHistoryId(null); // 新内容还未入库，不属于任何一条历史
    let fullResult = ""; // 保存历史记录用

    try {
      // 构建结构化的query给Dify
      const dealReasonsText = dealReasons.length > 0 
        ? dealReasons.map(id => DEAL_REASONS.find(r => r.id === id)?.label).join("、") 
        : "未选择";
      
      const isAd = activeTab === "ad";
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

      if (selectedProfileId) {
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (profile) {
          profileInfo = `

【个人档案】
- 档案名称：${profile.profile_name || '未命名'}
- 平台：${profile.account_platform?.join("、") || "未设置"}
- 赛道：${profile.account_track?.join("、") || "未设置"}
- 账号阶段：${profile.account_stage || "未设置"}
- 粉丝量级：${profile.fans_level || "未设置"}
- 内容风格：${profile.content_style?.join("、") || "未设置"}
`;
        }
      }

      if (selectedPositioningId) {
        const positioning = positionings.find(p => p.id === selectedPositioningId);
        if (positioning) {
          const scriptContext = extractScriptContext(positioning.full_content || "");
          positioningInfo = `

【账号定位-脚本创作参考】
${scriptContext}
`;
        }
      }


      // ========== MCN级提示词增强 ==========
      const structureDetail = getScriptDetails(scriptStructure);
      const hookDetail = getHookDetails(hookType);
      const elementsWithNames = boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label).filter(Boolean).join('、');
      const mcnEnhancement = enhancePromptWithMCNStandards({
        structureDetail,
        hookDetail,
        elementsWithNames,
        duration: isAiDuration ? "AI自行推断的最佳时长" : finalDuration,
        isAd,
        dealReasonsCount: dealReasons.length  // 传入成交理由数量
      });
      const { structureGuide, hookGuide, formatRequirements } = mcnEnhancement;
      // ========== MCN级提示词增强结束 ==========

      const selectedProfile = selectedProfileId ? profiles.find(p => p.id === selectedProfileId) : null;
      const helperProfile = selectedProfile || {
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
      const durationForCalc = isAiDuration
        ? (customDuration ? `${customDuration}秒` : "60秒")
        : finalDuration;
      const timeAllocation = isAiDuration
        ? "由AI依据主题与平台节奏自行分配各段时长（开场钩子→主体→情绪高潮→结尾CTA）"
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
不要照搬其中的行业、案例或具体台词**——照搬会让脚本失去与本次主题的相关性。

${getRelevantExample(scriptType, durationForCalc, scriptStructure)}
`;
      // ========== 公式蓝图结束 ==========

      const fourStepWorkflow = `
## 🧭 生成流程（必须按顺序输出）

### 第1步：脚本策略卡
- 用3-5条说明本条脚本的核心策略：目标用户、核心痛点、主钩子、情绪推进、转化/互动目标
- 不写空泛定位，必须和主题、行业、账号信息直接相关

### 第2步：正文脚本
- ${isAiDuration
  ? "请根据主题复杂度、平台调性与内容节奏，自行判断最合适的视频总时长（并在脚本开头用一行标注：建议时长：XX秒），再据此完整输出可直接拍摄的脚本"
  : `按${finalDuration}完整输出可直接拍摄的脚本`}
- 必须包含秒数、镜头/画面、口播台词、字幕/音效/动作建议
- 开头3秒直接进入冲突、痛点、反常识或利益点，禁止废话开场

**格式硬性要求（不满足会被判定为缺失，务必遵守）：**
1. 开场必须单独成行标注钩子，格式示例：【开场钩子】0-8秒：（用半角冒号，秒数区间按实际填）
2. 结尾必须单独成行输出一句金句，格式示例：**金句**：“完整句子”（X字）
   - 金句正文控制在8-20字，用中文或英文双引号包裹，独立成行，不要和台词混在同一段
3. 每个镜头标注时间区间（如 8-15秒）和【镜头X】编号
4. 至少标注3处情绪波点（可用 ⚡😰😓💕🤝 等符号或“波点”字样）

### 第3步：优化建议（只写建议，不要打分）
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
      
      // 根据详细程度调整提示词策略
      const promptStrategy = isDetailedRequirement 
        ? '⚠️ **用户已提供详细脚本框架，请严格按照用户补充要求生成**，MCN标准作为质量保障参考。'
        : '⚠️ **请严格按照MCN标准生成专业脚本**，用户补充要求作为额外参考。';
      
      // 构建优先级说明
      const priorityNote = isDetailedRequirement
        ? `
## 📋 生成策略

**优先级**：用户补充要求 > MCN标准

用户已提供详细的脚本框架（${additionalInfoLength}字），请按照以下优先级生成：
1. **首要**：严格按照【补充要求】中的脚本框架、秒数、台词方向生成
2. **其次**：参考MCN标准中的格式要求（钩子、金句、秒数、镜头、波点等硬性格式）
3. **注意**：不要偏离用户提供的脚本思路
`
        : `
## 📋 生成策略

**优先级**：MCN标准 > 用户补充要求

用户补充要求较简单（${additionalInfoLength}字），请按照以下优先级生成：
1. **首要**：严格按照MCN标准中的脚本结构、钩子要求、爆款元素生成
2. **其次**：在符合标准的基础上，融入用户的补充要求
3. **注意**：发挥AI专业能力，创作高质量脚本
`;
      // ========== 智能判断结束 ==========
      const query = isAd ? `# 广告引流短视频脚本生成

${promptStrategy}

${priorityNote}
${fourStepWorkflow}
${executionContext}

⚠️ **重要提示**：这是一个广告引流类脚本，请使用广告公式和成交理由知识库，重点突出产品卖点和转化行动。

## 基础信息
- **广告类型**：${SCRIPT_TYPES[scriptType as keyof typeof SCRIPT_TYPES].label}
- **行业**：${selectedIndustry}
- **平台**：${platform}
- **时长**：${isAiDuration ? "由AI根据主题与平台智能判断（请在脚本开头标注建议时长）" : finalDuration}
- **主题/活动**：${topic}

${profileInfo}${positioningInfo}

${structureGuide}
${formulaSection}
${hookGuide}

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
✅ 性价比：开场"人均80块"、中段对比"比隔壁便宜30%"
✅ 品质保证：展示"现切羊肉"镜头、老板介绍"30年传承"
✅ 老板好：结尾"老板说报我名字打9折"

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
4. 结尾必须有明确的行动指令（到店/团购/加微信等）
5. 全程植入产品信息，自然不生硬
6. 突出价格优势和稀缺性（限时/限量）

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
- **时长**：${isAiDuration ? "由AI根据主题与平台智能判断（请在脚本开头标注建议时长）" : finalDuration}
- **主题**：${topic}

${profileInfo}${positioningInfo}

${structureGuide}
${formulaSection}
${hookGuide}

## 目标定位
- **目标受众**：${selectedTargetGroup}
- **内容风格**：${selectedStyle}

## 创意设计
- **开场钩子**：${HOOK_TYPES.find(h => h.id === hookType)?.label || "AI推荐"}（吸引目标受众停留）
- **脚本结构**：${SCRIPT_STRUCTURES.find(s => s.id === scriptStructure)?.label || "AI推荐"}
- **爆款元素**：${boomElements.length > 0 ? boomElements.map(id => BOOM_ELEMENTS.find(e => e.id === id)?.label).join("、") : "根据主题推荐"}

## 价值主张
${dealReasons.length > 0 ? `**核心价值点**：${dealReasonsText}

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
2. 开场要有悬念、反常识或情感共鸣
3. 中段提供干货价值，解决用户痛点
4. 结尾升华主题，引导互动（点赞/评论/关注）
5. 全程注重情感连接，建立信任
6. 避免硬广，自然输出价值

${formatRequirements}

请生成完整的内容创作脚本。`;

      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // taskType 必传：后端据此选择知识库检索的主题提示词、按任务隔离
        // Dify 会话记忆、并计入对应功能的用量。缺失时会兜底成"未知"，
        // 导致检索质量下降且各功能的记忆混在同一个会话里。
        // profileId 决定记忆按哪个账号档案隔离：不传则所有档案共用一段
        // 上下文，代运营多个账号时会把 A 号的内容串到 B 号的生成里。
        body: JSON.stringify({
          taskType: "脚本生成",
          profileId: selectedProfileId || null,
          query,
        }),
      });

      if (!response.ok) throw new Error("生成失败");

      // 统一走 readDifyStream：此处原本手写解析，decode(value) 未开 stream 模式，
      // 中文占 3 字节，一旦某个字被拆在两个数据块的边界上就会解码成乱码；
      // 且没有行缓冲，被截断的半行 JSON 会被整行丢弃，表现为内容偶发缺失。
      const accumulated = await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
      });
      fullResult += accumulated;

      if (fullResult.trim()) {
        const qualityEvaluation = evaluateScriptQualityStrict(fullResult);
        const qualityReport = `\n\n---\n\n${formatQualityReport(qualityEvaluation)}`;
        fullResult += qualityReport;
        setResult(fullResult);
      }
    } catch (error: any) {
      notify(error.message || "生成失败");
    } finally {
      setIsGenerating(false);
      
      // 保存生成历史记录
      if (fullResult && fullResult.length > 50) {
        setTimeout(async () => {
          try {            const inputData = {
              topic, scriptType, platform,
              duration: durationMode === "ai"
                ? "AI推荐"
                : durationMode === "custom" && customDuration
                  ? `${customDuration}秒`
                  : duration
            };
            await saveGenerationHistory("脚本生成", inputData, fullResult);            
            // 重新加载历史记录
            await loadScriptHistory();

            // 保存到scripts表
            try {
              const scriptData = {
                profile_id: selectedProfileId || null,
                positioning_id: selectedPositioningId || null,
                script_type: scriptType,
                duration: durationMode === "custom" && customDuration
                  ? parseInt(customDuration) || 60
                  : durationMode === "preset"
                    ? parseInt(duration) || 60
                    : 60,
                content_form: "口播",
                script_content: fullResult,
              };
              const scriptRes = await fetch("/api/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scriptData),
              });
              if (scriptRes.ok) {              }
            } catch (err) {
              console.error("保存脚本失败:", err);
            }
          } catch (err) {
            console.error("⚠️ 保存失败:", err);
          }
        }, 500);
      }
    }
  };



  return (
    // 容器透明，让全站的背景光晕透上来；面板各自用玻璃质感分层
    <div className="flex h-full">
      {/* Left Panel - Form */}
      {/* 加宽到 470：标签左置后要留出 88px 的标签列，按原先 420 的宽度，
          剩给控件的空间不足，两列的选项卡片会被挤扁 */}
      <div className="w-[470px] shrink-0 overflow-y-auto border-r border-border/60 px-6 py-7">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">脚本生成</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            专业级短视频脚本创作工具
          </p>
        </div>

        {/* Tab切换：分段控件。外层一个玻璃槽，选中项才有实体感，
            比两个按钮各自描边更干净，也不会出现双边框 */}
        <div className="glass-panel mb-6 flex gap-1 rounded-2xl p-1">
          <button
            onClick={() => {
              setActiveTab("content");
              setScriptType("teach");
            }}
            className={`flex-1 rounded-xl py-2.5 px-4 text-sm font-medium transition-all ${
              activeTab === "content"
                ? "btn-brand"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            }`}
          >
            📝 内容创作
          </button>
          <button
            onClick={() => {
              setActiveTab("ad");
              setScriptType("ad_lead");
            }}
            className={`flex-1 rounded-xl py-2.5 px-4 text-sm font-medium transition-all ${
              activeTab === "ad"
                ? "btn-brand"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            }`}
          >
            💰 广告引流
          </button>
        </div>


        <div className="space-y-4">
          {/* 智能关联 */}
          <CollapsibleSection title="智能关联" icon={Target} defaultOpen={true}>
            <Field label="账号档案" optional>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">不使用档案</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profile_name || `${profile.account_track?.[0] || '未命名'} - ${profile.account_stage || '新档案'}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="账号定位" optional>
              <select
                value={selectedPositioningId}
                onChange={(e) => setSelectedPositioningId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">不使用定位</option>
                {positionings.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.positioning_name || "未命名定位"}
                  </option>
                ))}
              </select>
            </Field>

            {(selectedProfileId || selectedPositioningId) && (
              <div className="rounded-xl bg-primary/10 px-3 py-2.5 text-[12px] text-primary">
                ✨ AI 将结合所选信息生成更精准的脚本
              </div>
            )}
          </CollapsibleSection>
          {/* 基础设置 */}
          <CollapsibleSection title="基础设置" icon={Settings} defaultOpen={true}>
            <Field label="脚本类型" required stacked>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(SCRIPT_TYPES)
                  .filter(([key]) => activeTab === "content" ? !key.startsWith("ad_") : key.startsWith("ad_"))
                  .map(([key, value]) => {
                    const style = SCRIPT_TYPE_STYLE[key] ?? { icon: FileText, accent: "primary" as const };
                    return (
                      <OptionCard
                        key={key}
                        icon={style.icon}
                        accent={style.accent}
                        title={value.label}
                        desc={value.desc}
                        selected={scriptType === key}
                        onClick={() => setScriptType(key)}
                      />
                    );
                  })}
              </div>
            </Field>

            {/* 从选题页带来的候选：点一条即填进主题框。
                选完就收起——它只是个过渡入口，留着会一直占地方 */}
            {handoffTopics.length > 0 && !topic && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.07] p-3">
                <p className="mb-2 text-[12px] text-primary">
                  来自{handoffFrom || "选题策划"}的 {handoffTopics.length} 条选题，挑一条
                </p>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {handoffTopics.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(t)}
                      className="glass-panel glass-interactive w-full rounded-lg px-3 py-2 text-left text-[12px] leading-relaxed text-foreground"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label="视频主题" required>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：普通人做短视频最容易踩的3个坑"
                className={TEXTAREA_CLS}
                rows={3}
              />
            </Field>

            <Field label="发布平台" required>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={SELECT_CLS}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="视频时长" required>
              <div>
                {/* 三种时长模式 Tab */}
                <div className="glass-panel mb-2 flex gap-0.5 rounded-xl p-1 text-[12px]">
                  {([
                    { id: "preset", label: "预设" },
                    { id: "custom", label: "自定义" },
                    { id: "ai",     label: "✨ AI推荐" },
                  ] as const).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDurationMode(m.id)}
                      className={`flex-1 rounded-lg py-1.5 font-medium transition-colors ${
                        durationMode === m.id
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* 预设下拉 */}
                {durationMode === "preset" && (
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={SELECT_CLS}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}

                {/* 自定义输入 */}
                {durationMode === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={5}
                      max={600}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder="输入秒数"
                      className={INPUT_CLS}
                    />
                    <span className="whitespace-nowrap text-[13px] text-muted-foreground">秒</span>
                  </div>
                )}

                {/* AI推荐提示 */}
                {durationMode === "ai" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] leading-snug text-primary">
                    ✨ AI 将根据主题、平台和内容复杂度自动判断最佳时长，并在脚本开头标注建议时长
                  </div>
                )}
              </div>
            </Field>

            {/* Smart Recommend Button */}
            <button
              onClick={handleSmartRecommend}
              className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10"
            >
              ✨ 根据平台智能推荐
            </button>

            <Field
              label="行业分类"
              required
              hint={(industry || customIndustry) ? `当前：${industry || customIndustry}` : undefined}
            >
              <div className="flex gap-2">
                <select
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    setCustomIndustry("");
                  }}
                  className={SELECT_CLS}
                >
                  <option value="">选择行业...</option>
                  {(activeTab === "content" ? CONTENT_INDUSTRIES : AD_INDUSTRIES).map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={customIndustry}
                  onChange={(e) => {
                    setCustomIndustry(e.target.value);
                    setIndustry("");
                  }}
                  placeholder="或自定义..."
                  className={INPUT_CLS}
                />
              </div>
            </Field>
          </CollapsibleSection>

          {/* 目标定位 */}
          <CollapsibleSection title="目标定位" icon={Target} defaultOpen={true}>
            <Field
              label="目标人群"
              optional
              hint={(targetGroup || customTargetGroup) ? `当前：${targetGroup || customTargetGroup}` : undefined}
            >
              <div className="flex gap-2">
                <select
                  value={targetGroup}
                  onChange={(e) => {
                    setTargetGroup(e.target.value);
                    setCustomTargetGroup("");
                  }}
                  className={SELECT_CLS}
                >
                  <option value="">选择目标人群...</option>
                  {TARGET_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={customTargetGroup}
                  onChange={(e) => {
                    setCustomTargetGroup(e.target.value);
                    setTargetGroup("");
                  }}
                  placeholder="或自定义..."
                  className={INPUT_CLS}
                />
              </div>
            </Field>

            <Field label="内容风格" optional>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    aria-pressed={style === s}
                    className={chipCls(style === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          {/* 创意设计 */}
          <CollapsibleSection title="创意设计" icon={Lightbulb} defaultOpen={true}>
            {/* 广告类专属：产品信息 */}
            {isAdScript() && (
              <>
                <Field label="产品信息" required>
                  <textarea
                    value={productInfo}
                    onChange={(e) => setProductInfo(e.target.value)}
                    placeholder="例如：店铺名称、主打产品、核心卖点、特色服务等..."
                    className={TEXTAREA_CLS}
                    rows={3}
                  />
                </Field>
                <Field label="价格信息" optional>
                  <input
                    type="text"
                    value={priceInfo}
                    onChange={(e) => setPriceInfo(e.target.value)}
                    placeholder="例如：人均50元、活动价99元..."
                    className={INPUT_CLS}
                  />
                </Field>
              </>
            )}

            <Field label="开场钩子" optional stacked>
              <div className="grid grid-cols-2 gap-2">
                {HOOK_TYPES.map((hook) => (
                  <button
                    key={hook.id}
                    onClick={() => setHookType(hook.id)}
                    aria-pressed={hookType === hook.id}
                    className={`glass-interactive rounded-xl border p-2.5 text-left ${
                      hookType === hook.id ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="mb-0.5 text-[15px] leading-none">{hook.label.split(' ')[0]}</div>
                    {/* 选中文字原先写死 text-accent，深色下几乎看不见 */}
                    <div className={`text-[11px] font-medium leading-snug ${
                      hookType === hook.id ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {hook.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="脚本结构" optional stacked>
              <div className="grid grid-cols-2 gap-2">
                {SCRIPT_STRUCTURES.map((structure) => (
                  <button
                    key={structure.id}
                    onClick={() => setScriptStructure(structure.id)}
                    aria-pressed={scriptStructure === structure.id}
                    className={`glass-interactive rounded-xl border p-2.5 text-left ${
                      scriptStructure === structure.id ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="mb-0.5 text-[15px] leading-none">{structure.label.split(' ')[0]}</div>
                    {/* 原先写死 text-orange-500，深色下几乎看不见 */}
                    <div className={`text-[11px] font-medium leading-snug ${
                      scriptStructure === structure.id ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {structure.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="爆款元素"
              optional
              stacked
              hint={
                boomElements.length > 0
                  ? `已选 ${boomElements.length} 个，建议 2–3 个`
                  : "可多选，建议 2–3 个"
              }
            >
              <div className="grid grid-cols-4 gap-1.5">
                {BOOM_ELEMENTS.map((elem) => (
                  <button
                    key={elem.id}
                    onClick={() => toggleBoomElement(elem.id)}
                    aria-pressed={boomElements.includes(elem.id)}
                    className={`glass-interactive rounded-xl border p-2 text-center ${
                      boomElements.includes(elem.id) ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="text-lg leading-none">{elem.label.split(' ')[0]}</div>
                    <div className={`mt-1 text-[11px] font-medium leading-none ${
                      boomElements.includes(elem.id) ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {elem.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          {/* 专业控制 */}
          <CollapsibleSection title="专业控制" icon={Film} defaultOpen={false}>
            <Field label="编导思路" optional stacked>
              <div className="space-y-1.5">
                {DIRECTOR_THOUGHTS.map((thought) => (
                  <label
                    key={thought.id}
                    className={`glass-interactive flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 ${
                      directorThoughts.includes(thought.id) ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={directorThoughts.includes(thought.id)}
                      onChange={() => toggleDirectorThought(thought.id)}
                      // accent-color 跟随主题，原先写死绿色与配色方案脱节
                      className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    />
                    <div className="flex-1">
                      <div className={`text-[13px] font-medium leading-5 ${
                        directorThoughts.includes(thought.id) ? "text-primary" : "text-foreground"
                      }`}>
                        {thought.label}
                      </div>
                      <div className="text-[11px] leading-snug text-muted-foreground">{thought.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            {/* 拍摄执行：四个字段用同一套 Field，与上方保持同一条对齐轴 */}
            <Field label="拍摄场景" optional>
              <select value={scene} onChange={(e) => setScene(e.target.value)} className={SELECT_CLS}>
                {SCENES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="拍摄设备" optional>
              <select value={device} onChange={(e) => setDevice(e.target.value)} className={SELECT_CLS}>
                {DEVICES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="预算范围" optional>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className={SELECT_CLS}>
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>

            <Field label="人员配置" optional>
              <div className="glass-panel inline-flex gap-0.5 rounded-xl p-1">
                {["一人", "两人", "多人"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPersonnel(p)}
                    aria-pressed={personnel === p}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      personnel === p
                        ? "bg-primary/20 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          {/* 成交理由（所有类型都有）*/}
          <CollapsibleSection title="成交理由" icon={Target} defaultOpen={isAdScript()}>
            <Field
              label="成交理由"
              optional
              stacked
              hint={
                dealReasons.length > 0
                  ? `已选 ${dealReasons.length} 个：${dealReasons.map(id => DEAL_REASONS.find(r => r.id === id)?.label.split(' ')[1]).join('、')}`
                  : "可多选，推荐 2–3 个"
              }
            >
              <div className="grid grid-cols-3 gap-1.5">
                {DEAL_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => toggleDealReason(reason.id)}
                    aria-pressed={dealReasons.includes(reason.id)}
                    className={`glass-interactive rounded-xl border p-2 text-left ${
                      dealReasons.includes(reason.id) ? "glass-selected" : "glass-panel"
                    }`}
                    title={reason.desc}
                  >
                    <div className="text-[12px] font-medium leading-5 text-foreground">{reason.label}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{reason.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>


          {/* 账号定位 */}
          <CollapsibleSection title="账号定位" icon={Target} defaultOpen={false}>
            <Field
              label="定位描述"
              optional
              hint="填写后生成的脚本会更贴合你的账号调性与目标受众"
            >
              <textarea
                value={accountPositioning}
                onChange={(e) => setAccountPositioning(e.target.value)}
                placeholder="例如：专注美食探店，主打平价高性价比，目标人群 18–35 岁年轻白领…"
                className={TEXTAREA_CLS}
                rows={4}
              />
            </Field>

            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
              <p className="mb-1.5 text-[12px] font-medium text-primary">写多少合适</p>
              <ul className="space-y-1 text-[11px] leading-relaxed text-foreground/75">
                <li>· 写得越详细（100 字以上），AI 越会按你的思路生成</li>
                <li>· 只写大方向（100 字以下），AI 会按 MCN 标准自由发挥</li>
                <li>· 建议只写核心诉求，把专业判断留给 AI</li>
              </ul>
            </div>
          </CollapsibleSection>

          {/* 补充说明 */}
          <CollapsibleSection title="补充说明" icon={FileText} defaultOpen={false}>
            <Field label="其他要求" optional>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="其他要求或特殊需求…"
                className={TEXTAREA_CLS}
                rows={3}
              />
            </Field>
          </CollapsibleSection>

          {/* Generate Button - 移动端固定在底部 */}
          <div className="md:static md:mt-0 sticky bottom-0 left-0 right-0 glass border-x-0 border-b-0 md:border-0 md:bg-transparent md:backdrop-blur-none p-4 md:p-0 -mx-5 md:mx-0 z-10">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="flex w-full items-center justify-center gap-2 btn-brand rounded-2xl py-4 font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  生成专业脚本
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Right Panel - Result */}
      <div className="flex-1 overflow-y-auto px-8 py-7">
        <div className="mx-auto max-w-4xl space-y-5">

        {/* 额度用尽提示条 */}
      {quotaExhausted && showQuotaBanner && (
        <div className="glass-panel border-destructive/30 bg-destructive/[0.06] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">脚本生成额度已用完</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                您当前使用的是 <span className="font-semibold">{planName}</span>，升级套餐解锁更多额度
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/membership">
              <Button size="sm" className="bg-destructive hover:opacity-90">
                立即升级
              </Button>
            </Link>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => {
                setShowQuotaBanner(false);
                localStorage.setItem('quota_banner_closed_time', Date.now().toString());
                console.log("✓ 用户关闭提示条，24小时内不再显示");
              }}
            >
              我知道了
            </Button>
          </div>
        </div>
      )}

      {/* 结果区在上、历史在下：原先历史卡片占着顶部，每次进页面先看到的
          是旧记录而不是刚生成的内容 */}
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        showQuality
        emptyIcon={Sparkles}
        emptyTitle="填写左侧需求后点击生成"
        emptyHint="AI 会结合编导知识库为你生成专业脚本"
        emptyTips={[
          "主题写得越具体，脚本越贴合",
          "选上账号档案，语气会更像你",
          "生成后可以直接拆分镜、审稿、起标题",
        ]}
        onCopy={(bodyOnly) => {
          navigator.clipboard.writeText(bodyOnly);
          notify("✅ 已复制到剪贴板");
        }}
        onDownload={(bodyOnly) => {
          const blob = new Blob([bodyOnly], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `脚本-${topic || "未命名"}-${new Date().toLocaleDateString()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        onContinue={result ? () => openContinuousDialog(result) : undefined}
        // 脚本写完通常还要走三步，内容直接带过去，不用复制粘贴
        nextActions={[
          {
            label: "拆分镜",
            icon: Film,
            onClick: (body) => {
              putHandoff({ from: "脚本生成", scriptContent: body });
              router.push("/dashboard/storyboard");
            },
          },
          {
            label: "审一遍",
            icon: CheckCircle,
            onClick: (body) => {
              putHandoff({ from: "脚本生成", scriptContent: body });
              router.push("/dashboard/review");
            },
          },
          {
            label: "起标题",
            icon: Tag,
            onClick: () => {
              putHandoff({ from: "脚本生成", topic });
              router.push("/dashboard/title");
            },
          },
        ]}
      />

      <HistoryPanel
        items={scriptHistory}
        title="历史脚本"
        showQuality
        activeId={activeHistoryId}
        onLoad={(item) => {
          // 点历史直接调回结果区查看。原先只能「继续对话」，
          // 想重看一条旧脚本没有任何入口
          setResult(item.result);
          setActiveHistoryId(item.id);
        }}
        onContinue={(item) => openContinuousDialog(item.result)}
        onDelete={(id) => {
          if (id === activeHistoryId) setActiveHistoryId(null);
          deleteHistory(id);
        }}
      />
        </div>
      </div>
      
      {/* 持续对话弹窗 */}
      <ContinuousDialog
        isOpen={showDialog}
        onClose={closeContinuousDialog}
        initialContent={dialogInitialContent}
        taskType="脚本生成"
      />

      {/* 额度提醒弹窗 */}
      {showQuotaReminder && quotaWarnings.length > 0 && (
        <QuotaReminder
          open={showQuotaReminder}
          onClose={() => {
            setShowQuotaReminder(false);
            // 记录本次会话已提醒过
            localStorage.setItem('quota_reminder_time', Date.now().toString());
            console.log("✓ 已记录提醒时间，24小时内不再提醒");
          }}
          warnings={quotaWarnings}
          planName={planName}
        />
      )}


    </div>
  );
}
