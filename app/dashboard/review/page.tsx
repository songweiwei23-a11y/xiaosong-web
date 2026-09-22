"use client";

import { useRouter } from "next/navigation";
import { takeHandoff, putHandoff } from "@/lib/handoff";
import { recordStage } from "@/lib/works";
import { throwApiError } from "@/lib/api-error";
import { buildReviewPrompt } from "@/lib/review-standards";
import ContinuousDialog from "@/components/ContinuousDialog";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { CheckCircle, Copy, Download, Loader2, AlertCircle, FileText, Sparkles, Zap, Target, Eye, MessageSquare, Film, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { notify } from '@/components/ui/feedback';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';
import { readDifyStream } from '@/lib/sse-stream';

export default function ReviewPage() {
  // 草稿内容

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
  } = useGenerationPage({ taskType: '审稿优化', historyApiPath: '/api/reviews' });

  const router = useRouter();

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
  // 所属作品：由脚本页带过来，保存时挂到同一条内容下
  const [workId, setWorkId] = useState<string | null>(null);


  // 接收从脚本页带来的正文作为待审稿件
  useEffect(() => {
    const data = takeHandoff();
    if (data?.workId) setWorkId(data.workId);
    if (data?.scriptContent) setDraftContent(data.scriptContent);
  }, []);

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult);

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
    const remainingQuota = await checkQuota("review");
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("审稿优化的额度已用完，请升级会员或等待下月重置");
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
      // 提示词在前端拼：这样才能先用 quality-checker 把稿子量一遍，
      // 把「秒数标注只有 1 处」「金句 27 字超长」这类客观事实喂给模型。
      // 后端检测到已有 query 就不再自行拼装。
      const query = buildReviewPrompt({
        draftContent,
        platform,
        duration,
        scriptType,
        reviewDimensions: reviewDimensions.join("\n"),
        optimizationGoals: optimizationGoals.join("、"),
        benchmarkScript,
        compareMode,
        severityLabels,
      });

      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "审稿优化",
          query,
          // 记忆按档案隔离，与脚本、选题两页保持一致
          profileId: typeof window !== "undefined"
            ? localStorage.getItem("activeProfileId")
            : null,
          // 结构化字段仍然带上：知识库检索的短查询由它们拼出来
          platform,
          duration,
          scriptType,
        }),
      });

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) await throwApiError(response);

      // 响应是 SSE（data: {"answer":"..."}），必须解析后取 answer，
      // 直接累加原始字节会把 data: {...} 一起显示给用户
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
          try {            const inputData = { draftContent, scriptType, platform, duration };
            await saveGenerationHistory("审稿优化", inputData, fullResult, workId);
            // 登记到作品：刷新排序；五个环节都齐了就自动标记完成
            await recordStage(workId, "审稿优化");          } catch (err) {
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
          <PageHeader title="审稿优化" subtitle="逐条指出问题并给出改写建议，可对照标杆脚本做差距分析" />

          <CollapsibleSection title="待审脚本" defaultOpen>
            <Field
              label="草稿内容"
              required
              stacked
              hint={
                wordCount > 0
                  ? `${wordCount} 字 · 口播约 ${estimatedDuration} 秒`
                  : "粘贴要审的口播稿，字数与时长会自动估算"
              }
            >
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="把要审的脚本粘贴进来…"
                rows={8}
                className={TEXTAREA_CLS}
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="基础信息" defaultOpen>
            <Field label="发布平台" optional>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={SELECT_CLS}>
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="视频时长" optional>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className={SELECT_CLS}>
                {durations.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="脚本类型" optional stacked>
              <div className="flex flex-wrap gap-1.5">
                {scriptTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setScriptType(scriptType === t ? "" : t)}
                    aria-pressed={scriptType === t}
                    className={chipCls(scriptType === t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="审稿维度" defaultOpen={false}>
            {[
              { label: "开篇", options: openingOptions, value: openingChecks, setter: setOpeningChecks },
              { label: "结构", options: structureOptions, value: structureChecks, setter: setStructureChecks },
              { label: "内容", options: contentOptions, value: contentChecks, setter: setContentChecks },
              { label: "情绪", options: emotionOptions, value: emotionChecks, setter: setEmotionChecks },
              { label: "转化", options: actionOptions, value: actionChecks, setter: setActionChecks },
            ].map((group) => (
              <Field key={group.label} label={group.label} optional stacked>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((opt: any) => (
                    <button
                      key={opt.id}
                      onClick={() => toggleSelection(opt.label, group.value, group.setter)}
                      aria-pressed={group.value.includes(opt.label)}
                      className={chipCls(group.value.includes(opt.label))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="优化目标" defaultOpen={false}>
            <Field
              label="优化目标"
              optional
              stacked
              hint={optimizationGoals.length > 0 ? `已选 ${optimizationGoals.length} 项` : "不选则全面优化"}
            >
              <div className="flex flex-wrap gap-1.5">
                {goalOptions.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleSelection(g, optimizationGoals, setOptimizationGoals)}
                    aria-pressed={optimizationGoals.includes(g)}
                    className={chipCls(optimizationGoals.includes(g))}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="标杆脚本" optional stacked hint="填了会做对照分析，指出差距在哪">
              <textarea
                value={benchmarkScript}
                onChange={(e) => setBenchmarkScript(e.target.value)}
                placeholder="粘贴一条同赛道的爆款脚本…"
                rows={4}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="输出选项" optional stacked>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  aria-pressed={compareMode}
                  className={chipCls(compareMode)}
                >
                  原文改写对照
                </button>
                <button
                  onClick={() => setSeverityLabels(!severityLabels)}
                  aria-pressed={severityLabels}
                  className={chipCls(severityLabels)}
                >
                  标注问题严重度
                </button>
              </div>
            </Field>
          </CollapsibleSection>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !draftContent.trim()}
            className={PRIMARY_BTN}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                审稿中…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                开始审稿优化
              </>
            )}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        title="审稿意见"
        emptyIcon={CheckCircle}
        emptyTitle="粘贴脚本后开始审稿"
        emptyHint="逐条指出问题，并给出可直接替换的改写"
        emptyTips={[
          "填上标杆脚本会做对照，差距更清楚",
          "不选维度就是全面审一遍",
          "审完可继续追问某一条怎么改",
        ]}
        generatingHint="正在逐句审阅…"
        onCopy={(text) => copyToClipboard(text)}
        onDownload={(text) => downloadAsFile(text, `审稿意见-${new Date().toLocaleDateString()}.txt`)}
        onContinue={result ? () => openContinuousDialog(result) : undefined}
        // 审完通常要拿改好的版本重新拆分镜，或者直接去起标题
        nextActions={[
          {
            label: "拿改好的版本拆分镜",
            icon: Film,
            onClick: (body) => {
              // workId 必须一并带走。漏掉的话下一个环节生成出来就挂不到
              // 这条内容下面，作品的链条在这里断开，变成一条零散记录。
              putHandoff({
                from: "审稿优化",
                scriptContent: body,
                workId: workId ?? undefined,
              });
              router.push("/dashboard/storyboard");
            },
          },
          {
            label: "给这条起标题",
            icon: Tag,
            onClick: (body) => {
              putHandoff({
                from: "审稿优化",
                scriptContent: body,
                workId: workId ?? undefined,
              });
              router.push("/dashboard/title");
            },
          },
        ]}
      />

      <HistoryPanel
        items={history}
        title="历史审稿"
        onLoad={(item) => setResult(item.result)}
        onContinue={(item) => openContinuousDialog(item.result)}
        onDelete={(id) => deleteHistory(id)}
      />

      <ContinuousDialog
        isOpen={showDialog}
        onClose={closeContinuousDialog}
        initialContent={dialogInitialContent}
        taskType="审稿优化"
      />
    </WorkspaceLayout>
  );
}
