"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, FileUp, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, type Extraction, type Revision } from "@/lib/interview-import";
import { isNetworkError, NETWORK_ERROR_HINT, throwApiError } from "@/lib/api-error";
import { readSseResult } from "@/lib/sse-result";
import { postSafely } from "@/lib/safe-post";
import { exclusionsOf, residualMentions, dropSegment, type Residual } from "@/lib/interview-exclusions";

/**
 * 不超过这么大的文件编码进 JSON 走压缩 / 分块（lib/safe-post）。
 * base64 会涨三分之一，服务器分块暂存上限 2MB，留出余量；前采的 Word 文档一般几十到几百 KB
 */
const INLINE_FILE_MAX = 1.2 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
import { notifyGenerated } from "@/lib/upgrade";
import { setActiveProfileId } from "@/lib/active-profile";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { notify } from "@/components/ui/feedback";
import {
  ReviewPanel,
  MissingList,
  applyRevision,
  buildPatch,
  currentValues,
  initialDrafts,
  isFlagged,
  unresolvedKeys,
  type FieldDraft,
} from "@/components/interview/ReviewPanel";
import { ReviseChat } from "@/components/interview/ReviseChat";
import { InterviewHistory } from "@/components/interview/InterviewHistory";

type Step = "input" | "working" | "review" | "done";
type ProfileRow = Record<string, unknown> & { id: string; profile_name?: string };

const NEW = "__new__";
const ACCEPT = ".docx,.txt,.md";

/** 等待时轮流显示的进度。实测提取 40 秒上下，逐项核对再 25～30 秒 */
const STAGES = ["正在读前采记录…", "正在对照档案的 34 个字段…", "正在整理补问清单…", "正在逐项核对：有没有推测的、档位选错的…", "还在核对，快好了…"];

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
  /** 这次提取在历史记录里的那一条；对话改过、写入了都更新它 */
  const [importId, setImportId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const existing = target === NEW ? null : profiles.find((p) => p.id === target) ?? null;
  const profileNames = new Map(profiles.map((p) => [p.id, String(p.profile_name || "未命名")]));

  /** 进确认页：刚提取完、从历史记录点开，都走这里 */
  const openReview = (ex: Extraction, src: string, targetId: string, id: string | null) => {
    const ex0 = targetId === NEW ? null : profiles.find((p) => p.id === targetId) ?? null;
    setTarget(ex0 ? targetId : NEW);
    setExtraction(ex);
    setSource(src);
    setImportId(id);
    setDrafts(initialDrafts(ex, ex0));
    setHighlightOn(ex.highlights.map(() => true));
    setProfileName(ex0 ? String(ex0.profile_name ?? "") : ex.profileName);
    setStep("review");
  };

  /** 从历史记录点开：写入过的默认接着补那个档案，没写入的回到当时选的档案 */
  const openHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/interview/history?id=${encodeURIComponent(id)}`);
      if (!res.ok) await throwApiError(res, "这条记录打不开");
      const row = await res.json();
      const known = (pid: unknown) => typeof pid === "string" && profiles.some((p) => p.id === pid);
      const targetId = known(row.saved_profile_id) ? row.saved_profile_id : known(row.target_profile_id) ? row.target_profile_id : NEW;
      openReview(row.extraction as Extraction, String(row.source ?? ""), targetId, row.id);
      window.scrollTo({ top: 0 });
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "这条记录打不开", "error");
    }
  };

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
      const profileId = target === NEW ? "" : target;
      if (file && file.size <= INLINE_FILE_MAX) {
        // 文件编码进 JSON 走压缩 / 分块：直接上传在线路差时会被切断（超过约 8KB，见 lib/safe-post）
        const fileBase64 = await fileToBase64(file);
        res = await postSafely("/api/interview/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileBase64, profileId: profileId || undefined }),
        });
      } else if (file) {
        // 特别大的文件（超过分块暂存的上限）还是直接上传
        const form = new FormData();
        form.append("file", file);
        if (profileId) form.append("profileId", profileId);
        res = await fetch("/api/interview/extract", { method: "POST", body: form });
      } else {
        res = await postSafely("/api/interview/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, profileId: profileId || undefined }),
        });
      }
      if (!res.ok) await throwApiError(res, "提取失败");

      const result = await readSseResult<{ extraction: Extraction; source: string; importId?: string | null }>(res);
      openReview(result.extraction, result.source, target, result.importId ?? null);
      setHistoryKey((k) => k + 1);
      notifyGenerated();
    } catch (e) {
      // 网络断了的话，服务端可能已经收到、正在提取——不能只说"再试一次"，那样可能白花一次次数
      setError(
        isNetworkError(e)
          ? "网络断了一下。过一两分钟看看下面的历史记录：出现了这次的结果就直接点开，没出现再点一次开始提取"
          : (e as Error).message || "提取失败，请重试"
      );
      setHistoryKey((k) => k + 1);
      setStep("input");
    }
  };

  /** 编导跟 AI 说了哪里不对，AI 改完合进确认页 */
  const onRevised = (rev: Revision) => {
    if (!extraction) return;
    const next = applyRevision(extraction, drafts, rev, existing);
    setExtraction(next.extraction);
    setDrafts(next.drafts);
    if (rev.highlights) setHighlightOn(rev.highlights.map(() => true));
    if (rev.profileName && !existing) setProfileName(rev.profileName);
    // 改过的存进历史，下次打开是改过的。存不上不打扰编导，确认页上的照样能写入
    if (importId) {
      postSafely("/api/interview/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: importId, extraction: next.extraction }),
      }).catch(() => {});
    }
  };

  const patch = extraction ? buildPatch(extraction, drafts, existing) : {};
  const patchCount = Object.keys(patch).length;
  /** 编导没选的（见 lib/interview-exclusions）；以及别的栏里还在说这些的 */
  const excluded = extraction ? exclusionsOf(extraction, drafts, highlightOn) : [];
  const residuals = extraction ? residualMentions(extraction, drafts, excluded, existing ? String(existing.profile_name ?? "") : profileName) : [];
  const dropResidual = (r: Residual) =>
    setDrafts((prev) => {
      const d = prev[r.key];
      return d ? { ...prev, [r.key]: { ...d, text: dropSegment(d.text, r.segment) } } : prev;
    });
  /** 有疑问、还没处理的项。不为空不让写入（产品方：核对没问题再建档） */
  const pending = extraction ? unresolvedKeys(extraction, drafts) : [];
  const flaggedCount = extraction ? extraction.fields.filter((f) => isFlagged(f, extraction.checked)).length : 0;
  const goNextPending = () => {
    const key = pending[0];
    if (key) document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const save = async () => {
    if (!extraction) return;
    if (!existing && !profileName.trim()) {
      notify("给新档案起个名字", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await postSafely("/api/interview/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: existing?.id ?? null,
          profileName: existing ? undefined : profileName.trim(),
          fields: patch,
          highlights: extraction.highlights.filter((_, i) => highlightOn[i]),
          notes: keepNotes ? source : "",
          // 没选的记进档案的排除清单，之后所有板块当它不存在
          excluded,
          importId,
          extraction,
        }),
      });
      if (!res.ok) await throwApiError(res, "写入档案失败");
      const data = await res.json();
      invalidateCreatorContext();
      setHistoryKey((k) => k + 1);
      setSaved({ id: data.id, name: existing ? String(existing.profile_name ?? "") : profileName.trim(), count: patchCount, notesSaved: !!data.notesSaved });
      setStep("done");
    } catch (e) {
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message || "写入档案失败", "error");
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
    setImportId(null);
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
            <span className="text-[12px] text-muted-foreground">用一次「前采建档」次数，大约一分钟（提取 + 逐项核对）。手机号、身份证号不会进档案</span>
          </div>

          <InterviewHistory refreshKey={historyKey} profileNames={profileNames} onOpen={openHistory} />
        </div>
      )}

      {step === "working" && (
        <div className="glass-panel mt-6 flex flex-col items-center rounded-2xl px-6 py-14 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-[15px] font-medium text-foreground">{STAGES[Math.min(STAGES.length - 1, Math.floor(elapsed / 14))]}</p>
          <p className="mt-1.5 text-[12.5px] tabular-nums text-muted-foreground">已用 {elapsed} 秒，一般一分钟左右（提取完还要逐项核对）。可以先去别的页面，提取完会存进这里的历史记录</p>
        </div>
      )}

      {step === "review" && extraction && (
        <div className="mt-6 space-y-5">
          <div className="glass-panel rounded-2xl p-4 sm:p-5">
            {/* 产品方定的顺序：先核对 → 核对没问题、跟 AI 改完 → 再写入建档 */}
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
              {[
                { n: 1, label: pending.length > 0 ? `逐项核对（还剩 ${pending.length} 项）` : "逐项核对", done: pending.length === 0 },
                { n: 2, label: "跟 AI 说哪里不对", done: false },
                { n: 3, label: "写入档案", done: false },
              ].map((s, i) => (
                <li key={s.n} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/40">→</span>}
                  <span className={`flex items-center gap-1.5 ${s.done ? "text-emerald-600 dark:text-emerald-400" : i === 0 || pending.length === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-emerald-500/15" : "bg-primary/12 text-primary"}`}>
                      {s.done ? "✓" : s.n}
                    </span>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-3 text-[13.5px] leading-relaxed text-foreground">
              提取出 <b>{extraction.fields.length}</b> 项。
              {extraction.checked ? (
                <>
                  AI 已对照原文逐项核对：<b className="text-emerald-600 dark:text-emerald-400">{extraction.fields.filter((f) => f.check?.ok).length}</b> 项没问题，
                  <b className="text-amber-600 dark:text-amber-400">{flaggedCount}</b> 项有疑问。
                </>
              ) : (
                <>
                  这次没能逐项核对，其中 <b className="text-amber-600 dark:text-amber-400">{flaggedCount}</b> 项的依据在原文里对不上。
                </>
              )}
              {pending.length > 0
                ? "有疑问的每一项都要你看一眼：按建议改、确认没问题，或者不填。看完才能写入档案。"
                : "有疑问的都看过了。没问题的项也建议扫一眼。"}
            </div>
            {pending.length > 0 && (
              <button type="button" onClick={goNextPending} className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1.5 text-[12.5px] font-medium text-amber-700 dark:text-amber-400">
                去看下一项需核对的 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
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
            afterFields={
              <ReviseChat
                current={{
                  fields: currentValues(extraction, drafts),
                  highlights: extraction.highlights,
                  profileName: existing ? String(existing.profile_name ?? "") : profileName,
                }}
                source={source}
                importId={importId}
                onApply={onRevised}
              />
            }
          />

          {/*
            没选的东西：别的栏里还在说的先让编导一键去掉；剩下的记成排除清单，之后所有板块当它不存在。
            2026-10-02 线上：勾掉了「公益」「直播」那几条，选题方向、成交路径里还残留着，账号定位照样拿来当依据
          */}
          {excluded.length > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 sm:p-5">
              <h3 className="text-[15px] font-semibold text-foreground">你没选的内容</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                这 {excluded.length} 条会记进档案的「排除清单」，之后做账号定位、商业定位、内容定位、创作简报、写内容都当它不存在。
              </p>
              <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
                {excluded.map((x) => <li key={x} className="line-through decoration-muted-foreground/50">{x}</li>)}
              </ul>
              {residuals.length > 0 && (
                <div className="mt-3 border-t border-amber-500/20 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">别的栏里还在说这些（{residuals.length} 处），要一起去掉吗？</p>
                    <button type="button" onClick={() => residuals.forEach(dropResidual)} className="rounded-full border border-amber-500/40 px-3 py-1 text-[12px] text-amber-700 hover:bg-amber-500/10 dark:text-amber-400">
                      全部去掉
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {residuals.map((r) => (
                      <li key={`${r.key}-${r.segment}`} className="flex items-start justify-between gap-2 text-[12.5px]">
                        <span className="text-foreground">
                          <span className="text-muted-foreground">【{r.label}】</span>{r.segment}
                          <span className="ml-1 text-[11px] text-muted-foreground">（和你去掉的「{r.because.slice(0, 16)}…」有关）</span>
                        </span>
                        <button type="button" onClick={() => dropResidual(r)} className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground hover:text-foreground">
                          去掉这句
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">不去掉也没关系：排除清单会告诉 AI 忽略相关说法。去掉了档案更干净，判断更不容易跑偏。</p>
                </div>
              )}
            </section>
          )}

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
            {pending.length > 0 ? (
              // 核对没完不让写：点一下带去下一项要看的
              <button
                type="button"
                onClick={goNextPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-5 py-2.5 text-[14px] font-semibold text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-4 w-4" />
                还有 {pending.length} 项没核对
              </button>
            ) : (
              <button
                type="button"
                onClick={save}
                disabled={saving || (patchCount === 0 && !keepNotes && !highlightOn.some(Boolean))}
                className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                写入档案（{patchCount} 项）
              </button>
            )}
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
