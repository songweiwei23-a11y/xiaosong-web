"use client";
import type { HandoffPayload } from '@/lib/handoff';
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { resolveCreationSettings, mergeCreationSettings, settingsForResult, REVIEW_SCRIPT_TYPES, creationSettingsBlock, scriptTypeForLabel, topicReasonIds, normalizeCreationReasons } from '@/lib/creation-settings';


import { useRouter } from "next/navigation";
import { takeHandoff, parseTopicOptions } from "@/lib/handoff";
import { openCreationSafely } from "@/lib/creation-session";
import { topicReference, carriesScript, carriedIntent, intentBlock, originForResult, continuationRules } from '@/lib/creation-continuation';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { GROWTH_TACTICS } from "@/lib/growth-tactics";
import { VIRAL_ELEMENTS, viralElementById, viralElementPrompt } from "@/lib/viral-elements";
import { tacticBrief, tacticsBlockedBy } from "@/lib/growth-standards";
import { CONTENT_ROLE_LIST, ROLE_SPECS, rolesGuide, roleBrief, type ContentRole } from "@/lib/content-roles";
import { resolveMix, mixPromptBlock, type MixSetting, type ResolvedMix } from "@/lib/content-mix";
import { ContentMixBar, MixCheckLine } from "@/components/workspace/ContentMix";
import { taboosPromptBlock } from "@/lib/taboos";
import { ROUTE_LIST, ROUTE_HINTS, ROUTES_GUIDE, tacticIndex, tacticInText, topicTacticsOf, type CreativeRoute } from "@/lib/creative-routes";
import { throwApiError, fetchGeneration } from "@/lib/api-error";
import { notifyGenerated } from "@/lib/upgrade";
import { createWork, listWorks, type Work } from "@/lib/works";
import { TopicList, type TopicStage } from "@/components/workspace/TopicList";
import { TopicLibrary } from "@/components/workspace/TopicLibrary";
import { splitTopicSections, removeTopicSection, batchBelongsToProfile } from "@/lib/topic-library";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, GENERATE_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { ContextBadge } from "@/components/workspace/ContextBadge";
import { extractStrategySummary } from '@/lib/positioning-utils';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { buildContextBlock, describeExecutionConstraints, describeRestrictions } from '@/lib/creator-context';
import { getActiveProfileId, setActiveProfileId, onActiveProfileChange } from '@/lib/active-profile';



import { useState, useEffect } from "react";
import { readDifyStream } from '@/lib/sse-stream';
import { Lightbulb, Loader2, Users, Target, Sparkles, Zap, Heart, DollarSign, Eye, Flame, FileText } from "lucide-react";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

// 静态配置与类型已抽离
import { ALL_DEAL_REASONS } from './constants';
import type { Profile, Positioning } from './types';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';
import { postSafely } from '@/lib/safe-post';
import { topicSourceRules, topicDesignStandards, topicRoutePrompt, topicDesignFinalCheck, topicPreferredTactic } from '@/lib/topic-design';

export default function TopicPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  // 模式控制
  
  // 统一生成页基础能力
  const {
    history,
    loadHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    quota,
    copyToClipboard,
    downloadAsFile,
    lastResult,
    resultScope,
  } = useGenerationPage({ taskType: '选题策划', historyApiPath: '/api/topics' });

  const router = useRouter();

  // 创作简报从这里来。之前这一页自己手拼 ctx，漏了 brief，
  // 结果注入字数最多、有用的最少
  const { context: creatorContext, loading: contextLoading } = useCreatorContext();

  const [mode, setMode] = useState("custom"); // "quick" 或 "custom"

  // 档案和定位
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [positionings, setPositionings] = useState<Positioning[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPositioningId, setSelectedPositioningId] = useState("");

  // 历史记录
  // topicHistory 已改用 hook 的 history


  // 基础表单字段
  const [accountStage, setAccountStage] = useState("");
  const [fansLevel, setFansLevel] = useState("");
  const [avgViewsInput, setAvgViewsInput] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [positioningExtra, setPositioningExtra] = useState("");

  // 爆款元素
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  // 成交理由
  const [selectedDealReasons, setSelectedDealReasons] = useState<string[]>([]);
  /*
   * 这批选题的目的。原来只按"勾没勾成交理由"分成变现 / 大流量两种，
   * 人设型根本没有——讲自己经历、让人记住你的那类选题从来出不来。
   * 代运营 SOP：每条视频只选一个主目的，目的决定选题、脚本结构和结尾指令。
   */
  const [topicRole, setTopicRole] = useState<'按配比' | ContentRole>('按配比');
  // 按配比时：这次临时改的配比（null = 跟档案）；以及上一次生成实际用的，结果下面拿它核对
  const [mixOverride, setMixOverride] = useState<MixSetting | null>(null);
  const [mixUsed, setMixUsed] = useState<{ resolved: ResolvedMix; count: number } | null>(null);

  // 高级设置
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [benchmarkAccounts, setBenchmarkAccounts] = useState("");
  const [viralCases, setViralCases] = useState("");
  const [topicCount, setTopicCount] = useState(10);
  // 快速 3 条（2026-10-09 产品方要的档位）：用户自己选了快，才压篇幅；默认档位照旧不设上限
  const [quickTopics, setQuickTopics] = useState(false);
  const [withHook] = useState(true);
  const [difficulty, setDifficulty] = useState("中等创意");
  /**
   * 这一批选题用哪一计拍。空 = 不指定，模型自由发挥。
   * 从起号页「按这一计去选题」带过来，也可以在这一页直接选。
   */
  const [tactic, setTactic] = useState("");
  /**
   * 这批用哪套打法。原来默认全走四大脚本 + 爆款元素，36 计只有手动挑了某一计才用得上——
   * 产出里几乎看不见 36 计。现在默认两套都出；指定了某一计时整批都用那一计。
   */
  const [route, setRoute] = useState<CreativeRoute>('两种都出');
  const [routeExplicit, setRouteExplicit] = useState(false);
  /** 已有的作品，给选题清单标出"已在做"的那几条 */
  const [works, setWorks] = useState<Work[]>([]);
  // 只看当前档案的作品（lib/works 按档案取）；切了档案重新取，别的档案在做的不标
  useEffect(() => {
    listWorks(50).then(setWorks);
    return onActiveProfileChange(() => { listWorks(50).then(setWorks); });
  }, []);

  /**
   * 挑定了一条选题：建作品（同题已有进行中的会直接复用），带着编号跳过去。
   * 编号在地址里，之后隔多久都能从「我的作品」接着做。
   *
   * 写脚本时把这条选题当时的方案（内容方向、开篇钩子、拍法）一起带过去——
   * 原来只带标题，选题策划时想好的东西到脚本页就丢了，等于白想。
   */
  const sendTopic = async (title: string, stage: TopicStage, body?: string) => {
    const workId = await createWork(title, selectedProfileId || null);
    // 持久保存后再跳（lib/creation-session）：刷新、换设备都能接着这一条
    await openCreationSafely({
      ...buildCreationHandoff('topic', stage === '脚本生成' ? 'script' : stage === '标题封面' ? 'title' : 'growth', body || title, { topic: title, settings: mergeCreationSettings(settingsForResult(result, history, currentSettings), { topic: title }), originContent: originForResult(result, history, originContent || sourceReference) }),
      from: "选题策划",
      topic: title,
      workId: workId ?? undefined,
      tab: stage === "开篇钩子" ? "opening" : undefined,
      // 打法跟着选题一路走，脚本才能按这一计的结构公式排。
      // 没整批指定时，看这一条自己标的是哪一计
      tactic: tactic || tacticInText(body ?? "") || undefined,
      note:
        stage === "脚本生成" && body
          ? buildCreationHandoff('topic', 'script', body, { topic: title, settings: mergeCreationSettings(settingsForResult(result, history, currentSettings), { topic: title }), originContent: originForResult(result, history, originContent || sourceReference) }).note
          : undefined,
    }, (u) => router.push(u), (m) => notify(m, 'error'));
  };
  const [personalRequirement, setPersonalRequirement] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [originContent, setOriginContent] = useState('');
  const [sourceFrom, setSourceFrom] = useState("");

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult, resultScope);

  // 折叠状态
  const platforms = ["抖音", "快手", "视频号", "小红书", "B站"];
  const tracks = [
"美食烹饪", "职场技能", "育儿教育", "美妆护肤", "健身减肥",
"汽车", "数码科技", "家居收纳", "穿搭时尚", "摄影",
"旅行", "宠物", "情感心理", "财经理财", "副业创业",
"手工DIY", "读书分享", "游戏电竞", "装修设计", "法律咨询",
"医疗健康", "二手交易", "探店测评", "剧情搞笑"
  ];
  /*
   * 前四项是知识库里的「四大脚本类型」，后面几项是它讲的「实体店四大内容方向」
   * （过程展示 / 测评产品 / 任务挑战 / 事件体验）和常见呈现形式。
   * 原来缺了挑战型、体验型、案例型——这三类恰恰是实体店最容易出效果的，
   * 知识库里专门讲过，界面上却选不到。
   */
  const contentTypes = [
    "教知识型", "晒过程型", "聊观点型", "讲故事型",
    "测评型", "探店型", "剧情型", "口播型",
    "挑战型", "体验型", "案例型", "混剪型",
  ];
  const styles = [
"专业严谨", "活泼亲和", "犀利直接", "温暖治愈",
"幽默搞笑", "高冷范儿", "接地气", "文艺清新",
"热血激情", "佛系淡定", "反差萌", "知性优雅"
  ];

  /*
   * 这里原来是一份手写的八个元素，和知识库里真正的「八大爆款元素」对不上：
   * 「奇葩」在原文里叫「猎奇选题」、「反差」叫「对立选题」。
   * 更要命的是它只把名字发给模型（「爆款元素：成本、人群」），句式一个没传——
   * 模型只能靠猜，这八个按钮点了基本等于没点，而且不报错。
   *
   * 现在统一用 lib/viral-elements.ts，名字和原文一字不差（有测试回源比对），
   * 提示词由 viralElementPrompt() 带上原文句式。
   * 图标留在页面这一层：它是展示细节，不该塞进数据文件。
   */
  const ELEMENT_ICONS: Record<string, typeof DollarSign> = {
    cost: DollarSign,
    people: Users,
    celebrity: Sparkles,
    curious: Zap,
    worst: Target,
    contrast: Eye,
    nostalgia: Heart,
    hormone: Flame,
  };
  const explosiveElements = VIRAL_ELEMENTS.map((e) => ({
    id: e.id,
    // 按钮上只放短名，「最差选题」在四列网格里放不下
    zhName: e.name.replace(/选题$/, ''),
    desc: e.hook,
    icon: ELEMENT_ICONS[e.id] ?? Sparkles,
  }));

  // 多选切换函数
  const toggleSelection = (item: string, selected: string[], setSelected: (arr: string[]) => void) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  // 加载档案
  const loadProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");
      const data = await response.json();
      // API直接返回数组
      if (Array.isArray(data)) {
        setProfiles(data);
        // 跟侧边栏用同一个档案。以前这个下拉框是空的，用户在侧边栏选了"言山廷"，
        // 进选题页还得再选一次——不选就等于没档案，选错就是另一个号的设定
        const active = getActiveProfileId();
        if (active && data.some((p: any) => p.id === active)) {
          setSelectedProfileId((cur) => cur || active);
        }
      }
    } catch (error) {
      console.error("加载档案失败:", error);
    }
  };

  // 加载定位
  const loadPositionings = async () => {
    try {
      const response = await fetch("/api/positioning");
      const data = await response.json();
      // API直接返回数组，不是包装在对象中
      if (Array.isArray(data)) {
        setPositionings(data);
      }
    } catch (error) {
      console.error("加载定位失败:", error);
    }
  };




  // 从账号定位中提取选题策划相关的关键信息
  const extractRelevantPositioningInfo = (fullContent: string): string => {
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

  // 组件加载时获取数据
  useEffect(() => {
    loadProfiles();
    loadPositionings();
    loadHistory();
    // 起号页带过来的打法
    const handed = takeHandoff();
    if (handed) setIncomingSetup(handed);
    if (handed) setOriginContent(handed.originContent || handed.sourceContent || '');
    if (handed?.tactic) setTactic(handed.tactic);
    if (handed?.sourceContent) {
      setSourceReference(topicReference(handed));
      setSourceFrom(handed.from);
      setMode('quick');
    }
    // 用户在侧边栏切了档案，这一页不刷新也要跟上
    return onActiveProfileChange(() => {
      setSourceReference(''); setSourceFrom(''); setOriginContent('');
      const id = getActiveProfileId();
      if (id) setSelectedProfileId(id);
    });
  }, []);

  const autoSetup = useAutoCreationSetup(incomingSetup, creatorContext, contextLoading, s => {
    setMode('quick'); setAccountStage(creatorContext.profile?.account_stage || '有定位，需要内容方向');
    // 只填原内容写明的和档案里有的；没写的保持页面默认（目的「按配比」、类型和元素空着），不猜（2026-10-03）
    setFansLevel(creatorContext.profile?.fans_level || '0-1000'); setSelectedPlatforms([s.platform!]);
    setSelectedTracks(s.industry ? s.industry.split('、').map((x) => x.trim()).filter(Boolean) : []);
    setSelectedContentTypes(s.scriptType && REVIEW_SCRIPT_TYPES[s.scriptType] ? [REVIEW_SCRIPT_TYPES[s.scriptType]] : []);
    setSelectedStyles(s.style ? [s.style] : []);
    /*
     * 目的按原方向写的来（2026-10-05）：写了两种（「人设型+变现型混合」）就按配比、只在这两种里分，
     * 原来只取第一种，整批成了「全部人设型」；写了一种就整批是这一种
     */
    const roles = carriedIntent(incomingSetup).roles;
    if (roles.length >= 2) {
      setTopicRole('按配比');
      const share = Math.floor(100 / roles.length);
      setMixOverride({ preset: 'custom', custom: { 流量型: 0, 人设型: 0, 变现型: 0, ...Object.fromEntries(roles.map((r, i) => [r, i === 0 ? 100 - share * (roles.length - 1) : share])) } });
    } else setTopicRole(roles[0] ?? s.purpose ?? '按配比');
    setTopicCount(Math.min(30, Math.max(1, s.topicCount || 5)));
    setSelectedElements(s.elements || []); if (s.tactic) setTactic(s.tactic);
    setSelectedDealReasons(topicReasonIds(s.dealReasons || []));
    setKeyword1(s.topic ?? '');
    // 带来的是具体脚本时，最早那个大方向不再填进「个人要求」——那里写着「所有选题必须围绕」，
    // 会把选题拉回大方向、另编和脚本无关的故事（2026-10-05 线上）。方向作为背景已经在参考内容里
    setPersonalRequirement(carriesScript(incomingSetup) ? '' : s.direction ?? '');
  });
  const currentSettings = resolveCreationSettings({ from: '选题策划', sourceContent: sourceReference || keyword1 || personalRequirement, settings: mergeCreationSettings(autoSetup.settings, {
    topic: keyword1, direction: personalRequirement, platform: selectedPlatforms[0], industry: selectedTracks.join('、'),
    scriptType: REVIEW_SCRIPT_TYPES[autoSetup.settings.scriptType!] === selectedContentTypes[0] ? autoSetup.settings.scriptType : scriptTypeForLabel(selectedContentTypes[0]), style: selectedStyles.join('、'),
    purpose: topicRole === '按配比' ? undefined : topicRole, elements: selectedElements, topicCount, tactic,
    dealReasons: normalizeCreationReasons([...autoSetup.settings.dealReasons || [], ...selectedDealReasons]),
  }) }, creatorContext);

  // 配比按哪个档案算：快速模式选的那个，没有就用侧边栏当前档案
  const mixProfile = (profiles.find((p) => p.id === selectedProfileId) ?? creatorContext.profile ?? null) as Record<string, unknown> | null;
  const resolvedMix = resolveMix(mixProfile, mixOverride, personalRequirement);

  // 生成选题函数
  const handleGenerate = async () => {
    if (autoSetup.preparing || contextLoading) { notify("正在承接原方案，请稍候"); return; }
    if (!resultScope) { notify("档案正在加载，请稍后再试"); return; }
    const isCurrent = beginProfileRequest();
    if (!accountStage && mode === "custom") {
      notify("请选择账号阶段");
      return;
    }

    setIsGenerating(true);
    setResult("");

    try {
      const topicType = topicRole === '按配比' ? "选题（流量型、人设型、变现型按配比搭配）" : `${topicRole}选题`;
      
      // 获取完整的档案信息
      const selectedProfile = profiles.find(p => p.id === selectedProfileId);
      const profileInfo = selectedProfile ? {
        档案名称: selectedProfile.profile_name,
        平台: selectedProfile.account_platform?.join('、'),
        赛道: selectedProfile.account_track?.join('、'),
        账号阶段: selectedProfile.account_stage,
        粉丝量级: selectedProfile.fans_level,
        目标年龄: selectedProfile.target_age?.join('、'),
        目标性别: selectedProfile.target_gender,
        目标职业: selectedProfile.target_occupation?.join('、'),
        目标痛点: selectedProfile.target_pain_points,
        目标需求: selectedProfile.target_needs,
        内容类别: selectedProfile.content_category?.join('、'),
        内容风格: selectedProfile.content_style?.join('、'),
        内容形式: selectedProfile.content_format?.join('、'),
        内容价值: selectedProfile.content_value,
        独特卖点: selectedProfile.unique_selling_point
      } : null;

      // 获取完整的定位信息
      const selectedPositioning = positionings.find(p => p.id === selectedPositioningId);
      const positioningInfo = selectedPositioning ? {
        定位名称: selectedPositioning.positioning_name,
        完整定位内容: selectedPositioning.full_content,
        选题摘要: selectedPositioning.strategy_summary,
      } : null;

      // 定位以前在这儿被算出来就扔了：extractStrategySummary 的结果赋给一个
      // 没人用的变量，提示词里只留下一句「以上是从完整定位方案中提取的…」，
      // 而"以上"根本不存在。用户选了定位，模型一个字都没看到。
      const positioningForCtx = selectedPositioning
        ? {
            name: selectedPositioning.positioning_name || "账号定位",
            summary:
              selectedPositioning.strategy_summary ||
              extractStrategySummary(selectedPositioning.full_content || ""),
            full: selectedPositioning.full_content || "",
          }
        : null;

      /*
       * 成交理由这里不传：选题页的成交理由是用户从固定清单里勾的，
       * 下面已经单独拼进 query，再塞一遍等于重复付费。
       *
       * brief 必须带上。之前这里漏了它，实测的后果很讽刺：
       * 选题注入 2251 字（全站最多），有用的却最少——塞的是截断的定位原文，
       * 而简报里的「一句话定位」「说给谁听」「内容方向」一个都没到。
       * 接上之后是 399 字，更短但全是有用的。
       */
      const topicContext = buildContextBlock(
        {
          profile: selectedProfile ?? null,
          positioning: positioningForCtx,
          dealReasons: [],
          brief: creatorContext.brief,
          // 数据回流：这个号发出去的真实数据，出选题时参考（lib/performance）
          performance: creatorContext.performance,
        },
        'topic'
      );
      const customModeContext = selectedProfile
        ? describeRestrictions(selectedProfile)
        : '';

      const requestData = {
        // 这批选题属于哪个档案：防重复清单按档案取，没有它就只能靠档案名称去猜
        profile_id: selectedProfileId || null,
        mode: mode,
        topicType: topicType,
        topicRole: topicRole,
        route: tactic ? undefined : route,
        routeExplicit,
        // 传递完整的档案和定位信息，而不是ID
        profileInfo: profileInfo ? JSON.stringify(profileInfo) : "",
        positioningInfo: positioningInfo ? JSON.stringify(positioningInfo) : "",
        accountStage: accountStage,
        fansLevel: fansLevel,
        avgViews: avgViewsInput,
        platforms: selectedPlatforms.join("、"),
        tracks: selectedTracks.join("、"),
        contentTypes: selectedContentTypes.join("、"),
        styles: selectedStyles.join("、"),
        positioningExtra: positioningExtra,
        // 这条是存历史用的，写全名才看得出当时用的是哪个元素
        elements: selectedElements.map((id) => viralElementById(id)?.name ?? id).join("、"),
        dealReasons: selectedDealReasons.map(id => {
          const reason = ALL_DEAL_REASONS.find(r => r.id === id);
          return reason ? reason.label : id;
        }).join("、"),
        keywords: [keyword1, keyword2, keyword3].filter(k => k).join("、"),
        personalRequirement,
        benchmarkAccounts: benchmarkAccounts,
        viralCases: viralCases,
        topicCount: topicCount,
        difficulty: difficulty,
        withHook: withHook,
        // 复盘要按打法统计样本数，所以每条记录都要留下用的是哪一计
        tactic: tactic || undefined,
        sourceReference,
        creationSettings: currentSettings,
        originContent,
        sourceFrom,
      };

      // 构建详细的prompt
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
        query += `\n💡 脚本类型不等于目的：同一种脚本可以做不同目的——泛知识是流量型、专业难题是变现型；\n`;
        query += `讲自己的成长是人设型、讲帮客户做成的事是变现型。每条先定目的，再按目的选结构。\n\n`;
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
      const dealReasonsText = selectedDealReasons
        .map((id) => ALL_DEAL_REASONS.find((r) => r.id === id)?.label ?? id)
        .join('、');
      if (topicRole === '按配比') {
        /*
         * 原来是一句"按上面账号定位里定好的配比分配"——配比只在定位文字里，模型每次理解不一样，
         * 也没人核对。现在由 lib/content-mix 算出确定的条数（档案设置 / 这次临时改的 / 系统按阶段推荐）
         */
        query += `\n【这批选题的目的】流量型、人设型、变现型按配比搭配\n\n`;
        query += `${mixPromptBlock(resolvedMix, { count: topicCount })}\n\n`;
        query += `${rolesGuide()}\n\n`;
        setMixUsed({ resolved: resolvedMix, count: topicCount });
      } else {
        setMixUsed(null);
        query += `\n【这批选题的目的】全部是${topicRole}\n\n${roleBrief(topicRole)}\n\n`;
      }
      if (topicRole === '流量型') {
        // 举例从同一份数据取，别再手写——上一版写的「反差」原文里根本没有（叫「对立选题」）
        query += `- 流量型的核心手段：八大爆款元素（${VIRAL_ELEMENTS.slice(0, 4).map((e) => e.name).join('、')}等）+ 扩大覆盖（用大众入口承载专业）\n`;
        query += `- 覆盖要广，但人群要对——垂直是人群垂直：选这个号的目标人群也关心的话题，不是随便什么热闹都蹭\n\n`;
      }
      if (dealReasonsText && topicRole !== '流量型' && topicRole !== '人设型') {
        query += `- 成交理由：${dealReasonsText}\n`;
        query += `⚠️ 变现型选题必须落在这些成交理由上：标题体现、内容围绕它拍、编导思路服务于它的说服力\n\n`;
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

      
      // 这里原本还有一道「最终过滤」，对**整条提示词**逐行扫描，命中
      // '**拍摄方向思路**' 之类的关键词就开始跳过，直到遇见 `##` 开头的行才恢复。
      //
      // 问题是：这段提示词从头到尾只有一行以 `##` 开头（输出格式里的
      // 「## 选题X：[标题]」），其余全是 `**1️⃣ …**` 这种加粗行。一旦定位内容里
      // 带进任何一个关键词，从那里到那一行之间的内容——基础信息、脚本类型约束、
      // 爆款元素配置——会被整段静默删掉，页面上完全看不出来。
      //
      // 而定位文本在进入 query 之前已经被 extractStrategySummary 和
      // extractRelevantPositioningInfo 过滤了两道，本就轮不到第三道。
      // 现在定位不再截断到 300 字、内容长了 6 倍，这颗雷只会更容易踩到，
      // 所以直接拆掉——该过滤的在源头过滤，不该拿整条提示词去冒险。

      const response = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 见 script 页同处说明：taskType 决定检索提示词、会话隔离与用量归属。
          // 后端检测到已有 query 时会沿用这里拼好的完整提示词，不再自行拼装。
          taskType: "选题策划",
          creationSettings: currentSettings,
          // 记忆按档案隔离，避免代运营时多个账号的上下文互相串台。
          profileId: selectedProfileId || null,
          query: query + creationSettingsBlock(currentSettings),
          inputs: requestData
        })
      });

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) await throwApiError(response);

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      const accumulatedText = await readDifyStream(response, {
        onChunk: (_piece, full) => { if (isCurrent()) setResult(full); },
      });

      // 保存到历史记录
      if (accumulatedText) {
        const response = await postSafely("/api/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_data: requestData,
            result: accumulatedText
          })
        });
        if (response.ok) {
          await loadHistory();
        }
        // 生成成功：快用完了就轻轻提醒一次（这一页不走 saveGenerationHistory，单独发）
        notifyGenerated();
      }

    } catch (error: any) {
      console.error("生成失败:", error);
      notify(error?.message || "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  // 结果下方「继续创作」和两个快捷按钮共用：目的、人群、结构、源资料一起往下带
  const topicFlow = { settings: settingsForResult(result, history, currentSettings), originContent: originForResult(result, history, originContent || sourceReference) };
  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="选题策划" subtitle="结合账号定位与爆款元素，一次给出多条可直接拍的选题" />
          {sourceReference && <CollapsibleSection title={`来自${sourceFrom}的参考内容`} defaultOpen>
            <textarea aria-label="创作参考内容" value={sourceReference} onChange={e => setSourceReference(e.target.value)} rows={5} className={TEXTAREA_CLS} />
            <button onClick={() => setSourceReference('')} className="mt-2 text-xs text-muted-foreground hover:text-foreground">清除参考内容</button>
          </CollapsibleSection>}

          {/* 模式切换：分段控件比两个并排按钮干净，选中的那个才有实体感 */}
          <div className="glass-panel flex gap-1 rounded-2xl p-1">
            {([
              { id: "quick", label: "⚡ 快速模式", hint: "用已存的档案和定位" },
              { id: "custom", label: "🎨 自定义", hint: "手动填写所有字段" },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.hint}
                aria-pressed={mode === m.id}
                className={`flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-all ${
                  mode === m.id
                    ? "btn-brand"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/*
            原来快速模式下有「个人档案 / 账号定位」两个必选下拉框。
            现在档案跟侧边栏走、方向由创作简报下发，两种模式都自动带上，
            不必再选——留着反而会和侧边栏选的那个打架。
          */}
          <ContextBadge board="topic" />
          <CreationSetupNotice settings={autoSetup.settings} preparing={autoSetup.preparing} />

          {mode === "custom" && (
            <>
              <CollapsibleSection title="账号情况" defaultOpen>
                <Field label="账号阶段" optional>
                  <select value={accountStage} onChange={(e) => setAccountStage(e.target.value)} className={SELECT_CLS}>
                    <option value="">选择阶段</option>
                    {["刚起号", "有基础", "稳定更新", "寻求突破"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>

                <Field label="粉丝量级" optional>
                  <select value={fansLevel} onChange={(e) => setFansLevel(e.target.value)} className={SELECT_CLS}>
                    <option value="">选择级别</option>
                    {["0-1万", "1-10万", "10-50万", "50万以上"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>

                <Field label="平均播放" optional>
                  <input
                    type="text"
                    value={avgViewsInput}
                    onChange={(e) => setAvgViewsInput(e.target.value)}
                    placeholder="例如：5000"
                    className={INPUT_CLS}
                  />
                </Field>
              </CollapsibleSection>

              <CollapsibleSection title="内容方向" defaultOpen>
                <Field label="发布平台" optional stacked>
                  <div className="flex flex-wrap gap-1.5">
                    {platforms.map((p) => (
                      <button
                        key={p}
                        onClick={() => toggleSelection(p, selectedPlatforms, setSelectedPlatforms)}
                        aria-pressed={selectedPlatforms.includes(p)}
                        className={chipCls(selectedPlatforms.includes(p))}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="赛道" optional stacked>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...tracks, ...selectedTracks])).map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleSelection(t, selectedTracks, setSelectedTracks)}
                        aria-pressed={selectedTracks.includes(t)}
                        className={chipCls(selectedTracks.includes(t))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="内容类型" optional stacked>
                  <div className="flex flex-wrap gap-1.5">
                    {contentTypes.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleSelection(t, selectedContentTypes, setSelectedContentTypes)}
                        aria-pressed={selectedContentTypes.includes(t)}
                        className={chipCls(selectedContentTypes.includes(t))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="风格" optional stacked>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...styles, ...selectedStyles])).map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSelection(s, selectedStyles, setSelectedStyles)}
                        aria-pressed={selectedStyles.includes(s)}
                        className={chipCls(selectedStyles.includes(s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
              </CollapsibleSection>
            </>
          )}

          {/*
            拍法。爆款元素管"讲什么内容"，拍法管"用什么形式拍"，两件事。
            37 计平铺出来太多，这里只做一个下拉；真要挑还是去起号页看完整说明。
          */}
          <CollapsibleSection title="打法（四大脚本 / 起号 36 计）" defaultOpen>
            <Field
              label="用哪套打法"
              stacked
              hint={tactic ? `已指定第 ${GROWTH_TACTICS.find((t) => t.name === tactic)?.no} 计，整批都按它拍` : sourceReference && !routeExplicit ? '按原方向自动选最合适的拍法；点击下面选项可手动指定' : ROUTE_HINTS[route]}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {ROUTE_LIST.map((r) => {
                  const picked = !tactic && route === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setRoute(r);
                        setRouteExplicit(true);
                        setTactic("");
                      }}
                      aria-pressed={picked}
                      className={`glass-interactive rounded-xl border px-2 py-1.5 text-center text-[11px] ${
                        picked ? "glass-selected text-primary" : "glass-panel text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field
              label="指定某一计"
              optional
              stacked
              hint={
                tactic
                  ? '这一批选题都会按这一计的结构公式来想'
                  : '不指定就按上面的打法，由 AI 按每条的目的挑计。想看每一计的详细说明，去「起号方案」'
              }
            >
              <select
                value={tactic}
                onChange={(e) => setTactic(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">不指定</option>
                {GROWTH_TACTICS.map((t) => (
                  <option key={t.no} value={t.name}>
                    {t.no}. {t.name}（{t.fit}）
                  </option>
                ))}
              </select>
            </Field>
            {tactic && (
              <div className="glass-panel mt-2 rounded-xl border border-primary/30 p-3">
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-primary">结构公式</span>：
                  {GROWTH_TACTICS.find((t) => t.name === tactic)?.formula}
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="爆款元素" defaultOpen>
            <Field
              label="爆款元素"
              optional
              stacked
              hint={
                selectedElements.length > 0
                  ? `已选 ${selectedElements.length} 个，每条选题会标注用到哪些`
                  : "建议选 2–3 个，AI 会在选题里明确标注"
              }
            >
              <div className="grid grid-cols-4 gap-1.5">
                {explosiveElements.map((elem) => {
                  const picked = selectedElements.includes(elem.id);
                  return (
                    <button
                      key={elem.id}
                      onClick={() => toggleSelection(elem.id, selectedElements, setSelectedElements)}
                      aria-pressed={picked}
                      title={elem.desc}
                      className={`glass-interactive rounded-xl border p-2 text-center ${
                        picked ? "glass-selected" : "glass-panel"
                      }`}
                    >
                      <elem.icon
                        className={`mx-auto h-4 w-4 ${picked ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div
                        className={`mt-1 text-[11px] font-medium leading-none ${
                          picked ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {elem.zhName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="这批选题的目的"
              stacked
              hint={
                topicRole === '按配比'
                  ? "流量型、人设型、变现型搭配出，每条标明是哪种"
                  : ROLE_SPECS[topicRole].job
              }
            >
              <div className="grid grid-cols-4 gap-1.5">
                {(['按配比', ...CONTENT_ROLE_LIST] as const).map((r) => {
                  const picked = topicRole === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setTopicRole(r)}
                      aria-pressed={picked}
                      className={`glass-interactive rounded-xl border px-2 py-1.5 text-center text-[11px] ${
                        picked ? "glass-selected text-primary" : "glass-panel text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              {topicRole === '按配比' && (
                <ContentMixBar
                  className="mt-2"
                  profile={mixProfile}
                  override={mixOverride}
                  onOverride={setMixOverride}
                  count={topicCount}
                  goal={personalRequirement}
                />
              )}
            </Field>

            <Field
              label="成交理由"
              optional
              stacked
              hint={
                topicRole === '流量型' || topicRole === '人设型'
                  ? `${topicRole}选题不写成交理由，这里选了也不用`
                  : selectedDealReasons.length > 0
                    ? `已选 ${selectedDealReasons.length} 个，变现型选题会落在这些点上`
                    : "不选的话，变现型选题从档案卖点里找成交理由"
              }
            >
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_DEAL_REASONS.map((r) => {
                  const picked = selectedDealReasons.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleSelection(r.id, selectedDealReasons, setSelectedDealReasons)}
                      aria-pressed={picked}
                      title={r.desc}
                      className={`glass-interactive rounded-xl border px-2 py-1.5 text-center text-[11px] ${
                        picked ? "glass-selected text-primary" : "glass-panel text-muted-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="进阶设置" defaultOpen={false}>
            <Field label="关键词" optional stacked hint="想让选题围绕的具体词">
              <div className="grid grid-cols-3 gap-1.5">
                <input value={keyword1} onChange={(e) => setKeyword1(e.target.value)} placeholder="关键词 1" className={INPUT_CLS} />
                <input value={keyword2} onChange={(e) => setKeyword2(e.target.value)} placeholder="关键词 2" className={INPUT_CLS} />
                <input value={keyword3} onChange={(e) => setKeyword3(e.target.value)} placeholder="关键词 3" className={INPUT_CLS} />
              </div>
            </Field>

            <Field label="对标账号" optional stacked>
              <textarea
                value={benchmarkAccounts}
                onChange={(e) => setBenchmarkAccounts(e.target.value)}
                placeholder="想参考的同赛道账号…"
                rows={2}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="爆款案例" optional stacked>
              <textarea
                value={viralCases}
                onChange={(e) => setViralCases(e.target.value)}
                placeholder="见过的爆款选题，AI 会参考套路…"
                rows={2}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="定位补充" optional stacked hint="生成的选题必须符合这里写的定位">
              <textarea
                value={positioningExtra}
                onChange={(e) => setPositioningExtra(e.target.value)}
                placeholder="账号特色、目标、禁忌…"
                rows={3}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="个人要求" optional stacked>
              <textarea
                value={personalRequirement}
                onChange={(e) => setPersonalRequirement(e.target.value)}
                placeholder="其他特殊要求…"
                rows={2}
                className={TEXTAREA_CLS}
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="输出设置" defaultOpen>
            <Field label="生成数量" optional>
              <div className="glass-panel inline-flex gap-0.5 rounded-xl p-1">
                <button
                  onClick={() => { setTopicCount(3); setQuickTopics(true); }}
                  aria-pressed={quickTopics}
                  className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                    quickTopics
                      ? "bg-primary/20 font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  快速 3 条
                </button>
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setTopicCount(n); setQuickTopics(false); }}
                    aria-pressed={!quickTopics && topicCount === n}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      !quickTopics && topicCount === n
                        ? "bg-primary/20 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n} 条
                  </button>
                ))}
              </div>
              {quickTopics && <p className="mt-1.5 text-[11.5px] text-muted-foreground">只出 3 条、每条写要点（目的、打法、开头、结构、结尾），大约一分钟出来；想看完整版就选 5 条以上</p>}
            </Field>

            <Field label="创意难度" optional>
              <div className="glass-panel inline-flex gap-0.5 rounded-xl p-1">
                {["容易执行", "中等创意", "高创意"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    aria-pressed={difficulty === d}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      difficulty === d
                        ? "bg-primary/20 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          <button onClick={handleGenerate} disabled={autoSetup.preparing || contextLoading || isGenerating} className={GENERATE_BTN}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                策划中…
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                生成 {topicCount} 条选题
              </>
            )}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        title="选题方案"
        flowContext={topicFlow}
        showStats={false}
        emptyIcon={Lightbulb}
        emptyTitle="填好条件就能出选题"
        emptyHint="每条会给出标题、内容方向和拍摄思路"
        emptyTips={[
          "快速模式直接套用已存的档案与定位",
          "爆款元素建议选 2–3 个，多了会散",
          "每条选题只担一个目的：流量、人设或变现",
        ]}
        generatingHint="正在策划选题…"
        footer={mixUsed ? <MixCheckLine text={result} resolved={mixUsed.resolved} count={mixUsed.count} /> : undefined}
        qualityMix={mixUsed}
        onCopy={(text) => copyToClipboard(text)}
        onDownload={(text) => downloadAsFile(text, `选题方案-${new Date().toLocaleDateString()}.txt`)}
        onContinue={result ? () => openContinuousDialog(result) : undefined}
        // 选题的下一步必然是写脚本。把解析出的选题标题一并带过去，
        // 到脚本页挑一条即可，不用回来复制
        nextActions={[
          {
            label: "写成脚本",
            icon: FileText,
            onClick: async (body) => {
              const options = parseTopicOptions(body);
              // 只有一条候选时，用户其实已经选定了，这里就把作品建出来；
              // 多条时留到脚本页挑完再建——此刻还不知道要做哪条，
              // 提前建只会得到一个名字不对的作品。
              const workId =
                options.length === 1
                  ? (await createWork(options[0], selectedProfileId || null)) ?? undefined
                  : undefined;

              await openCreationSafely({
                // 目的、人群、结构、源资料跟着走（原来这个按钮只带题目清单，到脚本页这些都丢了）
                ...buildCreationHandoff('topic', 'script', body, topicFlow),
                from: "选题策划",
                topicOptions: options,
                topic: options.length === 1 ? options[0] : undefined,
                workId,
                // 打法跟着选题一路走到脚本，脚本才能按这一计的结构公式排
                tactic: tactic || (options.length === 1 ? tacticInText(body) : undefined),
                // 每条各自标的是哪一计：到脚本页挑中哪条，就自动带上那一条的计
                topicTactics: tactic ? undefined : topicTacticsOf(body),
              }, (u) => router.push(u), (m) => notify(m, 'error'));
            },
          },
          {
            // 选题定了就能先想开头——开头决定这条片子的生死，
            // 而且想清楚开头再写正文，脚本会顺得多
            label: "设计开篇",
            icon: Sparkles,
            onClick: (body) => {
              const options = parseTopicOptions(body);
              openCreationSafely({
                ...buildCreationHandoff('topic', 'growth', body, topicFlow),
                from: "选题策划",
                // 整批都带过去，让他在开篇页自己挑给哪条写开头。
                // 只带第一条的话，等于替他做了选择——而这一批本来就是给他挑的
                topicOptions: options,
                topic: options[0] || "",
                tab: "opening",
                tactic: tactic || undefined,
              }, (u) => router.push(u), (m) => notify(m, 'error'));
            },
          },
        ]}
      />

      {/* 每一条选题单独送去下一个板块。新生成的、从历史里打开的旧批次都能用 */}
      {!isGenerating && (
        <TopicList
          topics={parseTopicOptions(result)}
          works={works}
          onAction={(title, stage) =>
            sendTopic(title, stage, splitTopicSections(result).find((s) => s.title === title)?.body)
          }
        />
      )}

      {/*
        选题库：出过的每一条都在这里，不只是这一批。
        数据就是历史面板那份（进页面时已经整批取回），不多发请求
      */}
      {!isGenerating && (
        <TopicLibrary
          // 只列当前档案出过的选题，和防重复清单同一个口径；没选档案就全列
          batches={
            selectedProfileId
              ? history.filter((b) =>
                  batchBelongsToProfile(
                    b.input_data,
                    selectedProfileId,
                    profiles.find((p) => p.id === selectedProfileId)?.profile_name
                  )
                )
              : history
          }
          works={works}
          onAction={sendTopic}
          onDelete={async (title) => {
            const ok = await confirmDialog(
              `删掉「${title}」？\n它在哪一批里出现过都会一起删掉。删掉的会被记住，生成新选题时不会再推荐给你。`,
              { tone: "danger", confirmText: "删除", title: "删除选题" }
            );
            if (!ok) return;
            const res = await fetch(`/api/topics?topic=${encodeURIComponent(title)}`, { method: "DELETE" });
            if (!res.ok) {
              notify("删除失败，请重试");
              return;
            }
            // 结果区正显示着这一批的话，也把这条拿掉，免得删了还看得见
            setResult((r) => removeTopicSection(r, title).markdown);
            await loadHistory();
            notify("已删除");
          }}
        />
      )}

      <HistoryPanel
        // 一批里的选题全被删光的，不再占着历史列表
        items={history.filter((h: any) => splitTopicSections(h.result || "").length > 0)}
        title="历史选题"
        showStats={false}
        onLoad={(item) => {
          setResult(item.result);
          // 那一批当时用的打法也接上，从里面挑一条去写脚本时才带得过去
          const t = item.input_data?.tactic;
          if (typeof t === "string" && t) setTactic(t);
        }}
        onContinue={(item) => openContinuousDialog(item.result)}
        onDelete={(id) => deleteHistory(id)}
      />

      <ContinuousDialog
        isOpen={showDialog}
        onClose={() => {
          closeContinuousDialog();
          // 追问里"再来 10 条"出的选题服务端已存进选题库，关掉对话就能在库里看到
          loadHistory();
        }}
        initialContent={dialogInitialContent}
        taskType="选题策划"
      />
    </WorkspaceLayout>
  );
}
