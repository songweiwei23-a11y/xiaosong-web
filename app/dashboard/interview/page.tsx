"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, FileUp, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, type Extraction } from "@/lib/interview-import";
import { throwApiError } from "@/lib/api-error";
import { notifyGenerated } from "@/lib/upgrade";
import { setActiveProfileId } from "@/lib/active-profile";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { notify } from "@/components/ui/feedback";
import { ReviewPanel, MissingList, buildPatch, initialDrafts, type FieldDraft } from "@/components/interview/ReviewPanel";

type Step = "input" | "working" | "review" | "done";
type ProfileRow = Record<string, unknown> & { id: string; profile_name?: string };

const NEW = "__new__";
const ACCEPT = ".docx,.txt,.md";

/** 等待时轮流显示的进度，实测一次 40 秒上下 */
const STAGES = ["正在读前采记录…", "正在对照档案的 34 个字段…", "正在核对每一项的原文依据…", "正在整理补问清单…"];

/**
 * 前采建档：编导把前采记录贴进来（或传 Word），AI 提取成档案字段，
 * 编导逐项确认后写进新档案或已有档案，然后直接去做账号定位。
 * 提取规则和校验见 lib/interview-import.ts。
 */
export default function InterviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [target, setTarget] = useState<string>(NEW);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [source, setSource] = useState("");
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});
  const [highlightOn, setHighlightOn] = useState<boolean[]>([]);
  const [profileName, setProfileName] = useState("");
  const [keepNotes, setKeepNotes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string; count: number; notesSaved: boolean } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const existing = target === NEW ? null : profiles.find((p) => p.id === target) ?? null;

  useEffect(() => {
    // 从档案编辑页点「用前采补充」进来时带着 ?profile=，默认补充那一份
    const want = new URLSearchParams(window.location.search).get("profile");
    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ProfileRow[]) => {
        if (!Array.isArray(rows)) return;
        setProfiles(rows);
        if (want && rows.some((p) => p.id === want)) setTarget(want);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "working") return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [step]);

  const chars = text.trim().length;
  const canStart = !!file || (chars >= MIN_SOURCE_CHARS && chars <= MAX_SOURCE_CHARS);

  const start = async () => {
    setError("");
    setElapsed(0);
    setStep("working");
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        res = await fetch("/api/interview/extract", { method: "POST", body: form });
      } else {
        res = await fetch("/api/interview/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }
      if (!res.ok) await throwApiError(res, "提取失败");

      const result = await readResult(res);
      const ex = result.extraction;
      setExtraction(ex);
      setSource(result.source);
      setDrafts(initialDrafts(ex, existing));
      setHighlightOn(ex.highlights.map(() => true));
      setProfileName(existing ? String(existing.profile_name ?? "") : ex.profileName);
      setStep("review");
      notifyGenerated();
    } catch (e) {
      setError((e as Error).message || "提取失败，请重试");
      setStep("input");
    }
  };

  const patch = extraction ? buildPatch(extraction, drafts, existing) : {};
  const patchCount = Object.keys(patch).length;

  const save = async () => {
    if (!extraction) return;
    if (!existing && !profileName.trim()) {
      notify("给新档案起个名字", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/interview/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: existing?.id ?? null,
          profileName: existing ? undefined : profileName.trim(),
          fields: patch,
          highlights: extraction.highlights.filter((_, i) => highlightOn[i]),
          notes: keepNotes ? source : "",
        }),
      });
      if (!res.ok) await throwApiError(res, "写入档案失败");
      const data = await res.json();
      invalidateCreatorContext();
      setSaved({ id: data.id, name: existing ? String(existing.profile_name ?? "") : profileName.trim(), count: patchCount, notesSaved: !!data.notesSaved });
      setStep("done");
    } catch (e) {
      notify((e as Error).message || "写入档案失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const goPositioning = () => {
    if (!saved) return;
    setActiveProfileId(saved.id);
    router.push("/dashboard/positioning");
  };

  const restart = () => {
    setStep("input");
    setExtraction(null);
    setSaved(null);
    setText("");
    setFile(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-9">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">前采建档</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          把前采记录贴进来，AI 帮你把客户的信息填进账号档案——每一项都标出原文依据，你确认了才写入。
          档案越准，账号定位越准。
        </p>
      </header>

      {step === "input" && (
        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-foreground">写进哪个档案</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13.5px] text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value={NEW}>新建一个档案</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  补充到「{String(p.profile_name || "未命名")}」
                </option>
              ))}
            </select>
            {existing && <p className="mt-1.5 text-[12.5px] text-muted-foreground">原来填过的不会被直接覆盖：和档案不一样的地方，下一步由你来选。</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-medium text-foreground">前采记录</label>
              {!file && (
                <span className={`text-[12px] tabular-nums ${chars > MAX_SOURCE_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                  {chars} / {MAX_SOURCE_CHARS} 字
                </span>
              )}
            </div>

            {file ? (
              <div className="glass-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-foreground">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{file.name}</span>
                </span>
                <button type="button" onClick={() => setFile(null)} aria-label="移除文件" className="rounded-full p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder={"把前采的问答、和客户的聊天记录、录音转写的文字直接粘贴进来。\n\n例如：\n问：店里主打什么？\n答：主打鲜切牛肉，每天早上六点现拉现切……"}
                className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-3 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-foreground/[0.06]"
              >
                <FileUp className="h-4 w-4" /> 上传 Word / 文本文件
              </button>
              <span className="text-[12px] text-muted-foreground">支持 .docx、.txt。录音可以先用飞书妙记、讯飞听见转成文字再贴进来</span>
            </div>
          </div>

          {error && <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={start}
              disabled={!canStart}
              className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" /> 开始提取
            </button>
            <span className="text-[12px] text-muted-foreground">用一次「前采建档」次数，大约 40 秒。手机号、身份证号不会进档案</span>
          </div>
        </div>
      )}

      {step === "working" && (
        <div className="glass-panel mt-6 flex flex-col items-center rounded-2xl px-6 py-14 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-[15px] font-medium text-foreground">{STAGES[Math.min(STAGES.length - 1, Math.floor(elapsed / 10))]}</p>
          <p className="mt-1.5 text-[12.5px] tabular-nums text-muted-foreground">已用 {elapsed} 秒，一般 40 秒左右。请停在这个页面，切走了结果会收不到</p>
        </div>
      )}

      {step === "review" && extraction && (
        <div className="mt-6 space-y-5">
          <div className="glass-panel rounded-2xl p-4 sm:p-5">
            <div className="text-[13.5px] text-foreground">
              提取出 <b>{extraction.fields.length}</b> 项
              {extraction.fields.some((f) => f.unverified) && (
                <>，其中 <b className="text-amber-600 dark:text-amber-400">{extraction.fields.filter((f) => f.unverified).length}</b> 项需要核对</>
              )}
              。检查一下，不对的改掉或取消勾选。
            </div>
            {existing ? (
              <p className="mt-2 text-[13px] text-muted-foreground">写入档案：「{String(existing.profile_name ?? "")}」</p>
            ) : (
              <div className="mt-3">
                <label className="mb-1.5 block text-[12.5px] text-muted-foreground">新档案名称</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  maxLength={30}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-[13.5px] text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>

          <ReviewPanel
            extraction={extraction}
            existing={existing}
            drafts={drafts}
            onDraft={(key, d) => setDrafts((prev) => ({ ...prev, [key]: d }))}
            highlights={highlightOn}
            onHighlight={(i, on) => setHighlightOn((prev) => prev.map((x, j) => (j === i ? on : x)))}
          />

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-foreground">
            <input type="checkbox" checked={keepNotes} onChange={(e) => setKeepNotes(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>
              把前采原文也存进档案
              <span className="block text-[12px] text-muted-foreground">以后再补前采会接在后面；随时可以在档案编辑页删掉</span>
            </span>
          </label>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur">
            <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
              <RotateCcw className="h-4 w-4" /> 重新导入
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || (patchCount === 0 && !keepNotes && !highlightOn.some(Boolean))}
              className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              写入档案（{patchCount} 项）
            </button>
          </div>
        </div>
      )}

      {step === "done" && saved && (
        <div className="mt-6 space-y-5">
          <div className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <h2 className="text-[18px] font-semibold text-foreground">已写入「{saved.name}」</h2>
            </div>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              写入 {saved.count} 项档案信息{saved.notesSaved ? "，前采原文和要点也存好了" : ""}。现在拿这份档案做账号定位，会比凭赛道去猜准得多。
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button type="button" onClick={goPositioning} className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white">
                用这份档案做账号定位 <ArrowRight className="h-4 w-4" />
              </button>
              <Link href={`/dashboard/profiles/${saved.id}/edit`} className="glass-panel inline-flex items-center rounded-xl px-4 py-2.5 text-[13.5px] text-foreground">
                查看、修改档案
              </Link>
              <button type="button" onClick={restart} className="inline-flex items-center rounded-xl px-4 py-2.5 text-[13.5px] text-muted-foreground hover:text-foreground">
                再导入一份
              </button>
            </div>
          </div>
          {extraction && extraction.missing.length > 0 && <MissingList missing={extraction.missing} />}
        </div>
      )}
    </div>
  );
}

/** 读提取接口的 SSE：心跳行跳过，等最后那条结果或错误 */
async function readResult(res: Response): Promise<{ extraction: Extraction; source: string }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("读取结果失败，请重试");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const ev of events) {
      const line = ev.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.event === "error") throw new Error(data.message || "提取失败，请重试");
      if (data.event === "result") return { extraction: data.extraction, source: data.source };
    }
    if (done) break;
  }
  throw new Error("和服务器的连接断了，请重试");
}
