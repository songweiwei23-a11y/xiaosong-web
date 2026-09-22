"use client";

import { useRouter } from "next/navigation";
import { putHandoff, parseTopicOptions } from "@/lib/handoff";
import { throwApiError } from "@/lib/api-error";
import { createWork } from "@/lib/works";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { extractStrategySummary } from '@/lib/positioning-utils';



import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { Lightbulb, Loader2, TrendingUp, Users, Target, Sparkles, Grid3x3, Zap, Heart, DollarSign, Eye, Flame, Copy, Download, History, MessageCircle, Trash2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

  // 高级设置
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [benchmarkAccounts, setBenchmarkAccounts] = useState("");
  const [viralCases, setViralCases] = useState("");
  const [topicCount, setTopicCount] = useState(10);
  const [withHook, setWithHook] = useState(true);
  const [difficulty, setDifficulty] = useState("中等创意");
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
  const contentTypes = ["教知识型", "晒过程型", "聊观点型", "讲故事型", "测评型", "探店型", "剧情型", "混剪型"];
  const styles = [
"专业严谨", "活泼亲和", "犀利直接", "温暖治愈",
"幽默搞笑", "高冷范儿", "接地气", "文艺清新",
"热血激情", "佛系淡定", "反差萌", "知性优雅"
  ];

  const explosiveElements = [
    { id: "cost", label: "💰 成本", desc: "价格/金额/省钱", icon: DollarSign, zhName: "成本" },
    { id: "people", label: "👥 人群", desc: "特定身份", icon: Users, zhName: "人群" },
    { id: "celebrity", label: "⭐ 头牌", desc: "名人/名牌", icon: Sparkles, zhName: "头牌" },
    { id: "weird", label: "🤪 奇葩", desc: "反常识/猎奇", icon: Zap, zhName: "奇葩" },
    { id: "worst", label: "👎 最差", desc: "极端负面", icon: Target, zhName: "最差" },
    { id: "contrast", label: "⚡ 反差", desc: "身份对比", icon: Eye, zhName: "反差" },
    { id: "nostalgia", label: "📼 怀旧", desc: "年代感", icon: Heart, zhName: "怀旧" },
    { id: "hormone", label: "🔥 荷尔蒙", desc: "吸引力", icon: Flame, zhName: "荷尔蒙" },
  ];

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
      const topicType = selectedDealReasons.length > 0 ? "变现选题" : "大流量选题";
      
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
      
      const requestData = {
        mode: mode,
        topicType: topicType,
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
        elements: selectedElements.map(id => {
          const element = explosiveElements.find(e => e.id === id);
          return element ? element.zhName : id;
        }).join("、"),
        dealReasons: selectedDealReasons.map(id => {
          const reason = ALL_DEAL_REASONS.find(r => r.id === id);
          return reason ? reason.label : id;
        }).join("、"),
        keywords: [keyword1, keyword2, keyword3].filter(k => k).join("、"),
        benchmarkAccounts: benchmarkAccounts,
        viralCases: viralCases,
        topicCount: topicCount,
        difficulty: difficulty,
        withHook: withHook
      };

      // 构建详细的prompt
      let query = `【工作任务】生成${topicCount}条${topicType}\n\n`;
      query += `🚨 核心原则：可落地、低成本、易执行\n`;
      query += `- 拍摄方式：手机即可，不需要专业设备\n`;
      query += `- 人员配置：一个人就能拍，不需要团队或演员\n`;
      query += `- 场景要求：日常场景（店内/家里），避免凌晨拍摄、多场景切换\n`;
      query += `- 道具要求：日常道具，避免复杂道具\n`;
      query += `- 真实性：基于真实场景，不能天马行空或过度夸张\n\n`;

      // 模式说明
      if (mode === "quick") {
        query += `【模式】⚡ 快速模式（使用已保存的档案和定位）\n\n`;
        
        if (profileInfo) {
          query += `【个人档案详情】\n`;
          query += `- 档案名称：${profileInfo.档案名称 || '未设置'}\n`;
          query += `- 平台：${profileInfo.平台 || '未设置'}\n`;
          query += `- 赛道：${profileInfo.赛道 || '未设置'}\n`;
          query += `- 账号阶段：${profileInfo.账号阶段 || '未设置'}\n`;
          query += `- 粉丝量级：${profileInfo.粉丝量级 || '未设置'}\n`;
          query += `- 目标年龄：${profileInfo.目标年龄 || '未设置'}\n`;
          query += `- 目标性别：${profileInfo.目标性别 || '未设置'}\n`;
          query += `- 目标职业：${profileInfo.目标职业 || '未设置'}\n`;
          query += `- 目标痛点：${profileInfo.目标痛点 || '未设置'}\n`;
          query += `- 目标需求：${profileInfo.目标需求 || '未设置'}\n`;
          query += `- 内容类别：${profileInfo.内容类别 || '未设置'}\n`;
          query += `- 内容风格：${profileInfo.内容风格 || '未设置'}\n`;
          query += `- 内容形式：${profileInfo.内容形式 || '未设置'}\n`;
          query += `- 内容价值：${profileInfo.内容价值 || '未设置'}\n`;
          query += `- 独特卖点：${profileInfo.独特卖点 || '未设置'}\n\n`;
        }
        
        if (positioningInfo && (positioningInfo.选题摘要 || positioningInfo.完整定位内容)) {
          // 优先使用strategy_summary（选题专用摘要），如果没有则从full_content提取
          const relevantInfo = positioningInfo.选题摘要 || extractStrategySummary(positioningInfo.完整定位内容 || "");
          query += `💡 提示：以上是从完整定位方案中提取的选题相关关键信息\n\n`;
        }
      } else {
        query += `【模式】🎨 自定义模式（手动填写）\n\n`;
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
        query += `\n💡 【关键】脚本类型 vs 流量/变现的关系：\n`;
        query += `- 脚本类型 = 视频结构（怎么讲故事）\n`;
        query += `- 流量/变现 = 内容方向（讲什么内容）\n`;
        query += `- 同一脚本类型可同时服务于流量型和变现型\n`;
        query += `- 例如教知识型：流量用爆款元素（《20块vs200块的肥牛差在哪》），变现用成交理由（《排酸牛肉怎么看好坏？老板教你3招》）\n\n`;
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

      // 创意元素
      query += `【创意元素】\n`;
      if (selectedElements.length > 0) {
        const elementsText = selectedElements.map(id => {
          const element = explosiveElements.find(e => e.id === id);
          return element ? element.zhName : id;
        }).join('、');
        query += `- 八大爆款元素：${elementsText}\n`;
      }
      
      // 成交理由（重要：区分变现和流量选题）
      if (selectedDealReasons.length > 0) {
        const dealReasonsText = selectedDealReasons.map(id => {
          const reason = ALL_DEAL_REASONS.find(r => r.id === id);
          return reason ? reason.label : id;
        }).join('、');
        query += `- 成交理由：${dealReasonsText}\n`;
        query += `\n⚠️ 重要提示：这是【变现选题】，每条选题必须围绕选中的成交理由设计！\n`;
        query += `- 选题标题要直接体现成交理由\n`;
        query += `- 内容方向要围绕成交理由拍摄\n`;
        query += `- 编导思路要服务于成交理由的说服力\n\n`;
      } else {
        query += `\n⚠️ 重要提示：这是【大流量选题】，目标是涨粉和曝光！\n`;
        query += `- 核心手段：使用八大爆款元素（成本、反差、荷尔蒙、猎奇等）\n`;
        query += `- 内容特征：话题性强、容易引发讨论、追热点、做对比\n`;
        query += `- 不考虑转化，纯粹为了播放量和传播\n`;

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
      query += `【创新要求】🎨 重要！\n`;
      query += `- ⚡ 追求新颖角度，避免常见套路和老梗\n`;
      query += `- 🎯 每条选题都要有独特的切入点\n`;
      query += `- 💡 结合当前热点、时事、流行文化\n`;
      query += `- 🔥 创造记忆点，让人眼前一亮\n\n`;

      query += `【输出格式要求】\n`;
      query += `每条选题必须包含以下7个部分：\n\n`;
      query += `## 选题X：[标题]\n\n`;
      query += `**1️⃣ 爆款元素**\n`;
      if (selectedElements.length > 0) {
        const elementsText = selectedElements.map(id => {
          const element = explosiveElements.find(e => e.id === id);
          return element ? element.zhName : id;
        }).join('、');
        query += `使用2-3个元素（从${elementsText}中选择）及应用方式\n\n`;
      } else {
        query += `使用2-3个元素及应用方式\n\n`;
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
      query += `**4️⃣ 编导思路**\n`;
      query += `起承转合（每项最多10字）：\n`;
      query += `起-开场/承-展开/转-高潮(X秒)/合-收尾CTA\n\n`;
      query += `**5️⃣ 推荐脚本结构**\n`;
      query += `从19种结构中推荐3个（按推荐度⭐⭐⭐⭐⭐→⭐⭐⭐排序）：\n`;
      query += `解题/推荐/揭秘/案例/火车节/论证/故事/对比/清单/时间线/问答/情景剧/测评/挑战/教程/反转/盘点/采访/观察\n`;
      query += `格式：序号.结构名(星级)-理由(最多8字)\n\n`;
      query += `**6️⃣ 执行要点**\n`;
      query += `⚠️ 必须可落地：手机拍、一个人、低成本\n`;
      query += `难度/资源/注意事项（每项最多10字）\n\n`;
      
      if (selectedDealReasons.length > 0) {
        const dealReasonsText = selectedDealReasons.map(id => {
          const reason = ALL_DEAL_REASONS.find(r => r.id === id);
          return reason ? reason.label : id;
        }).join('、');
        query += `**7️⃣ 成交理由**\n`;
        query += `⚠️ 必须包含转化路径设计！\n`;
        query += `- 体现的理由：[从${dealReasonsText}中选2-3个]\n`;
        query += `- 转化路径：[观看→互动→到店/购买，最多15字]\n\n`;
      }
      
      query += `---\n\n`;
      query += `\n⚠️ 核心要求（必须严格遵守）：\n`;
      query += `🎯 可落地性原则：\n`;
      query += `- 生成的选题必须100%可执行，不能天马行空\n`;
      query += `- 拍摄成本要低：手机即可，不需要专业设备\n`;
      query += `- 简单易上手：个体老板一个人就能拍，不需要团队\n`;
      query += `- 贴合现实：基于真实场景，不能太夸张\n`;
      query += `- 避免：凌晨拍摄、需要演员、复杂道具、多场景切换\n\n`;
      query += `📋 具体要求：\n`;
      query += `1. 开篇钩子：只写文案，不要画面描述！必须结合知识库优化\n`;
      query += `2. 内容方向及目的是重中之重：核心方向一句话，用户价值要明确\n`;
      query += `3. 每条选题必须包含2-3个爆款元素\n`;
      if (selectedDealReasons.length > 0) {
        query += `4. 成交理由必须包含转化路径（最多15字）\n`;
      }
      query += `${selectedDealReasons.length > 0 ? '5' : '4'}. 编导思路要简洁，让编导一看就懂框架\n`;
      query += `${selectedDealReasons.length > 0 ? '6' : '5'}. 推荐脚本结构从19种中选3个，按推荐度排序\n`;
      query += `${selectedDealReasons.length > 0 ? '7' : '6'}. 每条选题严格控制在200字以内！去废话！\n`;

      
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

          {mode === "quick" && (
            <CollapsibleSection title="选择档案" defaultOpen>
              <Field label="个人档案" required>
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleProfileSelect(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">选择档案</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.profile_name || "未命名档案"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="账号定位" required>
                <select
                  value={selectedPositioningId}
                  onChange={(e) => handlePositioningSelect(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">选择定位</option>
                  {positionings.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.positioning_name || "未命名定位"}
                    </option>
                  ))}
                </select>
              </Field>
            </CollapsibleSection>
          )}

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
              label="成交理由"
              optional
              stacked
              hint={
                selectedDealReasons.length > 0
                  ? `已选 ${selectedDealReasons.length} 个，选题标题会体现这些点`
                  : "不选就是纯流量选题，不涉及变现"
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

          <button onClick={handleGenerate} disabled={isGenerating} className={PRIMARY_BTN}>
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
          "填了成交理由，选题会往变现上靠",
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
              });
              router.push("/dashboard/script");
            },
          },
        ]}
      />

      <HistoryPanel
        items={history}
        title="历史选题"
        showStats={false}
        onLoad={(item) => setResult(item.result)}
        onContinue={(item) => openContinuousDialog(item.result)}
        onDelete={(id) => deleteHistory(id)}
      />

      <ContinuousDialog
        isOpen={showDialog}
        onClose={closeContinuousDialog}
        initialContent={dialogInitialContent}
        taskType="选题策划"
      />
    </WorkspaceLayout>
  );
}
