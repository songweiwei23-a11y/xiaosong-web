"use client";

import { extractStrategySummary } from '@/lib/positioning-utils';


import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { Lightbulb, Loader2, TrendingUp, Users, Target, Sparkles, Grid3x3, Zap, Heart, DollarSign, Eye, Flame, Copy, Download, History, MessageCircle, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

// 静态配置与类型已抽离
import { ALL_DEAL_REASONS } from './constants';
import type { TopicHistory, Profile, Positioning } from './types';

export default function TopicPage() {
  // 模式控制
  const [mode, setMode] = useState("custom"); // "quick" 或 "custom"

  // 档案和定位
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [positionings, setPositionings] = useState<Positioning[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPositioningId, setSelectedPositioningId] = useState("");

  // 历史记录
  const [topicHistory, setTopicHistory] = useState<TopicHistory[]>([]);

  // 持续对话
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInitialContent, setDialogInitialContent] = useState("");

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

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");

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

  // 加载历史记录
  const loadTopicHistory = async () => {
    try {
      const response = await fetch("/api/topics");
      const data = await response.json();
      // API直接返回数组
      if (Array.isArray(data)) {
        setTopicHistory(data);
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  };

  // 删除历史记录
  const deleteHistory = async (id: string) => {
    if (!await confirmDialog('确定要删除这条记录吗？', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;
    try {
      const response = await fetch(`/api/topics?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadTopicHistory();
      }
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  // 打开持续对话
  const openContinuousDialog = (content: string) => {
    setDialogInitialContent(content);
    setShowDialog(true);
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
      // 优先使用strategy_summary（选题专用摘要），如果没有则从full_content提取
      if (positioning.strategy_summary) {
        // 使用已生成的选题摘要（干净、无执行细节）
        setPositioningExtra(positioning.strategy_summary.substring(0, 300) + "...");
      } else if (positioning.full_content) {
        // 兼容旧数据：如果没有strategy_summary，使用过滤后的内容
        const filtered = extractStrategySummary(positioning.full_content);
        setPositioningExtra(filtered.substring(0, 300) + "...");
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
    loadTopicHistory();
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
        // 再次过滤positioningExtra，确保不包含内容配比等信息
        const filteredExtra = extractRelevantPositioningInfo(positioningExtra);
        query += `- 定位补充：${filteredExtra}\n`;
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

      
      // 🔥 最终过滤：强制移除"内容方向与配比"及相关段落
      const removeKeywords = [
        '## 💎 内容方向与配比',
        '### 当前阶段推荐配比',
        '### 流量型内容',
        '### 变现型内容', 
        '### 人设型内容',
        '**拍摄方向思路**',
        '**目的**：快速涨粉',
        '**目的**：引导本地用户',
        '**目的**：让用户记住你',
        '**必须体现的成交理由**',
        '**转化路径**：视频最后'
      ];
      
      let filteredQuery = '';
      let skipSection = false;
      const queryLines = query.split('\n');
      
      for (let i = 0; i < queryLines.length; i++) {
        const line = queryLines[i];
        
        // 检查是否命中移除关键词
        const shouldRemove = removeKeywords.some(kw => line.includes(kw));
        
        if (shouldRemove) {
          skipSection = true;
          continue;
        }
        
        // 遇到新的##或###标题，且不在移除列表中，结束跳过
        if ((line.startsWith('##') || line.startsWith('###')) && skipSection) {
          if (!removeKeywords.some(kw => line.includes(kw))) {
            skipSection = false;
          }
        }
        
        // 如果不在跳过状态，保留这一行
        if (!skipSection) {
          filteredQuery += line + '\n';
        }
      }
      
      query = filteredQuery;
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          inputs: requestData
        })
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
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
                  accumulatedText += data.answer;
                  setResult(accumulatedText);
                }
              } catch (e) {
                console.error("解析错误:", e);
              }
            }
          }
        }
      }

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
          await loadTopicHistory();
        }
      }

    } catch (error) {
      console.error("生成失败:", error);
      notify("生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50">
      
      {/* 左侧输入面板 */}
      <div className="w-[580px] bg-card shadow-2xl p-6 space-y-5 overflow-y-auto">
        
        <h1 className="text-2xl font-bold text-orange-600 mb-4">✨ 选题策划工作台</h1>

        {/* 模式切换 */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 border border-orange-200">
          <label className="block text-sm font-semibold text-foreground mb-3">选择模式</label>
          <div className="flex gap-3">
            <button
              onClick={() => setMode("quick")}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === "quick"
                  ? "bg-orange-500 text-white shadow-lg"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              }`}
            >
              ⚡ 快速模式
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === "custom"
                  ? "bg-orange-500 text-white shadow-lg"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              }`}
            >
              🎨 自定义模式
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {mode === "quick" ? "快速模式：选择档案和定位快速填充" : "自定义模式：手动填写所有字段"}
          </p>
        </div>

        {/* 快速模式：档案和定位选择 */}
        {mode === "quick" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">👤 个人档案</label>
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileSelect(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">-- 选择档案 --</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profile_name || `${profile.account_track?.[0] || '未命名'} - ${profile.account_stage || '新档案'}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">🎯 账号定位</label>
              <select
                value={selectedPositioningId}
                onChange={(e) => handlePositioningSelect(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">-- 选择定位 --</option>
                {positionings.map((positioning) => (
                  <option key={positioning.id} value={positioning.id}>
                    {positioning.positioning_name || '未命名定位'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 基础设置（可折叠） */}
        <div className="border border-border rounded-lg">
          <button
            onClick={() => setIsBasicOpen(!isBasicOpen)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors rounded-t-lg"
          >
            <span className="font-semibold text-foreground">📝 基础设置</span>
            {isBasicOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>

          {isBasicOpen && (
            <div className="px-4 pb-4 space-y-4 border-t">
              
              {/* 账号阶段 */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-foreground mb-2">账号阶段</label>
                <select
                  value={accountStage}
                  onChange={(e) => setAccountStage(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- 选择阶段 --</option>
                  {accountStages.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              {/* 粉丝级别 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">粉丝级别</label>
                <select
                  value={fansLevel}
                  onChange={(e) => setFansLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- 选择级别 --</option>
                  {fansLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* 平均播放量 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">平均播放量</label>
                <input
                  type="text"
                  value={avgViewsInput}
                  onChange={(e) => setAvgViewsInput(e.target.value)}
                  placeholder="例如：5000"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* 平台选择 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">平台（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      onClick={() => toggleSelection(platform, selectedPlatforms, setSelectedPlatforms)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        selectedPlatforms.includes(platform)
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "bg-card border-border text-foreground hover:border-orange-300"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* 赛道选择 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">赛道（可多选）</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {tracks.map((track) => (
                    <button
                      key={track}
                      onClick={() => toggleSelection(track, selectedTracks, setSelectedTracks)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${
                        selectedTracks.includes(track)
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "bg-card border-border text-foreground hover:border-orange-300"
                      }`}
                    >
                      {track}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内容类型 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">内容类型（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {contentTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleSelection(type, selectedContentTypes, setSelectedContentTypes)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        selectedContentTypes.includes(type)
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "bg-card border-border text-foreground hover:border-orange-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 风格选择 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">风格（可多选）</label>
                  <button
                    onClick={recommendStyles}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ✨ AI推荐
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {styles.map((style) => (
                    <button
                      key={style}
                      onClick={() => toggleSelection(style, selectedStyles, setSelectedStyles)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${
                        selectedStyles.includes(style)
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "bg-card border-border text-foreground hover:border-orange-300"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* 定位补充 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">定位补充说明</label>
                <textarea
                  value={positioningExtra}
                  onChange={(e) => setPositioningExtra(e.target.value)}
                  rows={2}
                  placeholder="补充说明账号定位、特色、目标..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

            </div>
          )}
        </div>

        {/* 八大爆款元素 */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">✨ 八大爆款元素（可多选）</label>
          <div className="grid grid-cols-2 gap-2">
            {explosiveElements.map((element) => {
              const IconComponent = element.icon;
              const isSelected = selectedElements.includes(element.id);
              return (
                <button
                  key={element.id}
                  onClick={() => toggleSelection(element.id, selectedElements, setSelectedElements)}
                  className={`p-2 rounded-lg border transition-all text-left ${
                    isSelected
                      ? "bg-orange-100 border-orange-500"
                      : "bg-card border-border hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <IconComponent className={`w-4 h-4 ${isSelected ? "text-orange-600" : "text-muted-foreground"}`} />
                    <span className={`font-medium text-xs ${isSelected ? "text-orange-700" : "text-foreground"}`}>
                      {element.label}
                    </span>
                  </div>
                  <p className={`text-xs ${isSelected ? "text-orange-600" : "text-muted-foreground"}`}>
                    {element.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 17个成交理由 */}
        <div>
          <div className="mb-3">
            <label className="block text-sm font-semibold text-foreground mb-1">🎯 成交理由（可多选）</label>
            <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
              选择成交理由 = 变现选题 | 不选 = 大流量选题
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {ALL_DEAL_REASONS.map((reason) => {
              const isSelected = selectedDealReasons.includes(reason.id);
              return (
                <button
                  key={reason.id}
                  onClick={() => toggleSelection(reason.id, selectedDealReasons, setSelectedDealReasons)}
                  className={`p-2 rounded-lg border transition-all text-left ${
                    isSelected
                      ? "bg-orange-100 border-orange-500"
                      : "bg-card border-border hover:border-orange-300"
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-sm">{reason.icon}</span>
                    <span className={`font-medium text-xs ${isSelected ? "text-orange-700" : "text-foreground"}`}>
                      {reason.label}
                    </span>
                  </div>
                  <p className={`text-xs ${isSelected ? "text-orange-600" : "text-muted-foreground"}`}>
                    {reason.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 高级设置（可折叠） */}
        <div className="border border-border rounded-lg">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors rounded-t-lg"
          >
            <span className="font-semibold text-foreground">⚙️ 高级设置</span>
            {isAdvancedOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>

          {isAdvancedOpen && (
            <div className="px-4 pb-4 space-y-4 border-t">
              
              {/* 关键词组合 */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-foreground mb-2">关键词组合</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={keyword1}
                    onChange={(e) => setKeyword1(e.target.value)}
                    placeholder="关键词1"
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                  <input
                    type="text"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    placeholder="关键词2"
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                  <input
                    type="text"
                    value={keyword3}
                    onChange={(e) => setKeyword3(e.target.value)}
                    placeholder="关键词3"
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>

              {/* 竞品账号 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">竞品账号参考</label>
                <textarea
                  value={benchmarkAccounts}
                  onChange={(e) => setBenchmarkAccounts(e.target.value)}
                  rows={2}
                  placeholder="输入竞品账号..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              {/* 爆款案例 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">爆款案例参考</label>
                <textarea
                  value={viralCases}
                  onChange={(e) => setViralCases(e.target.value)}
                  rows={2}
                  placeholder="输入爆款案例..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              {/* 生成数量 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">生成数量</label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((count) => (
                    <button
                      key={count}
                      onClick={() => setTopicCount(count)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${
                        topicCount === count
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-card text-foreground border-border hover:border-orange-300"
                      }`}
                    >
                      {count}条
                    </button>
                  ))}
                </div>
              </div>

              {/* 创意难度 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">创意难度</label>
                  <button
                    onClick={recommendDifficulty}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    ✨ AI推荐
                  </button>
                </div>
                <div className="flex gap-2">
                  {["简单易懂", "中等创意", "高难创新"].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${
                        difficulty === diff
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-card text-foreground border-border hover:border-orange-300"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* 开头钩子 */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withHook}
                    onChange={(e) => setWithHook(e.target.checked)}
                    className="w-4 h-4 text-orange-500 border-border rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-foreground">
                    生成开头钩子（3秒抓住注意力）
                  </span>
                </label>
              </div>

            </div>
          )}
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full py-3 rounded-lg font-semibold text-lg transition-all ${
            isGenerating
              ? "bg-muted text-white cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600 shadow-lg"
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              正在生成...
            </span>
          ) : (
            <span>
              {selectedDealReasons.length > 0 ? "🎯 生成变现选题" : "🚀 生成大流量选题"}
            </span>
          )}
        </button>

      </div>

      {/* 右侧结果展示 */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {/* 历史记录 */}
        {topicHistory.length > 0 && (
          <div className="bg-card rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-foreground">历史选题记录</h3>
              <span className="text-sm text-muted-foreground">({topicHistory.length})</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {topicHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted rounded-lg border border-border hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">
                        {(item.result || item.content || "").substring(0, 100)}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openContinuousDialog(item.result || item.content || "")}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                        title="继续对话"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
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

        {/* 生成结果 */}
        {result ? (
          <div className="bg-card rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-orange-200">
              <h2 className="text-2xl font-bold text-orange-600">📋 生成结果</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  复制全部
                </button>
              </div>
            </div>
            <div className="prose prose-orange max-w-none">
              <ReactMarkdown 
                className="text-foreground leading-relaxed"
                components={{
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold text-foreground mt-8 mb-4 pb-2 border-b border-border" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-foreground mt-6 mb-3" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                  ul: ({node, ...props}) => <ul className="mb-4 space-y-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="mb-4 space-y-2" {...props} />,
                  li: ({node, ...props}) => <li className="ml-4" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-orange-700" {...props} />,
                  hr: ({node, ...props}) => <hr className="my-8 border-t-2 border-border" {...props} />,
                }}
              >
                {result}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Lightbulb className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">填写左侧信息，开始生成选题</p>
            </div>
          </div>
        )}

      </div>

      {/* 持续对话弹窗 */}
      <ContinuousDialog
        taskType="选题策划"
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        initialContent={dialogInitialContent}
      />

    </div>
  );
}



























































