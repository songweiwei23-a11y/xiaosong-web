"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2, AlertCircle, FileText, Sparkles, Zap, Target, Eye, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { saveGenerationHistory, incrementUsage, checkQuota } from '@/lib/history';
import { notify } from '@/components/ui/feedback';

export default function ReviewPage() {
  // 草稿内容
  const [draftContent, setDraftContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // 基础信息
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [scriptType, setScriptType] = useState("");

  // 审稿维度 - 分组多选
  const [openingChecks, setOpeningChecks] = useState<string[]>([]);
  const [structureChecks, setStructureChecks] = useState<string[]>([]);
  const [contentChecks, setContentChecks] = useState<string[]>([]);
  const [emotionChecks, setEmotionChecks] = useState<string[]>([]);
  const [actionChecks, setActionChecks] = useState<string[]>([]);

  // 优化目标 - 多选
  const [optimizationGoals, setOptimizationGoals] = useState<string[]>([]);

  // 对标参考
  const [benchmarkScript, setBenchmarkScript] = useState("");

  // 输出选项
  const [compareMode, setCompareMode] = useState(true);
  const [severityLabels, setSeverityLabels] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");

  // 选项数据
  const platforms = ["抖音", "快手", "视频号", "小红书"];
  const durations = ["15秒", "30秒", "60秒", "3分钟", "5分钟", "长视频"];
  const scriptTypes = ["教知识型", "晒过程型", "聊观点型", "讲故事型", "测评型", "探店型", "剧情型", "混剪型"];

  const openingOptions = [
    { id: "hook", label: "3秒钩子是否有力" },
    { id: "suspense", label: "是否制造悬念/好奇" },
    { id: "pain", label: "是否直接切入痛点" },
  ];

  const structureOptions = [
    { id: "logic", label: "逻辑是否清晰" },
    { id: "transition", label: "过渡是否自然" },
    { id: "emotion_flow", label: "是否有情绪起伏" },
  ];

  const contentOptions = [
    { id: "imagery", label: "是否有画面感（具体细节）" },
    { id: "colloquial", label: "是否口语化" },
    { id: "marketing", label: "是否有营销腔" },
    { id: "feeling_words", label: "是否用了感受词（很好/很棒等废话）" },
  ];

  const emotionOptions = [
    { id: "peaks", label: "是否有2-3个情绪高点" },
    { id: "progression", label: "情绪递进是否合理" },
    { id: "golden_sentence", label: "结尾是否有金句" },
  ];

  const actionOptions = [
    { id: "cta", label: "是否有明确CTA" },
    { id: "interaction", label: "是否引导互动" },
  ];

  const goalOptions = [
    "提升开头吸引力", "增强情绪共鸣", "优化口播节奏", "加强画面感",
    "去除营销腔", "增加反转惊喜", "缩短内容", "扩充内容"
  ];

  // 计算字数和预估时长
  useEffect(() => {
    const count = draftContent.length;
    setWordCount(count);
    // 按平均3字/秒计算
    const seconds = Math.ceil(count / 3);
    setEstimatedDuration(seconds);
  }, [draftContent]);

  // 多选切换
  const toggleSelection = (item: string, selected: string[], setSelected: (arr: string[]) => void) => {
    if (selected.includes(item)) {
      setSelected(selected.filter(i => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  const loadExample = () => {
    setDraftContent(`开头：你知道吗？很多人做短视频都失败了。

中间：因为他们不懂脚本结构，随便拍，没有规划。我做了3年短视频，总结了一套方法。

结尾：想学的话，关注我，下期教你。`);
  };

  const clearDraft = () => {
    setDraftContent("");
  };

  const handleGenerate = async () => {
    // 检查配额
    const remainingQuota = await checkQuota();
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("❌ 您的配额已用完，请联系管理员或升级会员");
      return;
    }

    if (!draftContent.trim()) {
      notify("请输入要审稿的草稿内容");
      return;
    }

    const allChecks = [...openingChecks, ...structureChecks, ...contentChecks, ...emotionChecks, ...actionChecks];
    if (allChecks.length === 0) {
      notify("请至少选择一个审稿维度");
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = ""; // 保存历史记录用

    // 整合审稿维度
    const reviewDimensions = [];
    if (openingChecks.length > 0) {
      reviewDimensions.push(`【开头吸引力】${openingChecks.map(id => openingOptions.find(o => o.id === id)?.label).join("、")}`);
    }
    if (structureChecks.length > 0) {
      reviewDimensions.push(`【结构完整性】${structureChecks.map(id => structureOptions.find(o => o.id === id)?.label).join("、")}`);
    }
    if (contentChecks.length > 0) {
      reviewDimensions.push(`【文案质量】${contentChecks.map(id => contentOptions.find(o => o.id === id)?.label).join("、")}`);
    }
    if (emotionChecks.length > 0) {
      reviewDimensions.push(`【情绪波点】${emotionChecks.map(id => emotionOptions.find(o => o.id === id)?.label).join("、")}`);
    }
    if (actionChecks.length > 0) {
      reviewDimensions.push(`【行动指引】${actionChecks.map(id => actionOptions.find(o => o.id === id)?.label).join("、")}`);
    }

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "审稿优化",
          draftContent,
          platform,
          duration,
          scriptType,
          reviewDimensions: reviewDimensions.join("\n"),
          optimizationGoals: optimizationGoals.join("、"),
          benchmarkScript,
          compareMode,
          severityLabels,
        }),
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        fullResult += chunk; // 同步累积
        setResult(accumulated);
      }
    } catch (error: any) {
      notify(error.message || "生成失败");
    } finally {
      setIsGenerating(false);
      
      // 保存生成历史记录
      if (fullResult && fullResult.length > 50) {
        setTimeout(async () => {
          try {
            console.log("💾 保存历史记录...", "长度:", fullResult.length);
            const inputData = { draftContent, scriptType, platform, duration };
            await saveGenerationHistory("审稿优化", inputData, fullResult);
            await incrementUsage();
            console.log("✅ 历史记录已保存");
          } catch (err) {
            console.error("⚠️ 保存失败:", err);
          }
        }, 500);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50">
      {/* 左侧输入面板 */}
      <div className="w-[600px] bg-card shadow-2xl p-6 space-y-5 overflow-y-auto">
        
        {/* 标题 */}
        <div className="text-center pb-4 border-b-2 border-green-100">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <CheckCircle className="w-7 h-7 text-green-600" />
            审稿优化
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 inline mr-1" />
            AI诊断问题 + 专业修改建议 + 完整优化版
          </p>
        </div>

        {/* 草稿输入区 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              草稿内容 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={loadExample}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                加载示例
              </button>
              <button
                onClick={clearDraft}
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                清空
              </button>
            </div>
          </div>
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder="粘贴你的脚本草稿...&#10;&#10;可以是完整脚本，也可以是片段&#10;内容越详细，审稿越精准"
            className="w-full h-48 rounded-lg border-2 border-border p-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>字数：<span className="font-bold text-foreground">{wordCount}</span> 字</span>
            <span>预估时长：<span className="font-bold text-foreground">{estimatedDuration}</span> 秒</span>
          </div>
        </div>

        {/* 基础信息 */}
        <div className="space-y-3 pt-3 border-t-2 border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" />
            基础信息
          </h3>

          {/* 平台 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">平台</label>
            <div className="grid grid-cols-4 gap-2">
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    platform === p
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 时长 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">视频时长</label>
            <div className="grid grid-cols-3 gap-2">
              {durations.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    duration === d
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 脚本类型 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">脚本类型（可选）</label>
            <div className="flex flex-wrap gap-2">
              {scriptTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setScriptType(scriptType === type ? "" : type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    scriptType === type
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-card text-muted-foreground border border-border hover:border-green-500"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 审稿维度 */}
        <div className="space-y-3 pt-3 border-t-2 border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-orange-600" />
            审稿维度（多选） <span className="text-xs font-normal text-red-500">至少选1项</span>
          </h3>

          {/* 开头吸引力 */}
          <div className="bg-red-50 rounded-lg p-3 border-2 border-red-100">
            <p className="text-xs font-bold text-red-700 mb-2">📌 开头吸引力</p>
            <div className="space-y-1.5">
              {openingOptions.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openingChecks.includes(option.id)}
                    onChange={() => toggleSelection(option.id, openingChecks, setOpeningChecks)}
                    className="rounded"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* 结构完整性 */}
          <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-2">📌 结构完整性</p>
            <div className="space-y-1.5">
              {structureOptions.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structureChecks.includes(option.id)}
                    onChange={() => toggleSelection(option.id, structureChecks, setStructureChecks)}
                    className="rounded"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* 文案质量 */}
          <div className="bg-green-50 rounded-lg p-3 border-2 border-green-100">
            <p className="text-xs font-bold text-green-700 mb-2">📌 文案质量</p>
            <div className="space-y-1.5">
              {contentOptions.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contentChecks.includes(option.id)}
                    onChange={() => toggleSelection(option.id, contentChecks, setContentChecks)}
                    className="rounded"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* 情绪波点 */}
          <div className="bg-purple-50 rounded-lg p-3 border-2 border-purple-100">
            <p className="text-xs font-bold text-purple-700 mb-2">📌 情绪波点</p>
            <div className="space-y-1.5">
              {emotionOptions.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emotionChecks.includes(option.id)}
                    onChange={() => toggleSelection(option.id, emotionChecks, setEmotionChecks)}
                    className="rounded"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* 行动指引 */}
          <div className="bg-yellow-50 rounded-lg p-3 border-2 border-yellow-100">
            <p className="text-xs font-bold text-yellow-700 mb-2">📌 行动指引</p>
            <div className="space-y-1.5">
              {actionOptions.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={actionChecks.includes(option.id)}
                    onChange={() => toggleSelection(option.id, actionChecks, setActionChecks)}
                    className="rounded"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 优化目标 */}
        <div className="space-y-3 pt-3 border-t-2 border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            优化目标（多选，可选）
          </h3>
          <div className="flex flex-wrap gap-2">
            {goalOptions.map((goal) => (
              <button
                key={goal}
                onClick={() => toggleSelection(goal, optimizationGoals, setOptimizationGoals)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  optimizationGoals.includes(goal)
                    ? "bg-yellow-600 text-white shadow-md"
                    : "bg-card text-muted-foreground border border-border hover:border-yellow-500"
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">已选择 {optimizationGoals.length} 项</p>
        </div>

        {/* 对标参考 */}
        <div className="space-y-3 pt-3 border-t-2 border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-pink-600" />
            对标参考（可选）
          </h3>
          <textarea
            value={benchmarkScript}
            onChange={(e) => setBenchmarkScript(e.target.value)}
            placeholder="粘贴一个你想对标的优质脚本...&#10;&#10;AI会参考这个脚本的优点来优化你的草稿"
            className="w-full h-24 rounded-lg border-2 border-border p-3 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 resize-none text-xs"
          />
        </div>

        {/* 输出选项 */}
        <div className="space-y-3 pt-3 border-t-2 border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            输出选项
          </h3>

          {/* 对比模式 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-xs font-medium text-foreground">原稿 vs 修改稿对照</p>
              <p className="text-xs text-muted-foreground mt-0.5">对比展示，看得更清楚</p>
            </div>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`relative w-12 h-6 rounded-full transition-all ${
                compareMode ? "bg-green-600" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full transition-transform ${
                  compareMode ? "transform translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {/* 严重度标注 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-xs font-medium text-foreground">问题严重度标注</p>
              <p className="text-xs text-muted-foreground mt-0.5">标注严重/中等/轻微问题</p>
            </div>
            <button
              onClick={() => setSeverityLabels(!severityLabels)}
              className={`relative w-12 h-6 rounded-full transition-all ${
                severityLabels ? "bg-green-600" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full transition-transform ${
                  severityLabels ? "transform translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-teal-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              AI审稿中...
            </>
          ) : (
            <>
              <CheckCircle className="w-6 h-6" />
              开始审稿优化
            </>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          💡 填写草稿并选择至少1个审稿维度即可生成
        </p>
      </div>

      {/* 右侧结果展示 */}
      <div className="flex-1 overflow-y-auto p-8">
        {result ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-2xl shadow-xl p-8 border-2 border-green-500/30">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                审稿报告
              </h2>
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="relative mb-6">
                <CheckCircle className="w-28 h-28 mx-auto text-muted-foreground" />
                <Sparkles className="w-12 h-12 absolute top-0 right-1/3 text-green-400 animate-pulse" />
              </div>
              <p className="text-2xl font-bold text-foreground mb-3">
                专业审稿优化系统
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                多维度诊断脚本问题<br/>
                给出具体修改建议<br/>
                生成完整优化版本<br/>
                支持对标参考学习<br/><br/>
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border-2 border-blue-200 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-blue-900 mb-2">💡 使用技巧</p>
                    <ul className="space-y-1 text-xs text-blue-700">
                      <li>• 草稿越详细，审稿越精准</li>
                      <li>• 根据你的担心选择审稿维度</li>
                      <li>• 粘贴对标脚本，AI会参考优化</li>
                      <li>• 开启对比模式，修改一目了然</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

