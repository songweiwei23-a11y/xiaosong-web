"use client";
import ContinuousDialog from "@/components/ContinuousDialog";
import { extractScriptContext } from "@/lib/positioning-utils";
import { getScriptDetails, getHookDetails } from "@/lib/script-details";
import { enhancePromptWithMCNStandards } from "@/lib/enhance-prompt";
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
import { evaluateScriptQualityStrict, formatQualityReport } from "@/lib/quality-checker";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Copy, Download, Loader2, ChevronDown, ChevronUp, Settings, Target, Lightbulb, Film, FileText, History, MessageCircle, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
import { CollapsibleSection } from "./CollapsibleSection";
import { useScriptHistory } from "./useScriptHistory";
import QuotaReminder from "@/components/quota-reminder";
import QuotaExhausted from "@/components/quota-exhausted";
import { supabase } from "@/lib/supabase/client";
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
  } = useScriptHistory();
  
  // 档案和定位关联
  const [profiles, setProfiles] = useState<any[]>([]);
  const [positionings, setPositionings] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPositioningId, setSelectedPositioningId] = useState("");

  // 额度提醒相关状态
  const [quotaWarnings, setQuotaWarnings] = useState<any[]>([]);
  const [showQuotaReminder, setShowQuotaReminder] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
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
        setQuotaExhausted(true);
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
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.answer) {
                accumulated += data.answer;
                fullResult += data.answer;
                setResult(accumulated);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

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
    <div className="flex h-screen">
      {/* Left Panel - Form */}
      <div className="w-[420px] overflow-y-auto border-r bg-muted/40 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">脚本生成</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            专业级短视频脚本创作工具
          </p>
        </div>

        {/* Tab切换 */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => {
              setActiveTab("content");
              setScriptType("teach");
            }}
            className={`flex-1 rounded-lg py-3 px-4 text-sm font-bold transition-all ${
              activeTab === "content"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                : "bg-card border-2 border-border text-muted-foreground hover:border-blue-300"
            }`}
          >
            📝 内容创作
          </button>
          <button
            onClick={() => {
              setActiveTab("ad");
              setScriptType("ad_lead");
            }}
            className={`flex-1 rounded-lg py-3 px-4 text-sm font-bold transition-all ${
              activeTab === "ad"
                ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                : "bg-card border-2 border-border text-muted-foreground hover:border-red-300"
            }`}
          >
            💰 广告引流
          </button>
        </div>


        <div className="space-y-4">
          {/* 智能关联 */}
          <CollapsibleSection title="智能关联" icon={Target} defaultOpen={true}>
            <div className="space-y-3">
              {/* 档案选择 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  👤 选择档案（可选）
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">不使用档案</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.profile_name || `${profile.account_track?.[0] || '未命名'} - ${profile.account_stage || '新档案'}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 定位选择 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  🎯 选择定位（可选）
                </label>
                <select
                  value={selectedPositioningId}
                  onChange={(e) => setSelectedPositioningId(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">不使用定位</option>
                  {positionings.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.positioning_name || "未命名定位"}
                    </option>
                  ))}
                </select>
              </div>

              {(selectedProfileId || selectedPositioningId) && (
                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                  ✨ AI将结合您选择的信息生成更精准的脚本
                </div>
              )}
            </div>
          </CollapsibleSection>
          {/* 基础设置 */}
          <CollapsibleSection title="基础设置" icon={Settings} defaultOpen={true}>
            {/* Script Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                脚本类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SCRIPT_TYPES)
                  .filter(([key]) => activeTab === "content" ? !key.startsWith("ad_") : key.startsWith("ad_"))
                  .map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setScriptType(key)}
                    className={`rounded-lg border p-3 text-left text-sm transition-all ${
                      scriptType === key
                        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 shadow-md"
                        : "border-border bg-card hover:border-border hover:shadow-sm"
                    }`}
                  >
                    <div className="font-medium">{value.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{value.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                视频主题 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：普通人做短视频最容易踩的3个坑"
                className="w-full rounded-lg border border-border p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                rows={3}
              />
            </div>

            {/* Platform & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  发布平台
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  视频时长
                </label>
                {/* 三种时长模式 Tab */}
                <div className="flex rounded-lg overflow-hidden border border-border text-xs mb-2">
                  {([
                    { id: "preset", label: "预设" },
                    { id: "custom", label: "自定义" },
                    { id: "ai",     label: "✨ AI推荐" },
                  ] as const).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDurationMode(m.id)}
                      className={`flex-1 py-1.5 font-medium transition-colors ${
                        durationMode === m.id
                          ? "bg-blue-500 text-white"
                          : "bg-background text-muted-foreground hover:bg-muted"
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
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}

                {/* 自定义输入 */}
                {durationMode === "custom" && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={5}
                      max={600}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder="输入秒数"
                      className="w-full rounded-lg border border-border bg-background p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">秒</span>
                  </div>
                )}

                {/* AI推荐提示 */}
                {durationMode === "ai" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-2 text-xs text-blue-700 dark:text-blue-300">
                    ✨ AI 将根据主题、平台和内容复杂度自动判断最佳时长，并在脚本开头标注建议时长
                  </div>
                )}
              </div>
            </div>

            {/* Smart Recommend Button */}
            <button
              onClick={handleSmartRecommend}
              className="w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              ✨ 根据平台智能推荐
            </button>

            {/* 行业分类 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                行业分类 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    setCustomIndustry("");
                  }}
                  className="flex-1 rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
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
                  className="flex-1 rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {(industry || customIndustry) && (
                <p className="mt-1 text-xs text-blue-600">✅ 当前：{industry || customIndustry}</p>
              )}
            </div>
          </CollapsibleSection>

          {/* 目标定位 */}
          <CollapsibleSection title="目标定位" icon={Target} defaultOpen={true}>
            {/* Target Group */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                目标人群
              </label>
              <div className="flex gap-2">
                <select
                  value={targetGroup}
                  onChange={(e) => {
                    setTargetGroup(e.target.value);
                    setCustomTargetGroup("");
                  }}
                  className="flex-1 rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
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
                  className="flex-1 rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {(targetGroup || customTargetGroup) && (
                <p className="mt-1 text-xs text-blue-600">✅ 当前：{targetGroup || customTargetGroup}</p>
              )}
            </div>

            {/* Style */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                内容风格
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`rounded-full border px-3 py-1 text-xs transition-all ${
                      style === s
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                        : "border-border hover:border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* 创意设计 */}
          <CollapsibleSection title="创意设计" icon={Lightbulb} defaultOpen={true}>
            {/* 广告类专属：产品信息 */}
            {isAdScript() && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    产品/店铺信息 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={productInfo}
                    onChange={(e) => setProductInfo(e.target.value)}
                    placeholder="例如：店铺名称、主打产品、核心卖点、特色服务等..."
                    className="w-full rounded-lg border border-border p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    价格信息
                  </label>
                  <input
                    type="text"
                    value={priceInfo}
                    onChange={(e) => setPriceInfo(e.target.value)}
                    placeholder="例如：人均50元、活动价99元、原价199现价99..."
                    className="w-full rounded-lg border border-border p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* 开场钩子 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                开场钩子
              </label>
              <div className="grid grid-cols-2 gap-2">
                {HOOK_TYPES.map((hook) => (
                  <button
                    key={hook.id}
                    onClick={() => setHookType(hook.id)}
                    className={`rounded-lg border-2 p-2 text-left transition-all ${
                      hookType === hook.id
                        ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm"
                        : "border-border bg-card hover:border-purple-300"
                    }`}
                  >
                    <div className="text-base mb-0.5">{hook.label.split(' ')[0]}</div>
                    <div className={`text-xs font-bold ${
                      hookType === hook.id ? "text-purple-700" : "text-muted-foreground"
                    }`}>
                      {hook.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 脚本结构 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                脚本结构
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SCRIPT_STRUCTURES.map((structure) => (
                  <button
                    key={structure.id}
                    onClick={() => setScriptStructure(structure.id)}
                    className={`rounded-lg border-2 p-2 text-left transition-all ${
                      scriptStructure === structure.id
                        ? "border-orange-500 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-sm"
                        : "border-border bg-card hover:border-orange-300"
                    }`}
                  >
                    <div className="text-base mb-0.5">{structure.label.split(' ')[0]}</div>
                    <div className={`text-xs font-bold ${
                      scriptStructure === structure.id ? "text-orange-700" : "text-muted-foreground"
                    }`}>
                      {structure.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 八大爆款元素 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                爆款元素 <span className="text-xs text-muted-foreground">（可多选）</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BOOM_ELEMENTS.map((elem) => (
                  <button
                    key={elem.id}
                    onClick={() => toggleBoomElement(elem.id)}
                    className={`rounded-lg border-2 p-2 text-center transition-all ${
                      boomElements.includes(elem.id)
                        ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm scale-105"
                        : "border-border bg-card hover:border-blue-300"
                    }`}
                  >
                    <div className="text-xl">{elem.label.split(' ')[0]}</div>
                    <div className={`text-xs font-bold mt-1 ${
                      boomElements.includes(elem.id) ? "text-blue-700" : "text-muted-foreground"
                    }`}>
                      {elem.label.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
              {boomElements.length > 0 && (
                <p className="mt-2 text-xs text-blue-600">
                  ✅ 已选择 {boomElements.length} 个元素
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* 专业控制 */}
          <CollapsibleSection title="专业控制" icon={Film} defaultOpen={false}>
            {/* 编导思路 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                编导思路
              </label>
              <div className="space-y-2">
                {DIRECTOR_THOUGHTS.map((thought) => (
                  <label
                    key={thought.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-2 transition-all ${
                      directorThoughts.includes(thought.id)
                        ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50"
                        : "border-border bg-card hover:border-green-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={directorThoughts.includes(thought.id)}
                      onChange={() => toggleDirectorThought(thought.id)}
                      className="mt-0.5 accent-green-600"
                    />
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${
                        directorThoughts.includes(thought.id) ? "text-green-700" : "text-foreground"
                      }`}>
                        {thought.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{thought.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 拍摄执行 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  拍摄场景
                </label>
                <select
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full rounded border border-border p-1.5 text-xs"
                >
                  {SCENES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  拍摄设备
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className="w-full rounded border border-border p-1.5 text-xs"
                >
                  {DEVICES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  预算范围
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full rounded border border-border p-1.5 text-xs"
                >
                  {BUDGETS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  人员配置
                </label>
                <div className="flex gap-1">
                  {["一人", "两人", "多人"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPersonnel(p)}
                      className={`flex-1 rounded border py-1 text-xs ${
                        personnel === p
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-border"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 成交理由（所有类型都有）*/}
          <CollapsibleSection title="成交理由" icon={Target} defaultOpen={isAdScript()}>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                选择成交理由 <span className="text-xs text-muted-foreground">（可多选，推荐2-3个）</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DEAL_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => toggleDealReason(reason.id)}
                    className={`rounded-lg border-2 p-2 text-left text-xs transition-all ${
                      dealReasons.includes(reason.id)
                        ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm scale-105"
                        : "border-border bg-card hover:border-green-300"
                    }`}
                    title={reason.desc}
                  >
                    <div className="font-bold">{reason.label}</div>
                    <div className="mt-1 text-muted-foreground">{reason.desc}</div>
                  </button>
                ))}
              </div>
              {dealReasons.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  ✅ 已选 {dealReasons.length} 个：{dealReasons.map(id => DEAL_REASONS.find(r => r.id === id)?.label.split(' ')[1]).join('、')}
                </p>
              )}
            </div>
          </CollapsibleSection>


          {/* 账号定位 */}
          <CollapsibleSection title="账号定位" icon={Target} defaultOpen={false}>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                描述你的账号定位、特色、目标
              </label>
              <textarea
                value={accountPositioning}
                onChange={(e) => setAccountPositioning(e.target.value)}
                placeholder="例如：我是一个专注于美食探店的账号，主打性价比高的平价美食，目标人群是18-35岁的年轻白领..."
                className="w-full rounded-lg border border-border p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                rows={4}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                💡 填写后，生成的脚本会更符合你的账号调性和目标受众
              </p>
            <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">💡</span>
                <div className="flex-1 text-sm text-blue-800">
                  <p className="font-medium mb-1">智能提示：</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>写得越详细</strong>（100字以上），AI越会按你的思路生成</li>
                    <li>• <strong>只写大方向</strong>（100字以下），AI会按MCN标准自由发挥</li>
                    <li>• <strong>建议</strong>：只写核心诉求，让AI发挥专业能力</li>
                  </ul>
                </div>
              </div>
            </div>
            </div>
          </CollapsibleSection>

          {/* 补充说明 */}
          <CollapsibleSection title="补充说明" icon={FileText} defaultOpen={false}>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="其他要求或特殊需求..."
              className="w-full rounded-lg border border-border p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              rows={3}
            />
          </CollapsibleSection>

          {/* Generate Button - 移动端固定在底部 */}
          <div className="md:static md:mt-0 sticky bottom-0 left-0 right-0 bg-card border-t border-border md:border-0 p-4 md:p-0 -mx-8 md:mx-0 z-10">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 font-bold text-white shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none transition-all"
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
      <div className="flex-1 overflow-y-auto p-8 bg-card">
        <div className="mx-auto max-w-4xl">

        {/* 历史记录 */}
        {scriptHistory.length > 0 && (
          <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-foreground">历史脚本记录</h3>
              <span className="text-sm text-muted-foreground">({scriptHistory.length})</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {scriptHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted rounded-lg border border-border hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">
                        {item.result.replace(/[#*`>\-|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80)}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button aria-label="继续对话"
                        onClick={() => openContinuousDialog(item.result)}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                        title="继续对话"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button><button aria-label="删除历史记录"
                        onClick={() => deleteHistory(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

          {!result && !isGenerating && (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <Sparkles className="mx-auto h-16 w-16 text-muted-foreground" />
                <p className="mt-6 text-lg font-medium text-muted-foreground">
                  填写左侧需求后点击生成按钮
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI将结合编导知识库为你生成专业脚本
                </p>
              </div>
            </div>
          )}

          {(result || isGenerating) && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">生成结果</h2>
                {result && (
                  <div className="flex gap-2">
                    <button aria-label="复制脚本到剪贴板" onClick={() => { navigator.clipboard.writeText(result); notify("✅ 已复制到剪贴板"); }} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted shadow-sm transition-colors">
                      <Copy className="h-4 w-4" />
                      复制
                    </button>
                    <button aria-label="下载脚本文件" onClick={() => { const blob = new Blob([result], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `脚本-${topic || "未命名"}-${new Date().toLocaleDateString()}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted shadow-sm transition-colors">
                      <Download className="h-4 w-4" />
                      下载
                    </button>
                  </div>
                )}
              </div>

              {isGenerating && !result && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                    <p className="mt-4 text-sm text-muted-foreground">AI正在创作中...</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
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
          onClose={() => setShowQuotaReminder(false)}
          warnings={quotaWarnings}
          planName={planName}
        />
      )}

      {/* 额度用尽页面覆盖层 */}
      {quotaExhausted && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <QuotaExhausted planName={planName} feature="脚本生成" />
        </div>
      )}
    </div>
  );
}




















