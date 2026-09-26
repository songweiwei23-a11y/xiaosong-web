"use client";

import { takeHandoff, putHandoff } from "@/lib/handoff";
import { recordStage } from "@/lib/works";
import { throwApiError } from "@/lib/api-error";
import { buildStoryboardPrompt, auditStoryboard } from "@/lib/storyboard-standards";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { buildContextBlock } from "@/lib/creator-context";
import ContinuousDialog from "@/components/ContinuousDialog";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, GENERATE_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { ContextBadge } from '@/components/workspace/ContextBadge';
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect, useMemo } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { useRouter } from "next/navigation";
import { Film, Copy, Download, Loader2, Sparkles, Wand2, Tag } from "lucide-react";
import { notify } from '@/components/ui/feedback';
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';
import { useWorkResume } from '@/hooks/useWorkResume';
import { latestOf, workScriptBody } from '@/lib/resume';

import { readDifyStream } from '@/lib/sse-stream';
import { getActiveProfileId } from '@/lib/active-profile';
import {
  CONTENT_TYPES,
  CONTENT_TYPE_GROUPS,
  CONTENT_TYPE_VALUES,
  VISUAL_STYLES,
  VISUAL_STYLE_VALUES,
  contentTypeExample,
} from '@/lib/content-types';

const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "快手"];
const DURATIONS = ["15秒", "30秒", "60秒", "90秒", "3-5分钟"];

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
  // 原来指向 /api/storyboards——那个路由根本不存在，请求一直 404，
  // 所以这一页从上线起就没有历史、也不会恢复上次的结果
  } = useGenerationPage({ taskType: '分镜脚本', historyApiPath: '/api/script-history' });

  const router = useRouter();

  // 账号档案 + 定位 + 成交理由。以侧边栏选中的档案为准，切换时自动跟着变
  const { context: creatorContext } = useCreatorContext();


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

  /*
   * 打开某个作品（地址带 ?work=）：脚本正文填进来当输入，
   * 做过分镜的把最新一版调出来。隔多久打开都一样。
   */
  useWorkResume((work) => {
    setWorkId(work.id);
    const script = workScriptBody(work);
    if (script) setscriptContent(script);
    const last = latestOf(work, "分镜脚本");
    if (last) setResult(last.result);
    else if (!script) notify("这条作品还没有脚本，先去写脚本");
  });

  // 切换页面或刷新后，把云端最近一条生成结果取回来显示
  useRestoreLastResult(lastResult, setResult);

  /*
   * 对模型排出来的分镜表做一次代码核对。
   *
   * 不能信它自己写的那行「总时长：60s（已对账）」——实测里表格实际相加
   * 是 55s，它声称加过了其实没加。时长对不上，拍摄当天才会发现素材不够。
   *
   * 生成结束后才核对：流式过程中表格还是残缺的，中途算出来的数字没有意义。
   * 用 useMemo 是因为流式生成时 result 每个字都在变，不必每帧重算整张表。
   */
  const audit = useMemo(
    () => (isGenerating || !result ? null : auditStoryboard(result, duration)),
    [isGenerating, result, duration]
  );

  // 加载示例脚本
  const loadExample = () => {
    const exampleScript = contentTypeExample(contentType);
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
"duration": "${DURATIONS.join("/")}",
"contentType": "${CONTENT_TYPE_VALUES.join("/")}",
"visualStyle": "${VISUAL_STYLE_VALUES.join("/")}"
}

contentType 各值的含义：
${CONTENT_TYPES.map((t) => `- ${t.value}：${t.label}，${t.desc}`).join("\n")}

只返回JSON,不要其他文字。三个字段都必须从上面给出的取值里选，不要自造。`,
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
          
          // 只接受合法取值。模型偶尔会返回列表外的词（之前提示词里写的
          // dark / minimalist 就根本不存在），直接 set 进去的后果是：
          // 卡片一个都不高亮，提示词里对应那段也静默消失，还不报错。
          // 宁可保持用户原来的选择。
          const applied: string[] = [];
          if (DURATIONS.includes(recommendations.duration)) {
            setDuration(recommendations.duration);
            applied.push("时长");
          }
          if (CONTENT_TYPE_VALUES.includes(recommendations.contentType)) {
            setContentType(recommendations.contentType);
            applied.push("内容类型");
          }
          if (VISUAL_STYLE_VALUES.includes(recommendations.visualStyle)) {
            setVisualStyle(recommendations.visualStyle);
            applied.push("视觉风格");
          }

          if (applied.length === 0) notify("AI 返回的参数都不在可选范围内，已保持原设置");
          else notify(`✅ 已应用 AI 推荐：${applied.join("、")}`);
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
      notify("分镜脚本的额度已用完，开通、续费或升级会员后继续使用");
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
      // 提示词在前端拼：这样才能先把脚本量一遍（字数换算口播时长、
      // 和目标时长的差额），把客观数据交给模型。后端检测到已有 query
      // 就不再用那套只有格式约束的旧模板。
      const query = buildStoryboardPrompt({
        // 账号背景随每次生成带上，不用用户在这一页重填一遍
        contextBlock: buildContextBlock(creatorContext, "storyboard"),
        scriptContent,
        platform,
        duration,
        contentType,
        visualStyle,
        visualStyleLabel: VISUAL_STYLES.find((s) => s.value === visualStyle)?.label || "电影感",
        additionalInfo,
      });

      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "分镜脚本",
          query,
          // 记忆按档案隔离，与其余板块共用同一个工作窗口
          profileId: getActiveProfileId(),
          // 结构化字段仍然带上：知识库检索的短查询由它们拼出来
          platform,
          duration,
          contentType,
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

          {/* 档案和创作简报自动带上，这里只告诉用户带了什么 */}
          <ContextBadge board="storyboard" className="mb-4" />

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
              {/* 十三个类型平铺开不好找，按「怎么拍」分四组：
                  口播类（对镜讲）、展示类（镜头对着东西）、
                  场景类（人在环境里走）、叙事类（有情节有他人） */}
              <div className="space-y-2.5">
                {CONTENT_TYPE_GROUPS.map((group) => (
                  <div key={group}>
                    <div className="mb-1.5 text-[11px] font-medium text-muted-foreground/80">{group}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CONTENT_TYPES.filter((t) => t.group === group).map((type) => (
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
                  </div>
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
            className={GENERATE_BTN}
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
        // 代码数出来的核对结果。模型自检栏写的数字不可信，以这里为准
        footer={
          audit ? (
            <div className="glass-panel rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span className="font-medium text-foreground">系统核对</span>
                <span>{audit.shots} 个镜头</span>
                <span className={Math.abs(audit.diff) > 2 ? "font-medium text-amber-500" : ""}>
                  合计 {audit.totalSeconds}s / 目标 {audit.target}s
                </span>
                <span>特写 {audit.closeUpRatio}%</span>
                <span>运动镜头 {audit.moveRatio}%</span>
                <span>最长 {audit.longest}s</span>
              </div>

              {audit.issues.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {audit.issues.map((issue) => (
                    <li key={issue} className="flex gap-2 text-[12px] text-amber-500">
                      <span aria-hidden="true">·</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  时长、景别配比、镜头长度都在标准范围内，可以照着拍。
                </p>
              )}
            </div>
          ) : null
        }
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
        onLoad={(item) => {
          setResult(item.result);
          // 连它属于哪个作品一起接上，接着送去审稿、标题时才挂得回去
          setWorkId(item.work_id ?? null);
        }}
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