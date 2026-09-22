"use client";

import { takeHandoff, putHandoff } from "@/lib/handoff";
import { recordStage } from "@/lib/works";
import { throwApiError } from "@/lib/api-error";
import ContinuousDialog from "@/components/ContinuousDialog";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { useRouter } from "next/navigation";
import { Film, Copy, Download, Loader2, Sparkles, Wand2, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notify } from '@/components/ui/feedback';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';

import { readDifyStream } from '@/lib/sse-stream';
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

  // 统一生成页基础能力
  const {
    history,
    loadHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    quota: hookQuota,
    copyToClipboard,
    downloadAsFile,
    lastResult,
  } = useGenerationPage({ taskType: '分镜脚本', historyApiPath: '/api/storyboards' });

  const router = useRouter();

  const [scriptContent, setscriptContent] = useState("");
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [contentType, setContentType] = useState("food");
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [additionalInfo, setAdditionalInfo] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [result, setResult] = useState("");
  // 所属作品：由脚本页带过来，保存时挂到同一条内容下
  const [workId, setWorkId] = useState<string | null>(null);


  // 接收从脚本页带来的正文，省掉一次复制粘贴
  useEffect(() => {
    const data = takeHandoff();
    if (data?.workId) setWorkId(data.workId);
    if (data?.scriptContent) setscriptContent(data.scriptContent);
  }, []);

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult);

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

      if (!response.ok) await throwApiError(response, "推荐失败");

      // 必须先从 SSE 中解析出 answer 文本。若直接累加原始字节，
      // 下面提取 JSON 的正则会命中 SSE 自身的 {"answer":...}，
      // 而不是模型返回的推荐配置。
      const accumulated = await readDifyStream(response);

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
    const remainingQuota = await checkQuota("storyboard");
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("分镜脚本的额度已用完，请升级会员或等待下月重置");
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

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) await throwApiError(response);

      // 响应是 SSE（data: {"answer":"..."}），需解析后取 answer
      fullResult = await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
      });
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
          try {            const inputData = { scriptContent, platform, duration, contentType, visualStyle };
            await saveGenerationHistory("分镜脚本", inputData, fullResult, workId);
            // 登记到作品：刷新排序；五个环节都齐了就自动标记完成
            await recordStage(workId, "分镜脚本");          } catch (err) {
            console.error("⚠️ 保存失败:", err);
          }
        }, 500);
      }
    }
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader
            title="分镜脚本"
            subtitle="把口播脚本拆成可执行的分镜：景别、运镜、画面与时长"
            action={
              <button onClick={loadExample} className="text-[12px] text-primary hover:opacity-80">
                填入示例
              </button>
            }
          />

          <CollapsibleSection title="脚本内容" defaultOpen>
            <Field label="脚本内容" required stacked hint="AI 会根据内容自动选择镜头语言">
              <textarea
                value={scriptContent}
                onChange={(e) => setscriptContent(e.target.value)}
                placeholder="例如：我要拍美食探店，先拍店门口招牌，再进店拍环境，然后特写拍菜品，最后拍我吃的反应"
                rows={5}
                className={TEXTAREA_CLS}
              />
            </Field>

            <button
              onClick={handleAIRecommend}
              disabled={isRecommending || !scriptContent.trim()}
              className={`${SECONDARY_BTN} w-full disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isRecommending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  分析中…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  让 AI 推荐参数
                </>
              )}
            </button>
          </CollapsibleSection>

          <CollapsibleSection title="拍摄设置" defaultOpen>
            <Field label="发布平台" optional>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={SELECT_CLS}>
                {["抖音", "快手", "视频号", "小红书", "B站"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="视频时长" optional>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className={SELECT_CLS}>
                {["15秒", "30秒", "60秒", "90秒", "3-5分钟"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="内容类型" optional stacked hint="AI 会据此选择合适的景别与运镜">
              <div className="grid grid-cols-3 gap-1.5">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setContentType(type.value)}
                    aria-pressed={contentType === type.value}
                    title={type.desc}
                    className={`glass-interactive rounded-xl border p-2 text-center ${
                      contentType === type.value ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="text-base leading-none">{type.icon}</div>
                    <div
                      className={`mt-1 text-[11px] font-medium leading-none ${
                        contentType === type.value ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {type.label}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="视觉风格" optional stacked>
              <div className="grid grid-cols-3 gap-1.5">
                {VISUAL_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setVisualStyle(style.value)}
                    aria-pressed={visualStyle === style.value}
                    title={style.desc}
                    className={`glass-interactive rounded-xl border p-2 text-center ${
                      visualStyle === style.value ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="text-base leading-none">{style.icon}</div>
                    <div
                      className={`mt-1 text-[11px] font-medium leading-none ${
                        visualStyle === style.value ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {style.label}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="补充说明" defaultOpen={false}>
            <Field label="其他要求" optional stacked>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="例如：需要航拍镜头、避免快速剪辑…"
                rows={3}
                className={TEXTAREA_CLS}
              />
            </Field>
          </CollapsibleSection>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !scriptContent.trim()}
            className={PRIMARY_BTN}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成分镜脚本
              </>
            )}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        title="分镜脚本"
        showStats={false}
        emptyIcon={Film}
        emptyTitle="填入脚本内容后生成分镜"
        emptyHint="AI 会自动配置景别、运镜与时长，无需手动选择参数"
        emptyTips={[
          "脚本写得越细，分镜越贴合实拍",
          "拿不准参数就点「让 AI 推荐参数」",
          "生成后可继续追问调整某个镜头",
        ]}
        generatingHint="正在拆解镜头…"
        onCopy={(text) => copyToClipboard(text)}
        onDownload={(text) => downloadAsFile(text, `分镜脚本-${new Date().toLocaleDateString()}.txt`)}
        onContinue={result ? () => openContinuousDialog(result) : undefined}
        // 分镜此前没有任何往下的交接，作品链条到这里就断了。
        // 拆完分镜通常还剩起标题这一步。
        nextActions={[
          {
            label: "给这条起标题",
            icon: Tag,
            onClick: () => {
              // 带的是原始脚本而不是分镜表：起标题要看的是内容讲了什么，
              // 镜号和景别对它没有帮助
              putHandoff({
                from: "分镜脚本",
                scriptContent: scriptContent,
                workId: workId ?? undefined,
              });
              router.push("/dashboard/title");
            },
          },
        ]}
      />

      <HistoryPanel
        items={history}
        title="历史分镜"
        showStats={false}
        onLoad={(item) => setResult(item.result)}
        onContinue={(item) => openContinuousDialog(item.result)}
        onDelete={(id) => deleteHistory(id)}
      />

      <ContinuousDialog
        isOpen={showDialog}
        onClose={closeContinuousDialog}
        initialContent={dialogInitialContent}
        taskType="分镜脚本"
      />
    </WorkspaceLayout>
  );
}
