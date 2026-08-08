"use client";

import { useState } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { Film, Loader2, Sparkles, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notify } from '@/components/ui/feedback';

const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "快手"];
const DURATIONS = ["15秒", "30秒", "60秒", "90秒", "3-5分钟"];

// 内容类型（帮助AI理解场景）
const CONTENT_TYPES = [
  { value: "food", label: "美食", icon: "🍜", desc: "美食探店、制作教程" },
  { value: "vlog", label: "VLOG", icon: "📹", desc: "日常记录、生活分享" },
  { value: "tutorial", label: "教程", icon: "📚", desc: "技能教学、知识讲解" },
  { value: "product", label: "产品", icon: "📦", desc: "开箱评测、产品展示" },
  { value: "story", label: "故事", icon: "🎬", desc: "剧情短片、情景剧" },
  { value: "interview", label: "访谈", icon: "🎤", desc: "人物采访、对话" },
];

// 示例脚本
const EXAMPLE_SCRIPTS: Record<string, string> = {
  food: "我要拍美食探店。开场先拍店门口招牌特写3秒，然后推镜进店拍环境全景5秒，接着拍后厨制作过程的中近景10秒，特写拍成品菜肴的细节5秒，最后拍我品尝的反应和点评15秒。",
  vlog: "记录我的一天。早上起床后拍窗外阳光，然后拍我做早餐的过程，出门时拍街景，中午拍工作场景，傍晚拍回家路上的夕阳，晚上拍和家人聊天的温馨画面。",
  tutorial: "教大家做手工。开场先展示成品吸引注意，然后逐步展示需要的材料和工具，接着分步骤演示制作过程，每个关键步骤用特写强调，最后展示完成品并总结要点。",
  product: "开箱评测新手机。先拍包装盒外观，然后慢镜头拆封，展示配件全家福，接着特写拍手机外观细节，演示几个核心功能，最后给出使用感受和购买建议。",
  story: "拍一个感人小故事。开场用远景建立场景氛围，然后用中近景展示人物关系，冲突时用特写捕捉表情细节，转折用运动镜头增强节奏，结尾回到远景留白。",
  interview: "采访创业者。开场拍被采访者工作场景建立身份，然后切到访谈双机位，主机位对准被采访者，副机位拍我提问，关键观点用字幕强调，结尾拍握手告别。"
};

// 视觉风格（帮助AI选择色彩和光线）
const VISUAL_STYLES = [
  { value: "cinematic", label: "电影感", icon: "🎥", desc: "专业、高级" },
  { value: "bright", label: "明亮清新", icon: "☀️", desc: "活力、阳光" },
  { value: "warm", label: "温暖治愈", icon: "🌅", desc: "温馨、柔和" },
  { value: "cool", label: "冷酷科技", icon: "🌃", desc: "现代、酷炫" },
  { value: "vintage", label: "复古怀旧", icon: "📷", desc: "经典、回忆" },
  { value: "minimal", label: "简约高级", icon: "⬜", desc: "干净、留白" },
];

export default function StoryboardPage() {
  const [scriptContent, setscriptContent] = useState("");
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [contentType, setContentType] = useState("food");
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [additionalInfo, setAdditionalInfo] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [result, setResult] = useState("");

  // 加载示例脚本
  const loadExample = () => {
    const exampleScript = EXAMPLE_SCRIPTS[contentType] || EXAMPLE_SCRIPTS.food;
    setscriptContent(exampleScript);
  };

  // AI智能推荐
  const handleAIRecommend = async () => {
    if (!scriptContent.trim()) {
      notify("请先输入脚本内容");
      return;
    }

    setIsRecommending(true);
    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "AI推荐",
          query: `根据以下脚本内容,推荐最佳配置:
          
脚本: ${scriptContent}

请以JSON格式返回:
{
  "duration": "15秒/30秒/60秒/90秒/3-5分钟",
  "contentType": "food/vlog/tutorial/product/story/interview",
  "visualStyle": "cinematic/bright/dark/vintage/minimalist/warm"
}

只返回JSON,不要其他文字。`,
        }),
      });

      if (!response.ok) throw new Error("推荐失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
      }

      // 解析JSON
      try {
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const recommendations = JSON.parse(jsonMatch[0]);
          
          if (recommendations.duration) setDuration(recommendations.duration);
          if (recommendations.contentType) setContentType(recommendations.contentType);
          if (recommendations.visualStyle) setVisualStyle(recommendations.visualStyle);
          
          notify("✅ AI推荐已应用!");
        } else {
          notify("AI推荐解析失败");
        }
      } catch (e) {
        notify("AI推荐解析失败");
      }
    } catch (error: any) {
      notify(error.message || "推荐失败");
    } finally {
      setIsRecommending(false);
    }
  };

  const handleGenerate = async () => {
    // 检查配额
    const remainingQuota = await checkQuota();
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("❌ 您的配额已用完，请联系管理员或升级会员");
      return;
    }

    if (!scriptContent.trim()) {
      notify("请输入脚本内容");
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = ""; // 保存历史记录用

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "分镜脚本",
          scriptContent,
          platform,
          duration,
          contentType,
          visualStyle,
          additionalInfo,
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
            const inputData = { scriptContent, platform, duration, contentType, visualStyle };
            await saveGenerationHistory("分镜脚本", inputData, fullResult);
            console.log("✅ 历史记录已保存");
          } catch (err) {
            console.error("⚠️ 保存失败:", err);
          }
        }, 500);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50">
      {/* 左侧面板 - 简洁版 */}
      <div className="w-[400px] bg-card shadow-2xl p-6 space-y-6 overflow-y-auto">
        
        {/* 标题 */}
        <div className="text-center pb-4 border-b-2 border-green-100">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Film className="w-7 h-7 text-green-600" />
            分镜脚本生成
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <Wand2 className="w-4 h-4 inline mr-1" />
            AI智能配置专业参数
          </p>
        </div>

        {/* 脚本内容 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-foreground">
              📝 脚本内容 <span className="text-red-500">*</span>
            </label>
            <button
              onClick={loadExample}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              一键示例
            </button>
          </div>
          <textarea
            value={scriptContent}
            onChange={(e) => setscriptContent(e.target.value)}
            placeholder="例如：我要拍美食探店，先拍店门口招牌，再进店拍环境，然后特写拍菜品，最后拍我吃的反应"
            className="w-full h-24 rounded-lg border-2 border-border p-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 resize-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">AI会根据主题自动选择镜头语言</p>
        </div>

        {/* AI智能推荐按钮 */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-foreground">AI智能推荐</p>
                <p className="text-xs text-muted-foreground">根据脚本自动推荐最佳配置</p>
              </div>
            </div>
            <button
              onClick={handleAIRecommend}
              disabled={isRecommending || !scriptContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isRecommending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  推荐中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  一键推荐
                </>
              )}
            </button>
          </div>
        </div>

        {/* 基础设置 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">平台</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-lg border-2 border-border p-2 focus:border-green-500"
            >
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">时长</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border-2 border-border p-2 focus:border-green-500"
            >
              {DURATIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* 内容类型 */}
        <div>
          <label className="block text-sm font-bold text-foreground mb-3">
            🎬 内容类型
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setContentType(type.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  contentType === type.value
                    ? "border-green-500 bg-green-50 text-green-700 shadow-md scale-105"
                    : "border-border bg-card hover:border-green-300"
                }`}
                title={type.desc}
              >
                <div className="text-2xl mb-1">{type.icon}</div>
                <div className="text-xs font-medium">{type.label}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">AI会根据类型选择合适的景别和运镜</p>
        </div>

        {/* 视觉风格 */}
        <div>
          <label className="block text-sm font-bold text-foreground mb-3">
            🎨 视觉风格
          </label>
          <div className="grid grid-cols-3 gap-2">
            {VISUAL_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => setVisualStyle(style.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  visualStyle === style.value
                    ? "border-purple-500 bg-purple-50 text-purple-700 shadow-md scale-105"
                    : "border-border bg-card hover:border-purple-300"
                }`}
                title={style.desc}
              >
                <div className="text-2xl mb-1">{style.icon}</div>
                <div className="text-xs font-medium">{style.label}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">AI会根据风格选择色彩和光线</p>
        </div>

        {/* 补充说明 */}
        <div>
          <label className="block text-sm font-bold text-foreground mb-2">
            💡 补充说明（可选）
          </label>
          <textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="例如：需要强调产品细节、希望节奏快一点..."
            className="w-full h-16 rounded-lg border-2 border-border p-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 resize-none text-sm"
          />
        </div>

        {/* AI提示框 */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border-2 border-green-200">
          <div className="flex items-start gap-2">
            <Wand2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-foreground">
              <p className="font-bold mb-1">AI自动配置</p>
              <p>根据你的选择，AI会智能匹配：</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>• 景别（远景/中景/特写等）</li>
                <li>• 运镜方式（推拉摇移跟等）</li>
                <li>• 画面构图（九宫格/对称等）</li>
                <li>• 光线类型（自然光/侧光等）</li>
                <li>• 色彩方案和转场效果</li>
              </ul>
            </div>
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
              AI生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6" />
              AI智能生成
            </>
          )}
        </button>
      </div>

      {/* 右侧结果 */}
      <div className="flex-1 overflow-y-auto p-8 bg-card">
        {result ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-2xl shadow-xl p-8 border-2 border-green-500/30">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Film className="w-6 h-6 text-green-600" />
                AI生成的分镜脚本
              </h2>
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-6 rounded-lg border-2 border-green-200 shadow-lg">
                          <table className="min-w-full" {...props} />
                        </div>
                      ),
                      thead: ({node, ...props}) => (
                        <thead className="bg-gradient-to-r from-green-600 to-teal-600" {...props} />
                      ),
                      th: ({node, ...props}) => (
                        <th className="text-white font-bold text-sm py-4 px-6 text-left border-r border-green-500 last:border-r-0" {...props} />
                      ),
                      tbody: ({node, ...props}) => (
                        <tbody className="bg-card" {...props} />
                      ),
                      tr: ({node, ...props}) => (
                        <tr className="hover:bg-green-50 transition-colors border-b border-border last:border-b-0" {...props} />
                      ),
                      td: ({node, ...props}) => (
                        <td className="py-4 px-6 text-foreground text-sm border-r border-border last:border-r-0" {...props} />
                      ),
                      h1: ({node, ...props}) => (
                        <h1 className="text-2xl font-bold mb-6 pb-3 border-b-2 border-green-300 text-green-800" {...props} />
                      ),
                      h2: ({node, ...props}) => (
                        <h2 className="text-xl font-bold mt-8 mb-4 text-green-700" {...props} />
                      ),
                      ul: ({node, ...props}) => (
                        <ul className="space-y-2 my-4 list-disc list-inside" {...props} />
                      ),
                      li: ({node, ...props}) => (
                        <li className="text-foreground" {...props} />
                      ),
                      strong: ({node, ...props}) => (
                        <strong className="font-bold text-green-700" {...props} />
                      ),
                    }}
                  >
                    {result}
                  </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="relative">
                <Film className="w-24 h-24 mx-auto mb-4 text-muted-foreground" />
                <Wand2 className="w-10 h-10 absolute top-0 right-1/3 text-green-400 animate-pulse" />
              </div>
              <p className="text-xl font-medium text-muted-foreground">填写信息后，AI自动生成专业分镜</p>
              <p className="text-sm mt-2 text-muted-foreground">无需手动选择参数，AI会智能配置</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}







