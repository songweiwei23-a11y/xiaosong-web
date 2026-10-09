"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, Loader2, Plus, Telescope, X } from "lucide-react";
import { DEPTHS, readPlan, type ResearchPlan, type ResearchStatus, type ResearchStep } from "@/lib/research";
import type { ResearchMeta } from "@/lib/research-meta";
import { postSafely } from "@/lib/safe-post";

/**
 * 深度研究在对话里的那条回答（2026-10-04）：拟计划中 → 改计划、确认 → 查资料进度 → 报告。
 * 报告写完交给页面放进这条回答的正文（onUpdate），之后和普通回答一样复制、画布、Word / PDF、继续创作。
 * 研究在服务端跑，关掉页面也会继续；回来这张卡片接着显示进度。
 */
interface Job {
  id: string; status: ResearchStatus; depth: ResearchMeta["depth"]; plan?: ResearchPlan; steps?: ResearchStep[];
  report?: string; error?: string; progress?: string; retry_count?: number; summary_failed?: boolean;
}
const RUNNING: ResearchStatus[] = ["planning", "running", "writing"];

export function ResearchCard({ meta, profileId, hasReport, onUpdate }: {
  meta: ResearchMeta;
  profileId: string | null;
  hasReport: boolean;
  onUpdate: (patch: { content?: string; research: ResearchMeta }) => void;
}) {
  const settled = meta.status === "done" && !meta.partial && hasReport;
  const [job, setJob] = useState<Job | null>(null);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const update = useRef(onUpdate);
  const metaRef = useRef(meta);
  useEffect(() => { update.current = onUpdate; metaRef.current = meta; });
  const reported = useRef("");

  const url = `/api/research?id=${meta.jobId}&profileId=${encodeURIComponent(profileId || "default")}`;

  useEffect(() => {
    if (settled) return;
    let off = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const d = await r.json();
        if (off) return;
        if (!r.ok) { setError(d.error || "研究进度读不到，稍后再看"); return; }
        setError("");
        setJob(d);
        setPlan((p) => (d.status === "plan_ready" ? p ?? d.plan ?? null : d.plan ?? null));
        const partial = d.status === "done" && (!!d.summary_failed || (d.steps || []).some((s: ResearchStep) => s.status !== "done"));
        const m = metaRef.current;
        const next: ResearchMeta = { ...m, status: d.status, ...(partial ? { partial: true } : {}) };
        if (!partial) delete next.partial;
        if (d.status === "done" && d.report && reported.current !== d.report) {
          reported.current = d.report;
          update.current({ content: d.report, research: next });
        } else if (m.status !== d.status || !!m.partial !== partial) {
          update.current({ research: next });
        }
        if (RUNNING.includes(d.status)) timer = setTimeout(load, 4000);
      } catch {
        if (!off) { setError("网络不稳，正在重试…"); timer = setTimeout(load, 8000); }
      }
    };
    void load();
    return () => { off = true; if (timer) clearTimeout(timer); };
  }, [url, settled, tick]);

  const act = async (action: "start" | "retry" | "cancel") => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await postSafely("/api/research", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: meta.jobId, action, ...(action === "start" ? { plan } : {}) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "没成功，请重试");
      setTick((t) => t + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (settled) return null;
  const wrap = "w-full text-left text-sm sm:min-w-[26rem]";
  const err = error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>;
  const field = "w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

  if (!job) return <div className={wrap}><p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />{error || "正在读取研究进度…"}</p></div>;

  if (job.status === "planning") {
    return <div className={wrap}>
      <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />正在拟研究计划，大约半分钟…</p>
      <button type="button" onClick={() => void act("cancel")} disabled={busy} className="mt-2 text-xs text-muted-foreground hover:text-foreground">不做了</button>
      {err}
    </div>;
  }

  if (job.status === "plan_ready" && plan) {
    const max = DEPTHS[job.depth]?.questions[1] ?? 8;
    const edit = (i: number, patch: Partial<{ q: string; queries: string[] }>) => setPlan({ ...plan, questions: plan.questions.map((q, n) => (n === i ? { ...q, ...patch } : q)) });
    const ok = !!readPlan(plan, job.depth) && plan.questions.every((q) => q.q.trim());
    return <div className={wrap}>
      <p className="flex items-center gap-1.5 font-medium text-foreground"><Telescope className="h-4 w-4 text-primary" />我打算这样查，你看看行不行</p>
      <p className="mb-2 mt-0.5 text-xs text-muted-foreground">问题和搜索词都能直接改、删、加。点「开始研究」才会去查，才扣 1 份。</p>
      <input value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} maxLength={80} aria-label="报告标题" className={`${field} mb-2 font-medium`} />
      <ol className="space-y-1.5">
        {plan.questions.map((q, i) => (
          <li key={i} className="group rounded-lg bg-muted/50 px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              <span className="mt-1.5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
              <input value={q.q} onChange={(e) => edit(i, { q: e.target.value })} maxLength={200} aria-label={`问题${i + 1}`} placeholder="想弄清楚的问题" className="min-w-0 flex-1 bg-transparent py-1 text-sm text-foreground outline-none" />
              <button type="button" onClick={() => setPlan({ ...plan, questions: plan.questions.filter((_, n) => n !== i) })} disabled={plan.questions.length <= 1} aria-label="删掉这个问题"
                className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
            </div>
            <input value={q.queries.join("、")} onChange={(e) => edit(i, { queries: e.target.value.split(/[、,，\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 3) })}
              aria-label={`问题${i + 1}的搜索词`} placeholder="搜索词，用顿号隔开" className="ml-4 w-[calc(100%-1rem)] bg-transparent text-xs text-muted-foreground outline-none" />
          </li>
        ))}
      </ol>
      {plan.questions.length < max && <button type="button" onClick={() => setPlan({ ...plan, questions: [...plan.questions, { q: "", queries: [] }] })} className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" />加一个问题</button>}
      {err}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button type="button" onClick={() => void act("cancel")} disabled={busy} className="text-xs text-muted-foreground hover:text-foreground">不做了</button>
        <button type="button" onClick={() => void act("start")} disabled={busy || !ok} className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}开始研究
        </button>
      </div>
    </div>;
  }

  const steps = job.steps || [];
  const questions = job.plan?.questions || [];
  const running = RUNNING.includes(job.status);
  const unfinished = steps.filter((s) => s.status !== "done").length;
  const canRetry = (job.retry_count || 0) < 3 && !!job.plan && (job.status === "failed" || job.status === "canceled" || (job.status === "done" && (unfinished > 0 || !!job.summary_failed)));
  const stepLabel: Record<string, string> = { pending: "排队中", searching: "在搜", reading: "在读网页", writing: "在整理", done: "", failed: "没查成" };

  // 报告已经在正文里了：只在有没查完的部分时露一行
  if (job.status === "done" && hasReport) {
    if (!canRetry) return null;
    return <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <span>{unfinished ? `有 ${unfinished} 个问题没查完` : "结论部分没写成"}，可以补一下</span>
      <button type="button" onClick={() => void act("retry")} disabled={busy} className="rounded-md bg-primary px-2.5 py-1 text-white disabled:opacity-50">补查</button>
      {err}
    </div>;
  }

  return <div className={wrap}>
    <p className="flex items-center gap-2 text-foreground">
      {running ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Telescope className="h-4 w-4 text-primary" />}
      <span className="font-medium">{job.plan?.title || meta.topic}</span>
    </p>
    <p className="mt-0.5 text-xs text-muted-foreground">{job.progress}{running ? " · 关掉页面也会接着查，回来就能看到" : ""}</p>
    {steps.length > 0 && (
      <ul className="mt-2 space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {s.status === "done" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              : s.status === "failed" ? <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              : s.status === "pending" ? <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
            <span className={s.status === "pending" ? "text-muted-foreground" : "text-foreground"}>
              {questions[i]?.q}
              <span className="text-muted-foreground">{stepLabel[s.status] ? ` · ${stepLabel[s.status]}` : ""}{s.read ? ` · 读了 ${s.read} 个网页` : ""}{s.error ? ` · ${s.error}` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    )}
    {job.status === "writing" && <p className="mt-2 text-xs text-muted-foreground">资料都读完了，正在写结论、整理报告…</p>}
    {!running && job.error && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{job.error}</p>}
    {err}
    <div className="mt-2 flex items-center gap-3">
      {running && <button type="button" onClick={() => void act("cancel")} disabled={busy} className="text-xs text-muted-foreground hover:text-foreground">停止</button>}
      {canRetry && <button type="button" onClick={() => void act("retry")} disabled={busy} className="rounded-lg brand-gradient px-3 py-1 text-xs font-medium text-white disabled:opacity-50">接着查没查完的</button>}
    </div>
  </div>;
}
