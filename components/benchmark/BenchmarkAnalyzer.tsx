"use client";

import { useState } from "react";
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

/**
 * 对标拆解（整改 C · 对标拆解）：编导放进来的截图、文档、文字、视频，统一拆成同一套框架。
 * 视频的抽帧、语音转文字、图片上传都复用拆解爆款的现成流程；原始材料不保存，只保存报告。
 */

interface VideoRead { name: string; frames: number; speechChars: number; truncated: boolean; text: string }
interface DocRead { name: string; text: string }

async function uploadImage(file: File): Promise<string> {
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

export function BenchmarkAnalyzer({ accountId, accountName, platform, onSaved }: {
  accountId: string;
  accountName: string;
  platform: string | null;
  onSaved: () => void;
}) {
  const { context } = useCreatorContext();
  const [pasted, setPasted] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const run = async () => {
    if (running) return;
    if (!consent) return notify("先勾选确认：这些材料是你可以合法查看和使用的", "error");
    if (!files.length && !pasted.trim()) return notify("至少放一份材料，或者写几句对标的情况", "error");
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

      const materialLines = summarizeMaterials({
        images,
        texts: [...(pasted.trim() ? [{ name: "编导粘贴的文字", chars: pasted.trim().length }] : []), ...docs.map((d) => ({ name: d.name, chars: d.text.length }))],
        videos: videos.map((v) => ({ name: v.name, frames: v.frames, speechChars: v.speechChars, truncated: v.truncated })),
      });
      const materialText = [
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
      const full = await readDifyStream(res, { onChunk: (_p, text) => setReport(text) });
      if (!full.trim()) throw new Error("这次没拆出内容，可以再试一次");
      setReport(full);

      const saved = await postSafely("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveAnalysis", accountId, report: full, materials: materialLines }),
      });
      if (!saved.ok) await throwApiError(saved, "拆解结果没保存上，报告先留在页面上");
      notify("拆解完成，已保存到这个对标账号下面");
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
        onClick={() => void run()}
        disabled={running}
        className="brand-gradient inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {running ? (progress || "拆解中…") : "开始拆解"}
      </button>

      {report && (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-foreground">{report}</pre>
        </div>
      )}
    </div>
  );
}
