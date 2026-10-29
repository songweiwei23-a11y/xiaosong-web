"use client";
import type { HandoffPayload } from '@/lib/handoff';
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { mergeCreationSettings, settingsForResult, REVIEW_SCRIPT_TYPES, topicReasonIds } from '@/lib/creation-settings';


import { useRouter } from "next/navigation";
import { takeHandoff, parseTopicOptions } from "@/lib/handoff";
import { openCreationSafely } from "@/lib/creation-session";
import { topicReference, carriedIntent, originForResult } from '@/lib/creation-continuation';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { GROWTH_TACTICS } from "@/lib/growth-tactics";
import { VIRAL_ELEMENTS, viralElementById, industryKeysOf, elementFitNote, elementsPerTopic } from "@/lib/viral-elements";
import { CONTENT_ROLE_LIST, ROLE_SPECS, type ContentRole } from "@/lib/content-roles";
import { resolveMix, type MixSetting, type ResolvedMix } from "@/lib/content-mix";
import { ContentMixBar, MixCheckLine } from "@/components/workspace/ContentMix";
import { ROUTE_LIST, ROUTE_HINTS, tacticInText, topicTacticsOf, type CreativeRoute } from "@/lib/creative-routes";
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
import { getActiveProfileId, setActiveProfileId, onActiveProfileChange } from '@/lib/active-profile';



import { useState, useEffect } from "react";
import { readDifyStream } from '@/lib/sse-stream';
import { polishTitlesRemote } from '@/lib/title-polish';
import { CommentQuestions } from '@/components/topic/CommentQuestions';
import { Lightbulb, Loader2, Users, Target, Sparkles, Zap, Heart, DollarSign, Eye, Flame, FileText } from "lucide-react";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';
import { VoiceInputButton } from '@/components/voice/VoiceInputButton';
import { appendTranscript } from '@/lib/voice-input';

// 静态配置与类型已抽离
import { ALL_DEAL_REASONS } from './constants';
import type { Profile, Positioning } from './types';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';
import { postSafely } from '@/lib/safe-post';
import { buildTopicBoardQuery, topicCreationSettings } from '@/lib/boards/topic-query';
import { completeBatch } from '@/lib/topic-batch';

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
    // 带来的方向不再填进「个人要求」（2026-10-29）：那里写着「所有选题必须围绕」，方向的「范围」原话一填进去，
    // 整批选题都被锁在同一个软话题上（线上 5 条全围着「花钱买衣服为什么买单」转）。
    // 方向原文已经作为「方向种子」在参考内容里，核心目的照样守住；个人要求只留给编导自己写的话
    setPersonalRequirement('');
  });
  // 和助理共用同一个算法（lib/boards/topic-query），同样的输入得到同样的创作设置
  const currentSettings = topicCreationSettings({
    keyword1, personalRequirement, sourceReference, selectedPlatforms, selectedTracks, selectedContentTypes, selectedStyles,
    selectedElements, selectedDealReasons, topicRole, topicCount, tactic, autoSettings: autoSetup.settings, creatorContext,
  });

  // 配比按哪个档案算：快速模式选的那个，没有就用侧边栏当前档案
  const mixProfile = (profiles.find((p) => p.id === selectedProfileId) ?? creatorContext.profile ?? null) as Record<string, unknown> | null;
  // 所选的爆款元素里，有不适用于这个档案行业的，页面上明说，不然会变成「选了却用不上」（2026-10-27）
  const elementNote = elementFitNote(selectedElements, industryKeysOf(profiles.find((p) => p.id === selectedProfileId) ?? null));
  const resolvedMix = resolveMix(mixProfile, mixOverride, personalRequirement);

  // 生成选题函数
  const handleGenerate = async () => {
    if (autoSetup.preparing || contextLoading) { notify("正在承接原方案，请稍候"); return; }
    if (!resultScope) { notify("档案正在加载，请稍后再试，还不行就刷新页面"); return; }
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
       * 2026-10-19 按板块分配（方案 D）：选题不带简报（简报会把没有依据的时间、流程带进选题），
       * 拿账号定位摘要 + 内容定位 + 行业建议 + 选题标签（板块清单 lib/context-manifest 决定）。
       */

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
      const boardQuery = buildTopicBoardQuery({
        creatorContext,
        selectedProfile: selectedProfile ?? null,
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
        dealReasonLabels: selectedDealReasons.map((id) => ALL_DEAL_REASONS.find((r) => r.id === id)?.label ?? id),
        benchmarkAccounts,
        viralCases,
        difficulty,
        withHook,
        tactic,
        route,
        routeExplicit,
        resolvedMix,
        quickTopics,
      });
      setMixUsed(boardQuery.mixUsed);
      const query = boardQuery.query;

      
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

      // 条数不够自动补写一次（lib/topic-batch）：补写也是一次生成，会扣一次额度
      const generateOnce = async () => {
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
            query,
            inputs: requestData
          })
        });

        // 带出服务端文案，额度类错误才不会被显示成「生成失败」
        if (!response.ok) await throwApiError(response);

        // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
        // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
        return readDifyStream(response, {
          onChunk: (_piece, full) => { if (isCurrent()) setResult(full); },
        });
      };
      const accumulatedText = await completeBatch(await generateOnce(), topicCount, generateOnce);

      // 撞题（标题重复）、模板标题、不符合现实的句子：精准小改后再显示和保存（lib/title-dedupe、lib/title-polish）
      const polishedText = accumulatedText ? await polishTitlesRemote(accumulatedText) : accumulatedText;
      if (isCurrent() && polishedText !== accumulatedText) setResult(polishedText);

      // 保存到历史记录
      if (accumulatedText) {
        const response = await postSafely("/api/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_data: requestData,
            result: polishedText
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                  ? `已选 ${selectedElements.length} 个，每条用 ${elementsPerTopic(difficulty)} 个，轮流用到各条上`
                  : `不选就从八个里挑，每条用 ${elementsPerTopic(difficulty)} 个（由下面的创意难度定）`
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
              {elementNote && <p className="mt-1.5 text-[11.5px] text-amber-700 dark:text-amber-400">{elementNote}</p>}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
              <div className="mt-1 flex justify-end">
                <VoiceInputButton onText={(t) => setPersonalRequirement((prev) => appendTranscript(prev, t))} />
              </div>
            </Field>

            {/* 评论区 → 选题（体检 F1）：挑出观众反复问的问题，放进上面的个人要求 */}
            <div className="mt-3">
              <CommentQuestions onPick={(text) => setPersonalRequirement((prev) => (prev ? `${prev}\n${text}` : text))} />
            </div>
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
          "爆款元素每条用几个由创意难度定，不适用于当前行业的会自动不用",
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
