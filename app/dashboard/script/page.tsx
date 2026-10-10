"use client";
import type { HandoffPayload } from '@/lib/handoff';
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { cleanTitle, resolveCreationSettings, mergeCreationSettings, settingsForResult, creationSettingsBlock, durationSeconds, scriptReasonIds, normalizeCreationReasons } from '@/lib/creation-settings';

import ContinuousDialog from "@/components/ContinuousDialog";
import { useRouter } from "next/navigation";
import { extractScriptContext } from "@/lib/positioning-utils";
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { buildContextBlock } from "@/lib/creator-context";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { getScriptDetails, getHookDetails } from "@/lib/script-details";
import { buildAdaptiveScriptPrompt } from "@/lib/script-design";
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
import { PRIORITY_ORDER } from "@/lib/output-rules";

import { useState, useEffect, useRef } from "react";
// 复制/下载/历史相关的图标已随结果区一起移入 ResultPanel 与 HistoryPanel
import { Sparkles, Loader2, Settings, Target, Lightbulb, Film, FileText, BookOpen, Clapperboard, MessageSquare, Feather, UserPlus, Ticket, Store, Package, CheckCircle, Tag, Copy } from "lucide-react";
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
import { ContextBadge } from "@/components/workspace/ContextBadge";
import { takeHandoff, extractOpening } from "@/lib/handoff";
import { openCreationSafely } from "@/lib/creation-session";
import { buildCreationHandoff } from "@/lib/creation-flow";
import { originForResult, continuationRules } from '@/lib/creation-continuation';
import { extractPlainCopy } from "@/lib/script-copy";
import { GROWTH_TACTICS } from "@/lib/growth-tactics";
import { tacticBrief, tacticsBlockedBy } from "@/lib/growth-standards";
import { AUTO_TACTIC, ROUTES_GUIDE, tacticIndex, tacticInText } from "@/lib/creative-routes";
import { AI_LENGTH_RULE, EXAMPLE_LENGTH_NOTE } from "@/lib/ai-recommend";
import { CONTENT_ROLE_LIST, ROLE_SPECS, roleBrief, defaultRoleOfScriptType, type ContentRole } from "@/lib/content-roles";
import { throwApiError, fetchGeneration } from "@/lib/api-error";
import { openUpgrade } from "@/lib/upgrade";
import { createWork, recordStage } from "@/lib/works";
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import { useWorkResume } from "@/hooks/useWorkResume";
import { latestOf, workIdFromUrl } from "@/lib/resume";
import { Field, OptionCard } from "@/components/form/Field";
import { postSafely } from '@/lib/safe-post';

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
  const beginProfileRequest = useProfileRequestGuard();
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  const [scriptType, setScriptType] = useState("teach");
  const [scriptTypePicked, setScriptTypePicked] = useState(false);
  /*
   * 这条视频的目的。原来脚本页只有"脚本类型"，结尾一律"引导互动（点赞/评论/关注）"，
   * 广告类一律"到店/团购/加微信等"——指令一堆、和目的无关。SOP 的铁律是
   * 目的决定结构和结尾指令、结尾只要一个。"自动"按脚本类型给默认值，用户可改。
   */
  const [scriptRole, setScriptRole] = useState<'自动' | ContentRole>('自动');
  // 广告四类本来就是变现型
  const effectiveRole: ContentRole = scriptRole !== '自动' ? scriptRole
    : scriptType.startsWith('ad_') ? '变现型' : defaultRoleOfScriptType(scriptType);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [customDuration, setCustomDuration] = useState("");
  // 时长模式：preset=预设选择 / custom=自定义秒数 / ai=AI推荐（由Dify判断）
  // 默认「AI 推荐」：编导没选，就按内容需要给最好的结果，不先框一个 60 秒（2026-10-06 产品方）
  const [durationMode, setDurationMode] = useState<"preset" | "custom" | "ai">("ai");
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
    resultScope,
    lastItem,
  } = useScriptHistory();

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult, resultScope, () => { setWorkId(null); setWorkTitle(""); setTopic(""); setOriginContent(''); handedOffRef.current = false; });

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
  const [originContent, setOriginContent] = useState('');

  /**
   * 当前脚本属于哪个作品。
   * 从选题页带过来时已经有了；直接进本页生成时，生成完才建（见 handleGenerate）——
   * 进页面就建会攒下一堆用户其实没生成任何东西的空作品。
   */
  const [workId, setWorkId] = useState<string | null>(null);
  /**
   * 打开作品时实际承接的主题。作品名可能带“方案2”前缀，不能拿显示标题判断是否换题：
   * 打开作品 A 之后把主题改成别的，那已经是另一条内容，不该再记到 A 上。
   */
  const [workTitle, setWorkTitle] = useState("");
  /** 这次是不是从别的板块带着内容跳过来的。是的话，别拿"上次那条"去覆盖 */
  const handedOffRef = useRef(false);
  /**
   * 这条脚本用的起号计。从选题页或起号页带过来，也可以在本页改。
   * 会写进历史记录，复盘按它统计「这一计测了几条」。
   */
  // 默认让 AI 按这条的目的挑一计叠上——原来默认"不指定"，36 计在脚本里几乎从不出现
  const [tactic, setTactic] = useState(AUTO_TACTIC);
  /** 选题页"两种都出"时每条各自的计：挑中哪条就带上哪条的 */
  const [handoffTopicTactics, setHandoffTopicTactics] = useState<Record<string, string>>({});
  /**
   * 开篇页选定的那句开头，以及它用的卡。
   * 有它时脚本的第一句被锁死——用户已经在开篇页横向比过一轮挑出来了，
   * 再让模型自由发挥一个开头，等于把他刚做的决定扔掉。
   */
  const [openingLine, setOpeningLine] = useState("");
  const [openingCard, setOpeningCard] = useState("");

  useEffect(() => {
    const data = takeHandoff();
    if (data) setIncomingSetup(data);
    if (!data) return;
    setOriginContent(data.originContent || data.sourceContent || '');
    handedOffRef.current = true;
    setHandoffFrom(data.from || "");
    const carriedTopic = cleanTitle(data.settings?.topic || data.topic || '');
    if (carriedTopic) setTopic(carriedTopic);
    if (data.topicOptions?.length) setHandoffTopics(data.topicOptions);
    if (data.note) setAdditionalInfo(data.note);
    if (data.workId) {
      setWorkId(data.workId);
      setWorkTitle(carriedTopic);
    }
    // 选题页/起号页带过来的拍法
    if (data.tactic) setTactic(data.tactic);
    if (data.topicTactics) setHandoffTopicTactics(data.topicTactics);
    // 开篇页选定的那句开头
    if (data.openingLine) setOpeningLine(data.openingLine);
    if (data.openingCards?.length) setOpeningCard(data.openingCards[0]);
  }, []);

  /*
   * 从「进行中」「我的作品」或选题清单打开某个作品（地址带 ?work=）：
   * 选题填进主题框，有写过的脚本就把最新一版调出来，打法也接上。
   * 隔多久打开都一样——内容是从云端现取的，不靠一次性的交接。
   */
  useWorkResume((work, setup) => {
    setIncomingSetup(setup);
    setOriginContent(setup.originContent || '');
    if (setup.note) setAdditionalInfo(setup.note);
    setWorkId(work.id);
    const carriedTopic = cleanTitle(setup.settings?.topic || setup.topic || work.title);
    setWorkTitle(carriedTopic);
    setTopic(carriedTopic);
    setHandoffFrom("创作进度");
    const last = latestOf(work, "脚本生成");
    if (last) {
      setResult(last.result);
      setActiveHistoryId(last.id);
      const t = last.input_data?.tactic;
      if (typeof t === "string" && t) setTactic((cur) => (cur && cur !== AUTO_TACTIC ? cur : t));
    }
  });

  /*
   * 恢复上次那条脚本时，连它属于哪个作品一起接上。
   * 不接的话，页面上看着是作品 A 的脚本，再点生成却会新建一个同名作品。
   * 带着内容跳过来的、或者地址指定了作品的，都以那边为准，这里不插手。
   */
  useEffect(() => {
    if (!lastItem || handedOffRef.current || workIdFromUrl()) return;
    const input = lastItem.input_data && typeof lastItem.input_data === "object" ? lastItem.input_data : {};
    if (lastItem.work_id) {
      setWorkId((cur) => cur || lastItem.work_id);
      setWorkTitle((cur) => cur || input.topic || "");
    }
    if (typeof input.topic === "string") setTopic((cur) => cur || input.topic);
  }, [lastItem]);

  // 创作简报从这里来。之前这一页漏了 brief，脚本最吃的
  // 「人设与口吻」「凭什么信你」「记忆点」一个都没进提示词
  const { context: creatorContext, loading: contextLoading } = useCreatorContext();

  const autoSetup = useAutoCreationSetup(incomingSetup, creatorContext, contextLoading, s => {
    // 只填原内容写明的和档案里有的；没写的保持页面默认（目的「自动」、结构和钩子「auto」），不猜（2026-10-03）
    if (s.topic) setTopic(s.topic);
    if (s.scriptType) { setScriptType(s.scriptType); setActiveTab(s.scriptType.startsWith('ad_') ? 'ad' : 'content'); }
    setScriptRole(s.purpose ?? '自动'); setPlatform(s.platform!); setScriptStructure(s.structure ?? 'auto'); setHookType(s.hookType ?? 'auto');
    // 原内容写明了时长才照填；没写就是「AI 推荐」，不替编导定 60 秒（2026-10-06）
    if (!s.duration) setDurationMode('ai');
    else if (DURATIONS.includes(s.duration)) { setDuration(s.duration); setDurationMode('preset'); }
    else { setDurationMode('custom'); setCustomDuration(String(durationSeconds(s.duration))); }
    const audience = s.audience ?? '';
    setTargetGroup(TARGET_GROUPS.includes(audience) ? audience : '');
    setCustomTargetGroup(TARGET_GROUPS.includes(audience) ? '' : audience);
    if (s.style) { setStyle(STYLES.includes(s.style) ? s.style : ''); setCustomStyle(STYLES.includes(s.style) ? '' : s.style); }
    setIndustry(s.industry ?? ''); setCustomIndustry(s.industry ?? '');
    setBoomElements((s.elements || []).map(id => id === 'people' ? 'crowd' : id).filter(id => BOOM_ELEMENTS.some(e => e.id === id)));
    if (s.scene) setScene(s.scene); if (s.device) setDevice(s.device); if (s.budget) setBudget(s.budget); if (s.personnel) setPersonnel(s.personnel);
    if (s.tactic) setTactic(s.tactic); if (s.openingLine) setOpeningLine(s.openingLine);
    setOpeningCard(s.openingCards?.[0] || '');
    setDealReasons(scriptReasonIds(s.dealReasons || []));
  });
  const autoScriptType = Boolean(!autoSetup.settings.scriptType && !scriptTypePicked);
  const currentSettings = resolveCreationSettings({ from: '脚本生成', sourceContent: originContent || topic, settings: mergeCreationSettings(autoSetup.settings, {
    topic, platform, duration: durationMode === 'custom' && customDuration ? customDuration + '秒' : durationMode === 'ai' ? 'AI推荐' : duration,
    scriptType: autoScriptType ? undefined : scriptType, purpose: scriptRole === '自动' ? autoSetup.settings.purpose : effectiveRole, structure: scriptStructure, hookType, style: customStyle || style, audience: customTargetGroup || targetGroup,
    industry: customIndustry || industry, elements: boomElements.map(id => id === 'crowd' ? 'people' : id),
    dealReasons: normalizeCreationReasons([...autoSetup.settings.dealReasons || [], ...dealReasons]), notes: incomingSetup ? autoSetup.settings.notes : additionalInfo,
    tactic: tactic === AUTO_TACTIC ? undefined : tactic, openingLine, openingCards: openingCard ? [openingCard] : [], scene, device, budget, personnel,
  }) }, creatorContext);

  // 档案和定位关联
  const [profiles, setProfiles] = useState<any[]>([]);
  const [positionings, setPositionings] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPositioningId, setSelectedPositioningId] = useState("");

  // 额度快用完 / 用完的提醒改由全站统一的付费引导负责（lib/upgrade + 工作台框架里的 UpgradePrompt）。
  // 这一页原来单独有一套：进页面就查、"任何一个功能用完"都说成"脚本额度用完了"。


  // 加载档案和定位
  useEffect(() => {
    loadProfiles();
    loadPositionings();
    // 侧边栏切档案时跟着换，不用刷新页面
    return onActiveProfileChange(() => {
      const id = getActiveProfileId();
      if (id) setSelectedProfileId(id);
    });
  }, []);

  const loadProfiles = async () => {
    console.log("🔍 开始加载档案...");
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
        // 跟侧边栏选的是同一个档案，不用在这儿再选一遍
        const active = getActiveProfileId();
        if (active && Array.isArray(data) && data.some((p: any) => p.id === active)) {
          setSelectedProfileId((cur) => cur || active);
        }
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

  /*
   * 智能推荐：时长交给 AI 按内容定（原来按平台写死：抖音 60 秒、快手 30 秒——"智能推荐"反而把上限框死了），
   * 风格按平台给个常用的起点
   */
  const handleSmartRecommend = () => {
    setDurationMode("ai");
    const styleByPlatform: Record<string, string> = { 抖音: "幽默", 小红书: "干货", 视频号: "温情", 快手: "接地气", B站: "专业" };
    if (styleByPlatform[platform]) setStyle(styleByPlatform[platform]);
    notify("✅ 时长交给 AI 按内容定，风格已按平台推荐");
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (autoSetup.preparing || contextLoading) { notify("正在承接原方案，请稍候"); return; }
    if (!resultScope) { notify("档案正在加载，请稍后再试"); return; }
    const isCurrent = beginProfileRequest();
    // 0. 检查配额
    setIsGenerating(true);
    const remainingQuota = await checkQuota("script");
    if (!isCurrent()) { setIsGenerating(false); return; }
    if (remainingQuota !== null && remainingQuota <= 0) {
      openUpgrade("script");
      setIsGenerating(false);
      return;
    }

    // 1. 检查主题是否填写
    if (!topic.trim()) {
      setIsGenerating(false);
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

      // 这里原本只传 6 个字段：名称、平台、赛道、阶段、粉丝量级、风格。
      // 写脚本真正要的东西一个都没在里面——说话语气、核心卖点、用户痛点、
      // 已验证的开场钩子，以及「绝对不能说：最好、第一、全网最便宜」。
      // 最后一条是硬禁忌，漏掉它模型就会照常写出违规文案。
      /*
       * brief 必须带上。之前这里漏了它，实测脚本注入 2299 字却只有
       * 1/7 的简报字段到位——「人设与口吻」「凭什么信你」「记忆点」
       * 这些脚本最吃的东西全都没进来，塞的反而是截断的定位原文。
       */
      if (selectedProfileId) {
        const profile = profiles.find(p => p.id === selectedProfileId);
        if (profile) {
          profileInfo = "\n\n" + buildContextBlock(
            { profile: profile, positioning: null, dealReasons: [], brief: creatorContext.brief },
            'script'
          );
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
        role: effectiveRole,
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
      // AI 推荐时不拿 60 秒去挑范例：范例多长，模型就照着写多长（范例只学节奏和标注，这里给它不按时长挑的那份）
      const durationForCalc = isAiDuration ? "" : finalDuration;
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
      const profileForBlock = selectedProfileId ? profiles.find((p) => p.id === selectedProfileId) : null;
      const blockedTactics = tacticsBlockedBy(
        [profileForBlock?.content_restrictions, profileForBlock?.avoid_content].filter(Boolean).join('\n')
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
  ? `时长不限，以效果最好为准：${AI_LENGTH_RULE}。不需要标注时长，据此完整输出可直接拍摄的脚本`
  : `按${finalDuration}完整输出可直接拍摄的脚本`}
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
        source: [originContent, autoSetup.settings.focusContent].filter(Boolean).join('\n\n'),
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

      const response = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // taskType 必传：后端据此选择知识库检索的主题提示词、按任务隔离
        // Dify 会话记忆、并计入对应功能的用量。缺失时会兜底成"未知"，
        // 导致检索质量下降且各功能的记忆混在同一个会话里。
        // profileId 决定记忆按哪个账号档案隔离：不传则所有档案共用一段
        // 上下文，代运营多个账号时会把 A 号的内容串到 B 号的生成里。
        body: JSON.stringify({
          taskType: "脚本生成",
          creationSettings: currentSettings,
          profileId: selectedProfileId || null,
          query: query + creationSettingsBlock(currentSettings) + (originContent ? continuationRules('script') : '') + (incomingSetup && scriptRole === '自动' ? '\n【自动目的的执行原则】前文按脚本类型推荐的目的、结构、结尾只是候选，不能据此修改原始用户想法。先从完整原意确定本条目的与行动指令；混合目的完整保留，不强行归成单一类型。不因页面默认、商业档案或广告模板把大众流量/人设内容改成获客促销。' : '') + (autoScriptType ? '\n【本轮脚本类型自动决策（覆盖前文候选模板）】用户没有选择脚本类型，页面教知识模板及其教学步骤、示例只供参考，不是用户指令。先判断这次带来的内容究竟是观点讨论、过程展示、真实故事还是知识教学，选最贴合原意的一种并标注实际类型。讨论类选聊话题，不能硬写成教知识教程、创业指南或广告。根据原意确定结构、结尾与开篇，不强行套前文的教知识公式。' : ''),
        }),
      });

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) await throwApiError(response);

      // 统一走 readDifyStream：此处原本手写解析，decode(value) 未开 stream 模式，
      // 中文占 3 字节，一旦某个字被拆在两个数据块的边界上就会解码成乱码；
      // 且没有行缓冲，被截断的半行 JSON 会被整行丢弃，表现为内容偶发缺失。
      const accumulated = await readDifyStream(response, {
        onChunk: (_piece, full) => { if (isCurrent()) setResult(full); },
      });
      fullResult += accumulated;

      if (fullResult.trim()) {
        const qualityEvaluation = evaluateScriptQualityStrict(fullResult, { adaptive: true });
        const qualityReport = `\n\n---\n\n${formatQualityReport(qualityEvaluation)}`;
        fullResult += qualityReport;
        setResult(fullResult);
      }
    } catch (error: any) {
      notify(error.message || "生成失败");
    } finally {
      setIsGenerating(false);
      
      // 保存生成历史记录
      // 只要有内容就存。原来的门槛是 50 字，模型返回得短一点
      // （比如只给了几个标题、或者一句拒答）就什么都不留——
      // 而额度已经在服务端扣掉了，用户刷新后一无所获，还以为系统吞了。
      if (fullResult && fullResult.trim().length > 0) {
        setTimeout(async () => {
          try {            const inputData = {
              profileId: selectedProfileId || null,
              topic, scriptType: autoScriptType ? undefined : scriptType, platform,
              creationSettings: currentSettings,
              additionalInfo,
              originContent,
              duration: durationMode === "ai"
                ? "AI推荐"
                : durationMode === "custom" && customDuration
                  ? `${customDuration}秒`
                  : duration,
              // 复盘要按打法数样本：知识库的测试规则是「每种打法至少测 3-5 条」，
              // 不记这一条，那条规则就永远只是纸上的
              // 让 AI 挑的，记它实际挑中的那一计（策略卡里写着），不记"AI 挑"这个占位
              tactic: (tactic === AUTO_TACTIC ? tacticInText(fullResult) : tactic) || undefined,
            };
            // 归到作品下。从选题带过来时已有作品，直接进本页的则在这里建——
            // 等生成完再建，才不会攒下一堆用户其实没写出东西的空作品。
            let currentWork = workId;
            // 打开作品 A 之后把主题改成了别的——那是另一条内容，不能记到 A 上
            if (currentWork && workTitle && topic.trim() && topic.trim() !== workTitle.trim()) {
              currentWork = null;
            }
            if (!currentWork) {
              // 同题的进行中作品服务端会直接复用，不会再建出一个同名的
              currentWork = await createWork(topic || "未命名脚本", selectedProfileId || null);
              if (currentWork) {
                setWorkId(currentWork);
                setWorkTitle(topic || "");
              }
            }

            await saveGenerationHistory("脚本生成", inputData, fullResult, currentWork);
            // 登记到作品。必须排在保存之后——recordStage 要读这条作品已有的
            // 环节才能判断是不是刚补上最后一块。
            await recordStage(currentWork, "脚本生成");
            // 新建/换题后刷新也应恢复刚保存的作品，不能仍指向地址中的旧作品。
            if (currentWork && workIdFromUrl() !== currentWork) {
              router.replace(`/dashboard/script?work=${encodeURIComponent(currentWork)}`, { scroll: false });
            }
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
              const scriptRes = await postSafely("/api/scripts", {
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



  // 结果下方「继续创作」和各快捷按钮共用：目的、结构、作品、源资料一起往下带
  const scriptFlow = { settings: settingsForResult(result, scriptHistory, currentSettings), workId: workId ?? undefined, topic, originContent: originForResult(result, scriptHistory, originContent) };
  const go = (payload: HandoffPayload) => openCreationSafely(payload, (u) => router.push(u), (m) => notify(m, 'error'));
  return (
    // 容器透明，让全站的背景光晕透上来；面板各自用玻璃质感分层
    /*
     * 手机上下排、电脑（lg 以上）左右排。
     * 原来写死左右两栏、左栏 470px：手机屏幕才 375 宽，左栏比屏幕还宽，
     * 右边的结果栏被挤成 64px——生成出来的脚本在手机上根本看不了。
     * 手机上也不要里外两层滚动：整页一起往下滚，结果接在表单下面。
     */
    <div className="flex flex-col lg:h-full lg:flex-row">
      {/* Left Panel - Form */}
      {/* 电脑上宽 470：标签左置后要留出 88px 的标签列，按原先 420 的宽度，
          剩给控件的空间不足，两列的选项卡片会被挤扁 */}
      <div className="w-full border-b border-border/60 px-4 py-6 sm:px-6 lg:w-[470px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-7">
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
              setScriptTypePicked(true);
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
              setScriptTypePicked(true);
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
          {/*
            原来这里是「账号档案 / 账号定位」两个下拉框，每次生成前要再选一次。
            现在档案跟侧边栏走、方向由创作简报下发，这两个框既冗余又会打架——
            在这儿选了 A 号、侧边栏还是 B 号，而简报读的是侧边栏那个。
            换成状态条：自动带上，但明确告诉用户带了什么。
          */}
          <ContextBadge board="script" />
          <CreationSetupNotice settings={autoSetup.settings} preparing={autoSetup.preparing} />
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
                        selected={!autoScriptType && scriptType === key}
                        onClick={() => { setScriptType(key); setScriptTypePicked(true); }}
                      />
                    );
                  })}
              </div>
              {autoScriptType && <p className="mt-2 text-[12px] text-muted-foreground">按带来的内容自动选择脚本类型；也可以手动指定。</p>}
            </Field>

            {activeTab === "content" && (
              <Field
                label="这条视频的目的"
                stacked
                hint={`${effectiveRole}：${ROLE_SPECS[effectiveRole].job}。结尾只要${ROLE_SPECS[effectiveRole].cta}`}
              >
                <div className="flex flex-wrap gap-1.5">
                  {(['自动', ...CONTENT_ROLE_LIST] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setScriptRole(r)}
                      aria-pressed={scriptRole === r}
                      className={chipCls(scriptRole === r)}
                    >
                      {r === '自动' ? `自动（${defaultRoleOfScriptType(scriptType)}）` : r}
                    </button>
                  ))}
                </div>
              </Field>
            )}

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
                      onClick={() => {
                        setTopic(t);
                        if (handoffTopicTactics[t]) setTactic(handoffTopicTactics[t]);
                      }}
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
                    ✨ 时长不限，AI 按效果最好的长度来写
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
            {/* 从开篇页挑过来的那句。不显示的话用户不知道开头已经被锁死了 */}
            {openingLine && (
              <div className="glass-panel mb-3 rounded-xl border border-primary/30 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-primary">
                    开头已选定{openingCard ? ` · ${openingCard}` : ''}
                  </span>
                  <button
                    onClick={() => {
                      setOpeningLine("");
                      setOpeningCard("");
                    }}
                    className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    取消锁定
                  </button>
                </div>
                <p className="text-[12px] leading-relaxed text-foreground">{openingLine}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  脚本会用这句当第一句，不另写开头
                </p>
              </div>
            )}

            {/*
              拍法。和下面的「脚本结构」分工不同：
              结构管时间怎么分，拍法管片子里发生什么事。
            */}
            <Field
              label="拍法（起号 36+1 计）"
              optional
              hint={
                tactic === AUTO_TACTIC
                  ? `AI 按这条的目的（${effectiveRole}）挑一计叠在四大脚本上，挑不出合适的就不叠`
                  : tactic
                    ? GROWTH_TACTICS.find((t) => t.name === tactic)?.formula
                    : '只按四大脚本写，不叠起号打法'
              }
            >
              <select
                value={tactic}
                onChange={(e) => setTactic(e.target.value)}
                className={SELECT_CLS}
              >
                <option value={AUTO_TACTIC}>AI 按目的挑一计（推荐）</option>
                <option value="">不用，只按四大脚本</option>
                {GROWTH_TACTICS.map((t) => (
                  <option key={t.no} value={t.name}>
                    {t.no}. {t.name}
                  </option>
                ))}
              </select>
            </Field>

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
                {Array.from(new Set([...SCENES, scene])).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="拍摄设备" optional>
              <select value={device} onChange={(e) => setDevice(e.target.value)} className={SELECT_CLS}>
                {Array.from(new Set([...DEVICES, device])).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="预算范围" optional>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className={SELECT_CLS}>
                {Array.from(new Set([...BUDGETS, budget])).map((b) => (
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
          <div className="lg:static lg:mt-0 sticky bottom-0 left-0 right-0 glass border-x-0 border-b-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none p-4 lg:p-0 -mx-4 sm:-mx-6 lg:mx-0 z-10">
            <button
              onClick={handleGenerate}
              disabled={autoSetup.preparing || contextLoading || isGenerating || !topic.trim()}
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
      <div id="workspace-result" className="min-w-0 flex-1 scroll-mt-4 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:px-8 lg:py-7">
        <div className="mx-auto max-w-4xl space-y-5">

      {/* 结果区在上、历史在下：原先历史卡片占着顶部，每次进页面先看到的
          是旧记录而不是刚生成的内容 */}
      <ResultPanel
        flowContext={scriptFlow}
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
        // workId 一并带走，下一个环节生成出来才会挂到同一条内容下
        nextActions={[
          {
            // 只要念出来的话：去提词器、配音、发给出镜的人。取的是结果里的「第2步：纯文字文案」
            label: "复制纯文案",
            icon: Copy,
            onClick: (body) => {
              const plain = extractPlainCopy(body);
              if (!plain) {
                notify("这条结果里没有纯文字文案（旧的结果没有这一段），重新生成一次就有了");
                return;
              }
              navigator.clipboard.writeText(plain);
              notify("✅ 纯文案已复制");
            },
          },
          {
            label: "拆分镜",
            icon: Film,
            // 这几个快捷按钮和「继续创作」同一套：只带口播正文，目的、结构、作品一起走，并持久保存
            onClick: (body) => go(buildCreationHandoff('script', 'storyboard', body, scriptFlow)),
          },
          {
            label: "审一遍",
            icon: CheckCircle,
            onClick: (body) => go(buildCreationHandoff('script', 'review', body, scriptFlow)),
          },
          {
            // 开头不够抓人是最常见的返工点。把正文开头那几句截过去，
            // 省得用户从两千字里自己找
            label: "换个开头",
            icon: Sparkles,
            onClick: (body) => go({
              ...buildCreationHandoff('script', 'growth', body, scriptFlow),
              topic,
              // 有纯文案就取它的头两句——那就是要念的开头；旧结果没有这段，再从正文里截
              currentOpening:
                extractPlainCopy(body).split("\n").filter((l) => l.trim()).slice(0, 2).join("") ||
                extractOpening(body),
            }),
          },
          {
            label: "起标题",
            icon: Tag,
            onClick: (body) => go({ ...buildCreationHandoff('script', 'title', body, scriptFlow), topic }),
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
          /*
           * 连同它属于哪个作品、当时的主题一起接上。
           * 原来只调出正文：接着送去分镜、审稿，新内容挂不到原来那个作品上，
           * 又成了一条"一次性"的零散记录。
           */
          const input = item.input_data && typeof item.input_data === "object" ? item.input_data : {};
          setWorkId(item.work_id ?? null);
          setWorkTitle(typeof input.topic === "string" ? input.topic : "");
          if (typeof input.topic === "string" && input.topic) setTopic(input.topic);
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

    </div>
  );
}
