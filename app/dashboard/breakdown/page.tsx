"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clapperboard, FileVideo, Loader2, ScanSearch, X } from "lucide-react";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, TEXTAREA_CLS, GENERATE_BTN } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { notify } from "@/components/ui/feedback";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { useRestoreLastResult } from "@/hooks/useRestoreLastResult";
import { checkQuota, saveGenerationHistory } from "@/lib/history";
import { openUpgrade } from "@/lib/upgrade";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError } from "@/lib/api-error";
import { readDifyStream } from "@/lib/sse-stream";
import { buildProfileSummary } from "@/lib/profile-summary";
import {
  MAX_DURATION_SEC,
  MAX_FILE_MB,
  VideoInputError,
  audioSegments,
  extractAudio,
  prepareVideo,
} from "@/lib/video-frames";
import { transcribeSegments, uploadSheets } from "@/lib/breakdown-client";
import { BREAKDOWN_TASK_TYPE, buildBreakdownPrompt, type VideoMeta } from "@/lib/viral-breakdown";

type Stage = "frames" | "audio" | "upload" | "ai";
const STAGES: { id: Stage; label: string }[] = [
  { id: "frames", label: "拆画面：找镜头切换、截图" },
  { id: "audio", label: "识别口播" },
  { id: "upload", label: "把截图交给 AI" },
  { id: "ai", label: "AI 逐镜头拆解" },
];

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
  const { history, loadHistory, deleteHistory, lastResult } = useGenerationPage({ taskType: BREAKDOWN_TASK_TYPE });
  const { context } = useCreatorContext();
  const profile = context.profile as Record<string, unknown> | null;

  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta>({});
  const [pastedScript, setPastedScript] = useState("");
  const [withProfile, setWithProfile] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");
  const [sheetUrls, setSheetUrls] = useState<string[]>([]);
  const [showSheets, setShowSheets] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // 切页面回来，把最近一次拆解取回来显示
  useRestoreLastResult(lastResult, setResult);

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

  const start = async () => {
    if (!file || running) return;
    const left = await checkQuota("breakdown");
    if (left !== null && left <= 0) {
      openUpgrade("breakdown");
      return;
    }
    setRunning(true);
    setResult("");
    setNotice("");
    sheetUrls.forEach((u) => URL.revokeObjectURL(u));
    setSheetUrls([]);
    let video: HTMLVideoElement | null = null;
    try {
      setStage("frames");
      setProgress("");
      const prepared = await prepareVideo(file, (s, p) => setProgress(p === undefined ? s : `${s} ${Math.round(p * 100)}%`));
      video = prepared.video;
      const input = prepared.input;
      setSheetUrls(input.sheets.map((b) => URL.createObjectURL(b)));
      if (input.truncated) {
        setNotice(`这条视频有 ${Math.round(input.fullDuration / 60)} 分多钟，只拆了前 ${MAX_DURATION_SEC / 60} 分钟——决定留不留人的就是开头这一段`);
      }

      setStage("audio");
      setProgress("解出音轨");
      const audio = await extractAudio(file, audioSegments(input.shots, input.duration));
      const transcript = audio.length ? await transcribeSegments(audio, (d, t) => setProgress(`${d}/${t} 段`)) : [];
      const heard = transcript.some((t) => t.text.trim());
      if (!heard && !pastedScript.trim()) {
        setNotice((n) => [n, "没识别出口播（可能是纯画面 + 音乐）。有文案的话，贴到左边「视频文案」里再拆一次会更准"].filter(Boolean).join("；"));
      }

      setStage("upload");
      const ids = await uploadSheets(input.sheets, (d, t) => setProgress(`${d}/${t} 张`));

      setStage("ai");
      setProgress("");
      const profileSummary = withProfile && profile ? buildProfileSummary(profile) : undefined;
      const query = buildBreakdownPrompt({
        duration: input.duration,
        fullDuration: input.fullDuration,
        truncated: input.truncated,
        width: input.width,
        height: input.height,
        shots: input.shots,
        frames: input.frames,
        sheetCount: ids.length,
        transcript,
        pastedScript,
        meta,
        profileSummary,
      });
      const res = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: BREAKDOWN_TASK_TYPE,
          query,
          imageFileIds: ids,
          profileId: withProfile ? (profile?.id as string | undefined) ?? null : null,
        }),
      });
      if (!res.ok) await throwApiError(res, "拆解失败");
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => setResult(text),
        onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
      });
      if (full.trim()) {
        await saveGenerationHistory(
          BREAKDOWN_TASK_TYPE,
          {
            fileName: file.name,
            duration: Math.round(input.duration),
            fullDuration: Math.round(input.fullDuration),
            shots: input.shots.length,
            meta,
            withProfile: !!profileSummary,
          },
          full
        );
        loadHistory();
      }
    } catch (e) {
      const msg =
        e instanceof VideoInputError ? e.message : isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "拆解失败，请重试";
      notify(msg, "error");
    } finally {
      if (video?.src) URL.revokeObjectURL(video.src);
      setRunning(false);
      setStage(null);
      setProgress("");
    }
  };

  const stageIndex = stage ? STAGES.findIndex((s) => s.id === stage) : -1;

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="拆解爆款" subtitle="传一条爆款视频，逐镜头拆出它为什么火、你能学走什么" />

          <CollapsibleSection title="上传视频" defaultOpen>
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
          </CollapsibleSection>

          <CollapsibleSection title="补充信息（选填，填了拆得更准）" defaultOpen={false}>
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
            <Field label="视频文案" optional stacked hint="纯音乐的视频识别不出口播；有文案可以贴这里">
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

          <button type="button" onClick={start} disabled={!file || running} className={GENERATE_BTN}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {running ? "拆解中…" : "开始拆解"}
          </button>

          {running && (
            <ol className="space-y-1.5 px-1 text-[12.5px]">
              {STAGES.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-2 ${i < stageIndex ? "text-emerald-600 dark:text-emerald-400" : i === stageIndex ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {i < stageIndex ? <Check className="h-3.5 w-3.5" /> : i === stageIndex ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}
                  {s.label}
                  {i === stageIndex && progress && <span className="text-muted-foreground">· {progress}</span>}
                </li>
              ))}
              <li className="pt-1 text-[11.5px] text-muted-foreground">一条 3 分钟的视频大约 5 分钟；请停在这个页面</li>
            </ol>
          )}
        </>
      }
    >
      {notice && <p className="mb-3 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] text-amber-700 dark:text-amber-400">{notice}</p>}

      <ResultPanel
        result={result}
        isGenerating={running && stage === "ai"}
        title="拆解报告"
        showStats={false}
        emptyIcon={Clapperboard}
        emptyTitle={running ? "正在准备画面和口播…" : "传一条爆款视频，逐镜头拆给你看"}
        emptyHint="拆开篇怎么留人、结构怎么搭、每个镜头拍了什么，最后告诉你能学走什么"
        emptyTips={["挑和你同行业、或者你想学的那一类", "点赞是粉丝的几倍才算真爆——填上数据拆得更准", "拆完可以结合你的档案，直接给 3 个能拍的选题"]}
        generatingHint="AI 正在逐镜头拆解…"
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
          <p className="mt-1 text-[11.5px] text-muted-foreground">每格上面是时间和镜头号；橙色是开头 3 秒加密截的。拆解里说"镜头几"就是这里的编号</p>
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

      <div className="mt-4">
        <HistoryPanel
          items={history}
          title="拆过的视频"
          showStats={false}
          onLoad={(item) => setResult(item.result)}
          onDelete={(id) => deleteHistory(id)}
        />
      </div>
    </WorkspaceLayout>
  );
}
