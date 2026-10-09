"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clapperboard, FileVideo, Loader2, ScanSearch, Shuffle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { takeHandoff, type HandoffPayload } from "@/lib/handoff";
import { openCreationSafely } from "@/lib/creation-session";
import { buildCreationHandoff } from "@/lib/creation-flow";
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { resolveCreationSettings, mergeCreationSettings, settingsForResult } from '@/lib/creation-settings';
import { creationReference, originForResult } from '@/lib/creation-continuation';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, TEXTAREA_CLS, GENERATE_BTN } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import type { HistoryItem } from '@/components/workspace/HistoryPanel';
import { notify } from "@/components/ui/feedback";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { useCreativeHistory } from '@/hooks/useCreativeHistory';
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import { checkQuota } from "@/lib/history";
import { createHistoryId } from '@/lib/history-id';
import { openUpgrade } from "@/lib/upgrade";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError, fetchGeneration } from "@/lib/api-error";
import { DifyStreamError, readDifyStream } from "@/lib/sse-stream";
import { buildProfileSummary } from "@/lib/profile-summary";
import { buildContextBlock } from "@/lib/creator-context";
import {
  MAX_DURATION_SEC,
  MAX_FILE_MB,
  VideoInputError,
  audioSegments,
  extractAudio,
  prepareVideo,
  shrinkSheets,
  SHEETS_BYTE_BUDGET,
  type VideoBreakdownInput,
} from "@/lib/video-frames";
import { transcribeSegments, uploadSheets } from "@/lib/breakdown-client";
import { BREAKDOWN_TASK_TYPE, buildBreakdownPrompt, type TranscriptSegment, type VideoMeta } from "@/lib/viral-breakdown";

type Stage = "frames" | "audio" | "upload" | "ai";

interface Prepared {
  file: File;
  input: VideoBreakdownInput;
  transcript: TranscriptSegment[];
}
const STAGES: { id: Stage; label: string }[] = [
  { id: "frames", label: "拆画面：找镜头切换、截图" },
  { id: "audio", label: "识别口播" },
  { id: "upload", label: "把截图交给 AI" },
  { id: "ai", label: "AI 逐镜头拆解" },
];

/**
 * 逐镜头那一节：每个镜头是一个四级标题（镜头 3｜时间｜时长｜情绪）+ 5 行列表。
 * 标题排成带左边色条的卡片头，列表收紧——原来是一张 13 列的大表，产品方反馈"太挤、不美观"。
 */
const SHOT_CARD_CLS =
  "prose-h4:mt-6 prose-h4:mb-1.5 prose-h4:rounded-lg prose-h4:border-l-[3px] prose-h4:border-primary prose-h4:bg-primary/[0.06] prose-h4:px-3 prose-h4:py-2 prose-h4:text-[14px] prose-h4:font-semibold prose-h4:tabular-nums " +
  "prose-ul:my-1.5 prose-li:my-0.5 prose-li:leading-[1.75]";

const NUM_FIELDS: { key: keyof VideoMeta; label: string }[] = [
  { key: "likes", label: "点赞" },
  { key: "comments", label: "评论" },
  { key: "favorites", label: "收藏" },
  { key: "shares", label: "转发" },
  { key: "followers", label: "账号粉丝" },
];

/**
 * 拆解爆款：传一条爆款视频，逐镜头拆出它为什么火、能学走什么。
 *
 * 视频不上传：在浏览器里切镜头、截图拼图、切音频（lib/video-frames），
 * 只把拼图和一段段音频发出去——拼图给模型看，音频转成口播文字。
 * 拆解维度（八层 + 逐镜头表）见 lib/viral-breakdown。
 */
export default function BreakdownPage() {
  const beginProfileRequest = useProfileRequestGuard();
  const router = useRouter();
  const { history, loadHistory, deleteHistory, lastResult, resultScope } = useGenerationPage({ taskType: BREAKDOWN_TASK_TYPE });
  const { context, loading: ctxLoading } = useCreatorContext();
  const { saveCreativeHistory, saveError, retrySave, getHistoryOwner } = useCreativeHistory(loadHistory);
  const profile = context.profile as Record<string, unknown> | null;

  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta>({});
  const [pastedScript, setPastedScript] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  const incomingHandoff = useRef(false);
  const [withProfile, setWithProfile] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");
  const [sheetUrls, setSheetUrls] = useState<string[]>([]);
  const [showSheets, setShowSheets] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  /** 拆好的画面和口播：AI 拆解那一步失败了，重试不用再拆一遍 */
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loadedFileName, setLoadedFileName] = useState('');
  const restoredInputScope = useRef<string>();
  const restoreHistory = (item: HistoryItem) => {
    setResult(item.result);
    const input = item.input_data || {};
    setLoadedFileName(typeof input.fileName === 'string' ? input.fileName : '');
    setMeta(input.meta && typeof input.meta === 'object' ? input.meta as VideoMeta : {});
    setPastedScript(typeof input.pastedScript === 'string' ? input.pastedScript : '');
    setTextMode(input.textMode === true);
    if (typeof input.withProfile === 'boolean') setWithProfile(input.withProfile);
  };
  useEffect(() => {
    if (!resultScope || !lastResult || !history[0] || restoredInputScope.current === resultScope) return;
    restoredInputScope.current = resultScope;
    if (!incomingHandoff.current && !running && (!result || result === lastResult)) restoreHistory(history[0]);
  }, [resultScope, lastResult, history, running, result]);

  // 切页面回来，把最近一次拆解取回来显示
  useRestoreLastResult(lastResult, setResult, resultScope);
  useEffect(() => {
    const data = takeHandoff();
    if (!data?.sourceContent) return;
    incomingHandoff.current = true; setIncomingSetup(data); setTextMode(true);
    setPastedScript(creationReference(data));
  }, []);
  const autoSetup = useAutoCreationSetup(incomingSetup, context, ctxLoading, s => setMeta(m => ({ ...m, industry: s.industry, title: s.topic })));
  const currentSettings = resolveCreationSettings({ from: BREAKDOWN_TASK_TYPE, sourceContent: pastedScript, settings: mergeCreationSettings(autoSetup.settings, { industry: meta.industry, topic: meta.title }) }, context);

  // 离开页面时把截图的临时地址释放掉
  useEffect(() => () => sheetUrls.forEach((u) => URL.revokeObjectURL(u)), [sheetUrls]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      notify("请选视频文件（mp4）", "error");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      notify(`视频超过 ${MAX_FILE_MB}MB，请换一个小一点的`, "error");
      return;
    }
    setFile(f);
  };

  const setNum = (key: keyof VideoMeta, v: string) => {
    const n = v.trim() === "" ? undefined : Number(v.replace(/[,，\s]/g, ""));
    setMeta((m) => ({ ...m, [key]: Number.isFinite(n) ? n : undefined }));
  };

  /**
   * 第一段：拆画面、识别口播——慢（一条 3 分钟的要一两分钟），做完存起来。
   * 后面那段（传图、AI 拆解）失败了，重试不用再做这一段。
   */
  const prepare = async (f: File): Promise<Prepared> => {
    let video: HTMLVideoElement | null = null;
    try {
      setStage("frames");
      setProgress("");
      const res = await prepareVideo(f, (s, p) => setProgress(p === undefined ? s : `${s} ${Math.round(p * 100)}%`));
      video = res.video;
      const input = res.input;
      setSheetUrls(input.sheets.map((b) => URL.createObjectURL(b)));
      if (input.truncated) {
        setNotice(`这条视频有 ${Math.round(input.fullDuration / 60)} 分多钟，只拆了前 ${MAX_DURATION_SEC / 60} 分钟——决定留不留人的就是开头这一段`);
      }

      setStage("audio");
      setProgress("解出音轨");
      const audio = await extractAudio(f, audioSegments(input.shots, input.duration));
      const transcript = audio.length ? await transcribeSegments(audio, (d, t) => setProgress(`${d}/${t} 段`)) : [];
      if (!transcript.some((t) => t.text.trim()) && !pastedScript.trim()) {
        setNotice((n) => [n, "没识别出口播（可能是纯画面 + 音乐）。有文案的话，贴到左边「视频文案」里再拆一次会更准"].filter(Boolean).join("；"));
      }
      return { file: f, input, transcript };
    } finally {
      if (video?.src) URL.revokeObjectURL(video.src);
    }
  };

  /**
   * 第二段：传截图、让 AI 拆。失败了可以只重来这一段。
   * Dify 嫌请求太大（payload_too_large）时，自动把截图压小一半再试一次——
   * 线上踩过两次（见 lib/video-frames 的 SHEETS_BYTE_BUDGET），这是最后一道兜底，不用用户动手。
   */
  const generate = async (p: Prepared) => {
    let sheets = p.input.sheets;
    for (let attempt = 0; ; attempt++) {
      try {
        await generateWith(p, sheets);
        return;
      } catch (e) {
        if (attempt > 0 || !(e instanceof DifyStreamError) || e.code !== "payload_too_large") throw e;
        setStage("upload");
        setProgress("截图压小一点再试");
        sheets = await shrinkSheets(sheets, SHEETS_BYTE_BUDGET / 2);
      }
    }
  };

  const generateWith = async (p: Prepared, sheets: Blob[]) => {
    const isCurrent = beginProfileRequest();
    const historyOwnerId = await getHistoryOwner();
    setLoadedFileName(p.file.name);
    setStage("upload");
    setProgress("");
    const ids = await uploadSheets(sheets, (d, t) => setProgress(`${d}/${t} 张`));

    setStage("ai");
    setProgress("");
    const profileSummary = withProfile && profile ? buildProfileSummary(profile) : undefined;
    const query = buildBreakdownPrompt({
      duration: p.input.duration,
      fullDuration: p.input.fullDuration,
      truncated: p.input.truncated,
      width: p.input.width,
      height: p.input.height,
      shots: p.input.shots,
      frames: p.input.frames,
      sheetCount: ids.length,
      transcript: p.transcript,
      pastedScript,
      meta,
      profileSummary,
      contextBlock: profileSummary ? buildContextBlock(context, 'breakdown') : undefined,
    });
    const historyId = createHistoryId();
    const historyInput = {
      profileId: profile?.id || null, profileName: profile?.profile_name ?? null,
      fileName: p.file.name, duration: Math.round(p.input.duration),
      fullDuration: Math.round(p.input.fullDuration), shots: p.input.shots.length,
      meta, pastedScript, withProfile: !!profileSummary,
      creationSettings: currentSettings,
    };
    const res = await fetchGeneration("/api/dify/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskType: BREAKDOWN_TASK_TYPE,
        query,
        imageFileIds: ids,
        profileId: profile?.id ?? null,
        historyId,
        historyInput,
        historyOwnerId,
      }),
    });
    if (!res.ok) await throwApiError(res, "拆解失败");
    const full = await readDifyStream(res, {
      onChunk: (_p, text) => { if (isCurrent()) setResult(text); },
      onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
    });
    if (full.trim()) {
      await saveCreativeHistory({ id: historyId, taskType: BREAKDOWN_TASK_TYPE, profileId: profile?.id as string || null, ownerId: historyOwnerId, inputData: historyInput, result: full });
    }
  };

  const generateText = async () => {
    const isCurrent = beginProfileRequest();
    const historyOwnerId = await getHistoryOwner();
    const historyId = createHistoryId();
    const historyInput = { profileId: profile?.id || null, textMode: true, pastedScript, meta, creationSettings: currentSettings, originContent: incomingSetup?.originContent || pastedScript };
    setStage('ai');
    const res = await fetchGeneration('/api/dify/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      taskType: BREAKDOWN_TASK_TYPE, profileId: profile?.id || null, historyId, historyInput, historyOwnerId,
      query: buildTextBreakdownPrompt(pastedScript, buildContextBlock(context, 'breakdown'), currentSettings),
    }) });
    if (!res.ok) await throwApiError(res, '拆解失败');
    const full = await readDifyStream(res, { onChunk: (_p, all) => { if (isCurrent()) setResult(all); } });
    if (full.trim()) await saveCreativeHistory({ id: historyId, taskType: BREAKDOWN_TASK_TYPE, profileId: profile?.id as string || null, ownerId: historyOwnerId, inputData: historyInput, result: full });
  };

  /** retry=true：用上次拆好的画面和口播，只重来传图和 AI 拆解 */
  const start = async (retry = false) => {
    if (running || autoSetup.preparing || (!textMode && !file) || (textMode && !pastedScript.trim())) return;
    if (ctxLoading) { notify('正在读取当前档案，请稍后再拆解', 'error'); return; }
    setRunning(true);
    const isCurrent = beginProfileRequest();
    const left = await checkQuota("breakdown");
    if (!isCurrent()) { setRunning(false); return; }
    if (left !== null && left <= 0) {
      openUpgrade("breakdown");
      setRunning(false);
      return;
    }
    setRunning(true);
    setResult("");
    setError("");
    if (!retry) {
      setNotice("");
      sheetUrls.forEach((u) => URL.revokeObjectURL(u));
      setSheetUrls([]);
    }
    try {
      if (textMode) { await generateText(); return; }
      if (!file) return;
      const p = retry && prepared?.file === file ? prepared : await prepare(file);
      setPrepared(p);
      await generate(p);
    } catch (e) {
      // 错误留在结果区，不只是一闪而过的提示——线上实测提示 3 秒就没了，用户只看到"一直转圈然后没了"
      setError(e instanceof VideoInputError ? e.message : isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "拆解失败，请重试");
    } finally {
      setRunning(false);
      setStage(null);
      setProgress("");
    }
  };

  const stageIndex = stage ? textMode ? 0 : STAGES.findIndex((s) => s.id === stage) : -1;

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="拆解爆款" subtitle={textMode ? "拆解已有文案与创作方案，找出值得保留的表达和可优化的部分" : "传一条爆款视频，逐镜头拆出它为什么火、你能学走什么"} />
          <CreationSetupNotice settings={autoSetup.settings} preparing={autoSetup.preparing} />
          <div className="mb-4 flex gap-2">
            <button type="button" onClick={() => setTextMode(false)} className="glass-panel rounded-xl px-3 py-2 text-[12px]" aria-pressed={!textMode}>拆视频</button>
            <button type="button" onClick={() => setTextMode(true)} className="glass-panel rounded-xl px-3 py-2 text-[12px]" aria-pressed={textMode}>拆文案 / 方案</button>
          </div>
          {textMode && <p className="mb-3 text-[12px] text-muted-foreground">文字已承接，点击开始拆解即可。画面与声音需上传视频后分析。</p>}

          {saveError && <p role="alert" className="mb-2 text-[12px] text-amber-600">{saveError} <button type="button" className="underline" onClick={() => void retrySave()}>重试保存</button></p>}
          <CollapsibleSection title={`历史记录（${history.length}）`} defaultOpen={false}>
            <p className="mb-2 text-[11.5px] text-muted-foreground">当前档案：{String(profile?.profile_name || '未关联档案')}。报告保存在当前账号的云端，不主动删除就一直保留，点击记录可恢复完整报告。</p>
            {history.length === 0 && <p className="mb-2 text-[12px] text-muted-foreground">当前档案还没有拆解记录，生成成功后会自动保存。</p>}
            <HistoryPanel items={history} title="拆解历史" showStats={false} onLoad={restoreHistory} onDelete={(id) => deleteHistory(id)} />
            <Link href="/history" className="mt-2 inline-block text-[11.5px] text-primary underline">查看这个账号的全部历史</Link>
          </CollapsibleSection>

          {!textMode && <CollapsibleSection title="上传视频" defaultOpen>
            <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            {file ? (
              <div className="glass-panel flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground">
                  <FileVideo className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                </span>
                {!running && (
                  <button type="button" onClick={() => setFile(null)} aria-label="换一个视频" className="rounded-full p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-7 text-center hover:border-primary/50 hover:bg-primary/[0.03]"
              >
                <Clapperboard className="h-6 w-6 text-primary" />
                <span className="text-[13px] font-medium text-foreground">选一条视频，或拖到这里</span>
                <span className="text-[11.5px] text-muted-foreground">mp4，{MAX_FILE_MB}MB 以内；超过 {MAX_DURATION_SEC / 60} 分钟只拆前 {MAX_DURATION_SEC / 60} 分钟</span>
              </button>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              抖音里点「分享 → 保存本地」就能拿到视频。视频本身不上传，只在你的浏览器里截图；截图和口播会交给 AI 分析，不保存。
            </p>
          </CollapsibleSection>}

          <CollapsibleSection title={textMode ? '待拆解文案 / 方案' : '补充信息（选填，填了拆得更准）'} defaultOpen={textMode}>
            <Field label="这条的数据" optional stacked hint="有粉丝数才能判断是不是真爆">
              <div className="grid grid-cols-3 gap-1.5">
                {NUM_FIELDS.map((f) => (
                  <input
                    key={f.key}
                    inputMode="numeric"
                    placeholder={f.label}
                    aria-label={f.label}
                    value={meta[f.key] === undefined ? "" : String(meta[f.key])}
                    onChange={(e) => setNum(f.key, e.target.value)}
                    className={INPUT_CLS}
                  />
                ))}
              </div>
            </Field>
            <Field label="标题 / 发布文案" optional stacked>
              <input value={meta.title ?? ""} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} className={INPUT_CLS} />
            </Field>
            <Field label="行业" optional stacked>
              <input value={meta.industry ?? ""} placeholder="例如：烧烤店、美甲、装修" onChange={(e) => setMeta((m) => ({ ...m, industry: e.target.value }))} className={INPUT_CLS} />
            </Field>
            <Field label="想重点看什么" optional stacked>
              <input value={meta.focus ?? ""} placeholder="例如：开头怎么留人、怎么引导到店" onChange={(e) => setMeta((m) => ({ ...m, focus: e.target.value }))} className={INPUT_CLS} />
            </Field>
            <Field label={textMode ? '文案 / 方案内容' : '视频文案'} optional={!textMode} required={textMode} stacked hint={textMode ? '跳转带入的内容已填好，可以直接开始拆解' : '纯音乐的视频识别不出口播；有文案可以贴这里'}>
              <textarea value={pastedScript} onChange={(e) => setPastedScript(e.target.value)} rows={3} className={TEXTAREA_CLS} />
            </Field>
          </CollapsibleSection>

          {profile && (
            <label className="flex cursor-pointer items-start gap-2.5 px-1 text-[12.5px] text-foreground">
              <input type="checkbox" checked={withProfile} onChange={(e) => setWithProfile(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span>
                结合「{String(profile.profile_name || "当前档案")}」，最后给 3 个能直接拍的选题
                <span className="block text-[11.5px] text-muted-foreground">侧边栏切换档案，这里跟着变</span>
              </span>
            </label>
          )}

          <button type="button" onClick={() => start()} disabled={autoSetup.preparing || ctxLoading || (textMode ? !pastedScript.trim() : !file) || running} className={GENERATE_BTN}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {running ? "拆解中…" : "开始拆解"}
          </button>

          {running && (
            <ol className="space-y-1.5 px-1 text-[12.5px]">
              {(textMode ? [STAGES[3]] : STAGES).map((s, i) => (
                <li key={s.id} className={`flex items-center gap-2 ${i < stageIndex ? "text-emerald-600 dark:text-emerald-400" : i === stageIndex ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {i < stageIndex ? <Check className="h-3.5 w-3.5" /> : i === stageIndex ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}
                  {textMode ? "AI 文案拆解" : s.label}
                  {i === stageIndex && progress && <span className="text-muted-foreground">· {progress}</span>}
                </li>
              ))}
              <li className="pt-1 text-[11.5px] text-muted-foreground">{textMode ? '正在分析已带入的文字，请稍候' : '一条 3 分钟的视频大约 5 分钟；请停在这个页面'}</li>
            </ol>
          )}
        </>
      }
    >
      {notice && <p className="mb-3 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] text-amber-700 dark:text-amber-400">{notice}</p>}
      {error && !running && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3">
          <p className="text-[13px] text-destructive">拆解没完成：{error}</p>
          {prepared && prepared.file === file && (
            <button type="button" onClick={() => start(true)} className="rounded-lg bg-destructive/10 px-3 py-1.5 text-[12.5px] font-medium text-destructive hover:bg-destructive/15">
              重新拆解（不用重新识别，次数没扣）
            </button>
          )}
        </div>
      )}

      <ResultPanel
        result={result}
        isGenerating={running && stage === "ai"}
        title="拆解报告"
        flowContext={{ settings: settingsForResult(result, history, currentSettings), originContent: originForResult(result, history, incomingSetup?.originContent || pastedScript) }}
        showStats={false}
        emptyIcon={Clapperboard}
        emptyTitle={textMode ? running ? "正在分析已带入的文字…" : "拆解已有文案，继续完善创作" : running ? "正在准备画面和口播…" : "传一条爆款视频，逐镜头拆给你看"}
        emptyHint={textMode ? "分析开篇、结构与表达，保留原意并给出可继续创作的文案" : "拆开篇怎么留人、结构怎么搭、每个镜头拍了什么，最后告诉你能学走什么"}
        emptyTips={textMode ? ["跳转带入的文案与设置已保留", "文字分析只依据已有内容，画面与声音需上传视频", "拆完可以继续二创、审稿、选题或脚本创作"] : ["挑和你同行业、或者你想学的那一类", "点赞是粉丝的几倍才算真爆——填上数据拆得更准", "拆完可以结合你的档案，直接给 3 个能拍的选题"]}
        generatingHint={textMode ? "AI 正在分析文案与结构…" : "AI 正在逐镜头拆解…"}
        bodyClassName={SHOT_CARD_CLS}
        nextActions={[
          {
            // 拆完直接接二创：整份报告带过去（走 sessionStorage，不走地址栏），不用复制粘贴
            label: "拿去二创到我的店",
            icon: Shuffle,
            onClick: (body) => {
              // 和「继续创作」同一套：目的、行业设置跟着走，持久保存后再跳（刷新、换设备能接着）
              openCreationSafely({
                ...buildCreationHandoff('breakdown', 'remix', body, { settings: settingsForResult(result, history, currentSettings), originContent: originForResult(result, history, incomingSetup?.originContent || pastedScript) }),
                from: BREAKDOWN_TASK_TYPE,
                remixSource: { title: loadedFileName || file?.name, text: body },
              }, (u) => router.push(u), (m) => notify(m, 'error'));
            },
          },
        ]}
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
      />

      {sheetUrls.length > 0 && (
        <section className="glass-panel mt-4 rounded-2xl p-4">
          <button type="button" onClick={() => setShowSheets(!showSheets)} className="flex items-center gap-1.5 text-[13px] font-medium text-foreground" aria-expanded={showSheets}>
            <ChevronDown className={`h-4 w-4 transition-transform ${showSheets ? "" : "-rotate-90"}`} />
            AI 看到的画面（{sheetUrls.length} 张拼图）
          </button>
          <p className="mt-1 text-[11.5px] text-muted-foreground">每格上面是时间和镜头号；橙色是开头 3 秒加密截的。拆解里说&quot;镜头几&quot;就是这里的编号</p>
          {showSheets && (
            <div className="mt-3 grid gap-3">
              {sheetUrls.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt={`第 ${i + 1} 张拼图`} className="w-full rounded-lg border border-border" />
              ))}
            </div>
          )}
        </section>
      )}

    </WorkspaceLayout>
  );
}
