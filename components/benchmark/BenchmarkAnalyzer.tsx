"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wand2, X } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { buildContextBlock } from "@/lib/creator-context";
import { fetchGeneration, isNetworkError, NETWORK_ERROR_HINT, throwApiError } from "@/lib/api-error";
import { readDifyStream } from "@/lib/sse-stream";
import { postSafely } from "@/lib/safe-post";
import { prepareVideo, extractAudio, audioSegments } from "@/lib/video-frames";
import { transcribeSegments, uploadSheets } from "@/lib/breakdown-client";
import {
  BENCHMARK_TASK_TYPE,
  buildBenchmarkQuery,
  checkMaterials,
  classifyMaterial,
  summarizeMaterials,
} from "@/lib/benchmark-analysis";
import { collectionSummary, COVER_PREFIX, formatCollection, type Collection } from "@/lib/benchmark-collection";
import { BenchmarkReport } from "@/components/benchmark/BenchmarkReport";
import { clearDraft, DRAFT_THROTTLE_MS, readDraft, saveDraft } from "@/lib/report-draft";
import { canStartFromCapture, preserveUserText } from "@/lib/collect-link-client";

/**
 * 对标拆解（整改 C · 对标拆解）：编导放进来的截图、文档、文字、视频，统一拆成同一套框架。
 * 视频的抽帧、语音转文字、图片上传都复用拆解爆款的现成流程；原始材料不保存，只保存报告。
 */

interface VideoRead { name: string; frames: number; speechChars: number; truncated: boolean; text: string }
interface DocRead { name: string; text: string }

/** 截图、封面传上去拿编号，生成时让模型看图（账号诊断也用它） */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("/api/breakdown/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.id !== "string") throw new Error(data.error || "截图上传失败，请重试");
  return data.id;
}

async function readDocument(file: File): Promise<DocRead> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("/api/benchmark/material-text", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "文档读取失败，请重试");
  return { name: String(data.name ?? file.name), text: String(data.text ?? "") };
}

export function BenchmarkAnalyzer({ accountId, accountName, platform, onSaved, incoming }: {
  accountId: string;
  accountName: string;
  platform: string | null;
  onSaved: () => void;
  /**
   * 「开物 · 截屏带入」插件带来的截图和一键采集的数据（components/benchmark/CaptureBridge）；nonce 变了才加，同一批不重复加。
   * 带了采集数据就直接开始拆：编导在插件里点「一键采集」时已经确认过材料可以使用（插件面板上写明了）
   */
  incoming?: { files: File[]; collected?: Collection | null; nonce: number };
}) {
  const { context } = useCreatorContext();
  const [pasted, setPasted] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [collected, setCollected] = useState<Collection | null>(null);
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");
  // 本地草稿（lib/report-draft）：生成中随时存，存服务器成功才清；刷新、关页面、保存失败都不丢
  const draftKey = `benchmark:${accountId}`;
  const [draftNote, setDraftNote] = useState("");
  const lastDraftAt = useRef(0);
  const saveReport = async (full: string, materials: string[]) => {
    const saved = await postSafely("/api/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveAnalysis", accountId, report: full, materials }),
    });
    if (!saved.ok) await throwApiError(saved, "拆解结果没保存上，报告先留在页面上，也存在了这台电脑的浏览器里，下次打开会自动再存");
    clearDraft(draftKey);
    setDraftNote("");
  };
  // 打开页面时：上次写完没存上的自动补存；没写完的摆出来给编导看
  useEffect(() => {
    const d = readDraft(draftKey);
    if (!d) return;
    setReport(d.report);
    if (!d.done) {
      setDraftNote("这是上次没写完的拆解（页面中途关了或刷新了），只存在这台电脑上。可以看，也可以重新拆一次。");
      return;
    }
    setDraftNote("上次拆完没存上，正在补存……");
    saveReport(d.report, d.materials)
      .then(() => { setReport(""); setDraftNote("上次没存上的拆解已经补存好了，在下面「已保存的拆解」里（最新一份已展开）"); onSaved(); })
      .catch(() => setDraftNote("上次拆完没存上，报告在下面；这台电脑上留着，下次打开会再试着保存"));
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const handled = useRef(0); // 同一批只处理一次（开发模式下 effect 会跑两遍，不能拆两次）
  useEffect(() => {
    if (!incoming || handled.current === incoming.nonce) return;
    handled.current = incoming.nonce;
    const nextFiles = [...files, ...incoming.files];
    setFiles(nextFiles);
    if (!incoming.collected) return;
    setCollected(incoming.collected);
    setConsent(true);
    // 备注框里的字原样留着，不把采集正文写进去。结果区已有内容时只挂上采集，不 setReport("") 重开
    if (!canStartFromCapture(report)) {
      setDraftNote("采集到了，没有盖掉你已经写的拆解，文字框里的内容也还在。材料已经挂上，想用这次采集再拆，点下面「开始拆解」。");
      return;
    }
    void run({ files: nextFiles, pasted: preserveUserText(pasted), collected: incoming.collected, consent: true });
  }, [incoming?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  // 插件带来的数据要在同一轮里直接开拆，那时状态还没更新，所以材料从参数传进来；手动点按钮用当前状态
  const run = async (input: { files: File[]; pasted: string; collected: Collection | null; consent: boolean } = { files, pasted, collected, consent }) => {
    const { files, pasted, collected, consent } = input;
    if (running) return;
    if (!consent) return notify("先勾选确认：这些材料是你可以合法查看和使用的", "error");
    if (!files.length && !pasted.trim() && !collected) return notify("至少放一份材料，或者写几句对标的情况", "error");
    const problem = checkMaterials(files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
    if (problem) return notify(problem, "error");

    setRunning(true);
    setReport("");
    try {
      const imageIds: string[] = [];
      const docs: DocRead[] = [];
      const videos: VideoRead[] = [];
      let images = 0;

      for (const file of files) {
        const kind = classifyMaterial(file.name, file.type);
        if (kind === "image") {
          setProgress(`上传截图「${file.name}」`);
          imageIds.push(await uploadImage(file));
          images += 1;
        } else if (kind === "document") {
          setProgress(`读取文档「${file.name}」`);
          docs.push(await readDocument(file));
        } else if (kind === "video") {
          setProgress(`拆解视频「${file.name}」：抽画面`);
          const res = await prepareVideo(file, (s, p) => setProgress(p === undefined ? `${file.name}：${s}` : `${file.name}：${s} ${Math.round(p * 100)}%`));
          try {
            const input = res.input;
            setProgress(`「${file.name}」：解出音轨`);
            const audio = await extractAudio(file, audioSegments(input.shots, input.duration));
            const transcript = audio.length ? await transcribeSegments(audio, (d, t) => setProgress(`「${file.name}」：识别口播 ${d}/${t} 段`)) : [];
            const speech = transcript.map((t) => t.text.trim()).filter(Boolean).join(" ");
            setProgress(`「${file.name}」：上传画面`);
            imageIds.push(...(await uploadSheets(input.sheets, (d, t) => setProgress(`「${file.name}」：上传画面 ${d}/${t} 张`))));
            videos.push({ name: file.name, frames: input.shots.length, speechChars: speech.length, truncated: input.truncated, text: speech });
          } finally {
            if (res.video?.src) URL.revokeObjectURL(res.video.src);
          }
        }
      }

      const collectedText = collected ? formatCollection(collected) : "";
      const covers = files.filter((f) => f.name.startsWith(COVER_PREFIX)).length;
      const materialLines = [
        ...(collected ? [collectionSummary(collected)] : []),
        ...summarizeMaterials({
          images,
          texts: [...(pasted.trim() ? [{ name: "编导粘贴的文字", chars: pasted.trim().length }] : []), ...docs.map((d) => ({ name: d.name, chars: d.text.length }))],
          videos: videos.map((v) => ({ name: v.name, frames: v.frames, speechChars: v.speechChars, truncated: v.truncated })),
        }).filter((l) => !(collected && l === "没有提供材料")),
        ...(covers ? [`其中 ${covers} 张是点赞最高的几条作品的封面（文件名带「${COVER_PREFIX}」）`] : []),
      ];
      const materialText = [
        collectedText,
        pasted.trim() ? `【编导粘贴的文字】\n${pasted.trim()}` : "",
        ...docs.map((d) => `【文档「${d.name}」】\n${d.text}`),
        ...videos.filter((v) => v.text).map((v) => `【视频「${v.name}」的口播】\n${v.text}`),
      ].filter(Boolean).join("\n\n");

      const query = buildBenchmarkQuery({
        accountName,
        platform,
        materialLines,
        materialText,
        contextBlock: context.profile ? buildContextBlock(context, "breakdown") : "",
      });

      setProgress("AI 拆解中");
      const res = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: BENCHMARK_TASK_TYPE,
          query,
          imageFileIds: imageIds,
          profileId: context.profile?.id ?? null,
        }),
      });
      if (!res.ok) await throwApiError(res, "拆解失败");
      setDraftNote("");
      const full = await readDifyStream(res, {
        onChunk: (_p, text) => {
          setReport(text);
          // 边写边存草稿（隔 2 秒存一次）：中途刷新、关页面也留得住
          if (Date.now() - lastDraftAt.current >= DRAFT_THROTTLE_MS) {
            lastDraftAt.current = Date.now();
            saveDraft(draftKey, { report: text, done: false, materials: materialLines });
          }
        },
      });
      if (!full.trim()) throw new Error("这次没拆出内容，可以再试一次");
      setReport(full);
      saveDraft(draftKey, { report: full, done: true, materials: materialLines });

      await saveReport(full, materialLines);
      // 存好了：这份就是下面「已保存的拆解」里展开的最新一份，这里不再重复摆一份
      setReport("");
      notify("拆解完成，已保存到这个对标账号下面（最新一份已展开）");
      onSaved();
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message, "error");
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-[12.5px] text-muted-foreground">
        截图、文档（TXT、Word、Excel、PPT、CSV）、视频（MP4、MOV，每个不超过 3 分钟）、粘贴的文字都可以。材料越全，拆得越准。
      </p>

      <textarea
        aria-label="对标的文字资料"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        rows={4}
        placeholder="可以粘贴：主页简介、近期作品标题、你看到的数据、你对他的判断……"
        className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
      />

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-foreground hover:bg-foreground/[0.06]">
        添加截图、文档或视频
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,.txt,.md,.docx,.xlsx,.csv,.pptx,.pdf"
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
      </label>

      {collected && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 px-3 py-2 text-[12.5px] text-foreground">
          <span className="min-w-0 truncate">{collectionSummary(collected)}{collected.profile.name && `（${collected.profile.name}）`}</span>
          <button type="button" onClick={() => setCollected(null)} aria-label="移除插件采集的数据" className="shrink-0 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
              <span className="min-w-0 truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} aria-label={`移除 ${f.name}`} className="shrink-0 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>我确认这些材料是我可以合法查看和使用的（比如我自己的截图、录屏，或者公开看到的内容）。分析完只保存报告，不保存原始文件。</span>
      </label>

      <button
        type="button"
        onClick={() => void run({ files, pasted, collected, consent })}
        disabled={running}
        className="brand-gradient inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {running ? (progress || "拆解中…") : "开始拆解"}
      </button>

      {draftNote && <p className="rounded-lg border border-primary/30 px-3 py-2 text-[12.5px] text-foreground">{draftNote}</p>}
      {report && <BenchmarkReport report={report} streaming={running} />}
    </div>
  );
}
