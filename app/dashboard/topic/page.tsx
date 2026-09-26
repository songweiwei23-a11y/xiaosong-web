"use client";

import { useRouter } from "next/navigation";
import { putHandoff, takeHandoff, parseTopicOptions } from "@/lib/handoff";
import { GROWTH_TACTICS } from "@/lib/growth-tactics";
import { VIRAL_ELEMENTS, viralElementById, viralElementPrompt } from "@/lib/viral-elements";
import { tacticBrief, tacticsBlockedBy } from "@/lib/growth-standards";
import { CONTENT_ROLE_LIST, ROLE_SPECS, rolesGuide, roleBrief, type ContentRole } from "@/lib/content-roles";
import { ROUTE_LIST, ROUTE_HINTS, ROUTES_GUIDE, routeAssignment, tacticIndex, tacticInText, topicTacticsOf, type CreativeRoute } from "@/lib/creative-routes";
import { throwApiError } from "@/lib/api-error";
import { createWork, listWorks, type Work } from "@/lib/works";
import { stageRoute, workStageUrl } from "@/lib/resume";
import { TopicList, type TopicStage } from "@/components/workspace/TopicList";
import { TopicLibrary } from "@/components/workspace/TopicLibrary";
import { splitTopicSections, removeTopicSection, batchBelongsToProfile } from "@/lib/topic-library";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, GENERATE_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { ContextBadge } from "@/components/workspace/ContextBadge";
import { extractStrategySummary } from '@/lib/positioning-utils';
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { buildContextBlock, describeExecutionConstraints, describeRestrictions, type CreatorProfile } from '@/lib/creator-context';
import { getActiveProfileId, setActiveProfileId, onActiveProfileChange } from '@/lib/active-profile';



import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { Lightbulb, Loader2, TrendingUp, Users, Target, Sparkles, Grid3x3, Zap, Heart, DollarSign, Eye, Flame, Copy, Download, History, MessageCircle, Trash2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

// 静态配置与类型已抽离
import { ALL_DEAL_REASONS } from './constants';
import type { TopicHistory, Profile, Positioning } from './types';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';

export default function TopicPage() {
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
  } = useGenerationPage({ taskType: '选题策划', historyApiPath: '/api/topics' });

  const router = useRouter();

  // 创作简报从这里来。之前这一页自己手拼 ctx，漏了 brief，
  // 结果注入字数最多、有用的最少
  const { context: creatorContext } = useCreatorContext();

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

  // 高级设置
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [benchmarkAccounts, setBenchmarkAccounts] = useState("");
  const [viralCases, setViralCases] = useState("");
  const [topicCount, setTopicCount] = useState(10);
  const [withHook, setWithHook] = useState(true);
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
  /** 已有的作品，给选题清单标出"已在做"的那几条 */
  const [works, setWorks] = useState<Work[]>([]);
  useEffect(() => {
    listWorks(50).then(setWorks);
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
    putHandoff({
      from: "选题策划",
      topic: title,
      workId: workId ?? undefined,
      tab: stage === "开篇钩子" ? "opening" : undefined,
      // 打法跟着选题一路走，脚本才能按这一计的结构公式排。
      // 没整批指定时，看这一条自己标的是哪一计
      tactic: tactic || tacticInText(body ?? "") || undefined,
      note:
        stage === "脚本生成" && body
          ? `选题策划时定下的方案，照这个方向写：\n${body.slice(0, 1500)}`
          : undefined,
    });
    router.push(workId ? workStageUrl(workId, stage) : stageRoute(stage));
  };
  const [personalRequirement, setPersonalRequirement] = useState("");

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult);

  // 折叠状态
  const [isBasicOpen, setIsBasicOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 选项数据
  const accountStages = ["刚起号，定位未确定", "有定位，需要内容方向", "稳定运营，需要新选题", "遇到瓶颈，需要突破"];
  const fansLevels = ["0-1000", "1000-1万", "1-5万", "5-10万", "10万+"];
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
  // 档案选择处理
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = profiles.find((p) => p.id === profileId);
    // 在这儿换档案，侧边栏和其他板块也要跟着换，否则又变成两套
    if (profileId) setActiveProfileId(profileId, profile);
    if (profile && mode === "quick") {
      // 自动填充
      if (profile.account_track && profile.account_track.length > 0) {
        setSelectedTracks(profile.account_track);
      }
      if (profile.content_style && profile.content_style.length > 0) {
        setSelectedStyles(profile.content_style);
      }
      if (profile.account_platform && profile.account_platform.length > 0) {
        setSelectedPlatforms(profile.account_platform);
      }
      if (profile.account_stage) {
        setAccountStage(profile.account_stage);
      }
      if (profile.fans_level) {
        setFansLevel(profile.fans_level);
      }
    }
  };

  // 定位选择处理
  const handlePositioningSelect = (positioningId: string) => {
    setSelectedPositioningId(positioningId);
    const positioning = positionings.find((p) => p.id === positioningId);
    if (positioning && mode === "quick") {
      // 优先使用 strategy_summary（选题专用摘要），没有则从 full_content 提取。
      //
      // 这里原先一律截到 300 字再补上「...」。账号定位平均生成 2000 字以上，
      // 300 字大概只够一句赛道分析的开头——用户以为定位在指导选题，
      // 实际传过去的只是个头。摘要本身已经滤掉了执行层细节（配比、拍摄方向、
      // 15天计划），剩下的赛道、人群、优势、差异化正是选题要用的，不该再砍。
      //
      // 仍留一个上限，但放到足以容纳整份摘要的量级，只防异常长文把提示词撑爆。
      const MAX_POSITIONING_CHARS = 2000;
      const clip = (text: string) =>
        text.length > MAX_POSITIONING_CHARS
          ? text.slice(0, MAX_POSITIONING_CHARS) + "…（后续内容已省略）"
          : text;

      if (positioning.strategy_summary) {
        setPositioningExtra(clip(positioning.strategy_summary));
      } else if (positioning.full_content) {
        // 兼容旧数据：没有摘要时现场从完整定位里提取
        setPositioningExtra(clip(extractStrategySummary(positioning.full_content)));
      }
    }
  };

  // AI推荐风格
  const recommendStyles = () => {
    let recommended: string[] = [];
    if (accountStage === '刚起号，定位未确定') {
      recommended = ["活泼亲和", "接地气"];
    } else if (accountStage === '有定位，需要内容方向') {
      recommended = ["专业严谨", "活泼亲和"];
    } else if (accountStage === '稳定运营，需要新选题') {
      recommended = ["温暖治愈", "幽默搞笑"];
    } else if (accountStage === '遇到瓶颈，需要突破') {
      recommended = ["犀利直接", "反差萌"];
    }
    setSelectedStyles(recommended);
    notify(`✨ 已推荐：${recommended.join('、')}`);
  };

  // AI推荐难度
  const recommendDifficulty = () => {
    let recommended = "中等创意";
    if (accountStage === "刚起号，定位未确定") {
      recommended = "简单易懂";
    } else if (accountStage === "有定位，需要内容方向") {
      recommended = "中等创意";
    } else if (accountStage === "稳定运营，需要新选题") {
      recommended = "中等创意";
    } else if (accountStage === "遇到瓶颈，需要突破") {
      recommended = "高难创新";
    }
    setDifficulty(recommended);
    notify(`✨ 已推荐难度：${recommended}`);
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadProfiles();
    loadPositionings();
    loadHistory();
    // 起号页带过来的打法
    const handed = takeHandoff();
    if (handed?.tactic) setTactic(handed.tactic);
    // 用户在侧边栏切了档案，这一页不刷新也要跟上
    return onActiveProfileChange(() => {
      const id = getActiveProfileId();
      if (id) setSelectedProfileId(id);
    });
  }, []);

  // 生成选题函数
  const handleGenerate = async () => {
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
        benchmarkAccounts: benchmarkAccounts,
        viralCases: viralCases,
        topicCount: topicCount,
        difficulty: difficulty,
        withHook: withHook,
        // 复盘要按打法统计样本数，所以每条记录都要留下用的是哪一计
        tactic: tactic || undefined,
      };

      // 构建详细的prompt
      let query = `【工作任务】生成${topicCount}条${topicType}\n\n`;
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
        query += `\n【这批选题的目的】流量型、人设型、变现型按配比搭配\n`;
        query += `- 按上面账号定位里定好的配比分配这 ${topicCount} 条；没有定位的，按账号阶段来（起号期流量型最多，变现型从第一周就有但占小头）\n`;
        query += `- 每条只担一个主目的，在选题里标明\n\n`;
        query += `${rolesGuide()}\n\n`;
      } else {
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
        query += `${routeAssignment(route, topicCount)}\n\n${ROUTES_GUIDE}\n\n`;
        if (route !== '四大脚本') {
          const blocked = tacticsBlockedBy(
            [selectedProfile?.content_restrictions, selectedProfile?.avoid_content].filter(Boolean).join('\n')
          );
          query += `${tacticIndex({ roles: topicRole === '按配比' ? undefined : [topicRole], exclude: blocked })}\n\n`;
          if (blocked.length) query += `⛔ 这几计和账号禁忌冲突，已从清单拿掉，不要用：${blocked.join('、')}\n\n`;
        }
      }

      query += `【创新要求】🎨 重要！\n`;
      query += `- ⚡ 追求新颖角度，避免常见套路和老梗\n`;
      query += `- 🎯 每条选题都要有独特的切入点\n`;
      query += `- 💡 结合当前热点、时事、流行文化\n`;
      query += `- 🔥 创造记忆点，让人眼前一亮\n\n`;

      query += `【选题三关】（小黄第17节）每条都要过：覆盖的人够不够多、给了什么明确价值、是不是比用户多一步认知\n\n`;
      query += `【输出格式要求】\n`;
      query += `每条选题必须包含以下部分：\n\n`;
      query += `## 选题X：[标题]\n\n`;
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
      query += `**2️⃣ 开篇钩子（重要！）**\n`;
      query += `⚠️ 必须结合本地知识库和现有知识库优化，3秒内抓住注意力\n`;
      query += `⚠️ 只写文案，不要写画面描述！\n`;
      query += `- 第1秒：[开场文案/悬念]\n`;
      query += `- 第2秒：[冲突/好奇]\n`;
      query += `- 第3秒：[钩子/承诺]\n\n`;
      query += `**3️⃣ 内容方向及目的（重中之重！）**\n`;
      query += `⚠️ 这是整个选题的核心，决定视频成败\n`;
      query += `- 核心内容方向：[这条视频到底要讲什么？用1句话说清楚]\n`;
      query += `- 关键画面（3个）：[必拍的3个核心画面]\n`;
      query += `- 场景设置：[在哪拍？什么环境？]\n`;
      query += `- 拍摄目的：[为什么这样拍？想达到什么效果？]\n`;
      query += `- 用户价值：[用户看完能获得什么？]\n\n`;
      query += `**4️⃣ 脚本结构**\n`;
      /*
       * 原来是"从 19 种结构中推荐 3 个"：解题/推荐/揭秘/案例/火车节/论证/故事/对比/清单/
       * 时间线/问答/情景剧/测评/挑战/教程/反转/盘点/采访/观察——大半是知识库里没有的
       * 通用词，而且跟这条视频的目的无关。现在从目的对应的结构里挑（知识库原文）。
       */
      query += `从这条目的对应的结构里挑 1 个最合适的（见上面「三种视频」），写出骨架套到这条上是什么样（每段最多10字）。\n`;
      query += `用 36 计的：计的公式管事件怎么走，这里的结构管话怎么讲，两者叠加；纯按计的公式拍、不另套结构的，写"按计的公式走"\n\n`;
      query += `**5️⃣ 结尾行动指令**\n`;
      query += `只写一个，按目的来：流量型要关注或评论，人设型要关注或看主页，变现型要私信、到店或留资中的一个\n\n`;
      query += `**6️⃣ 执行要点**\n`;
      query += `⚠️ 必须可落地：手机拍、一个人、低成本\n`;
      query += `难度/资源/注意事项（每项最多10字）\n\n`;
      
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
      query += `📋 具体要求：\n`;
      query += `1. 开篇钩子：只写文案，不要画面描述！必须结合知识库优化\n`;
      query += `2. 内容方向及目的是重中之重：核心方向一句话，用户价值要明确\n`;
      query += `3. 每条都写「🅰 打法」；用 36 计的，计名和清单一字不差，公式要落在事件上，不是只在标题提一句\n`;
      query += `4. 每条只担一个目的；脚本结构和结尾行动指令都按目的来，结尾指令只要一个\n`;
      query += `5. 变现型选题必须写成交理由和转化路径（最多15字）\n`;
      query += `6. 每条选题严格控制在220字以内！去废话！\n`;

      
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

      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 见 script 页同处说明：taskType 决定检索提示词、会话隔离与用量归属。
          // 后端检测到已有 query 时会沿用这里拼好的完整提示词，不再自行拼装。
          taskType: "选题策划",
          // 记忆按档案隔离，避免代运营时多个账号的上下文互相串台。
          profileId: selectedProfileId || null,
          query: query,
          inputs: requestData
        })
      });

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) await throwApiError(response);

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      const accumulatedText = await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
      });

      // 保存到历史记录
      if (accumulatedText) {
        const response = await fetch("/api/topics", {
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
      }

    } catch (error: any) {
      console.error("生成失败:", error);
      notify(error?.message || "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="选题策划" subtitle="结合账号定位与爆款元素，一次给出多条可直接拍的选题" />

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
                    {tracks.map((t) => (
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
                    {styles.map((s) => (
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
              hint={tactic ? `已指定第 ${GROWTH_TACTICS.find((t) => t.name === tactic)?.no} 计，整批都按它拍` : ROUTE_HINTS[route]}
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
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopicCount(n)}
                    aria-pressed={topicCount === n}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      topicCount === n
                        ? "bg-primary/20 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n} 条
                  </button>
                ))}
              </div>
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

          <button onClick={handleGenerate} disabled={isGenerating} className={GENERATE_BTN}>
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

              putHandoff({
                from: "选题策划",
                topicOptions: options,
                topic: options.length === 1 ? options[0] : undefined,
                workId,
                // 打法跟着选题一路走到脚本，脚本才能按这一计的结构公式排
                tactic: tactic || (options.length === 1 ? tacticInText(body) : undefined),
                // 每条各自标的是哪一计：到脚本页挑中哪条，就自动带上那一条的计
                topicTactics: tactic ? undefined : topicTacticsOf(body),
              });
              router.push("/dashboard/script");
            },
          },
          {
            // 选题定了就能先想开头——开头决定这条片子的生死，
            // 而且想清楚开头再写正文，脚本会顺得多
            label: "设计开篇",
            icon: Sparkles,
            onClick: (body) => {
              const options = parseTopicOptions(body);
              putHandoff({
                from: "选题策划",
                // 整批都带过去，让他在开篇页自己挑给哪条写开头。
                // 只带第一条的话，等于替他做了选择——而这一批本来就是给他挑的
                topicOptions: options,
                topic: options[0] || "",
                tab: "opening",
                tactic: tactic || undefined,
              });
              router.push("/dashboard/growth");
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
