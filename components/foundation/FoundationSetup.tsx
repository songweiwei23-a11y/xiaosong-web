"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { pickProfileForSetup } from "@/lib/setup-progress";
import { onProgressChanged } from "@/lib/progress-events";
import { ADVICE_PURPOSES, ADVICE_STAGES } from "@/lib/industry-advice";

/**
 * 地基一键生成（2026-10-24，方案 B）：建好档案后，账号定位、创作简报（必要）和行业建议（可选）一键生成。
 * 两条线并行，服务端在后台跑，关掉页面也照常保存。
 * 软强制：每个会话自动弹出一次；可以「稍后再说」，之后顶部一直有提示，直到地基打好。
 */

type Profile = { id: string; profile_name?: string | null };
type StepStatus = "waiting" | "running" | "done" | "skipped" | "error";
interface PublicStep { key: string; label: string; status: StepStatus; error: string | null }
interface PublicJob { id: string; profileId: string; status: "running" | "done" | "partial" | "error"; steps: PublicStep[] }
type Phase = "idle" | "prepare" | "running" | "done";

const CORE = ["账号定位", "创作简报"];
const STATUS_TEXT: Record<StepStatus, string> = {
  waiting: "等待中",
  running: "生成中…",
  done: "已完成",
  skipped: "已有，不重复生成",
  error: "没有完成",
};
const RESULT_LINKS: Record<string, { href: string; label: string }> = {
  positioning: { href: "/dashboard/positioning", label: "查看账号定位" },
  brief: { href: "/dashboard/creative-brief", label: "查看创作简报" },
  advice: { href: "/dashboard/industry-advice", label: "查看行业建议" },
};
const jobKey = (pid: string) => `kaiwu:foundation-job:${pid}`;
const dismissKey = (pid: string) => `kaiwu:foundation-dismissed:${pid}`;

function readFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(key: string) {
  try { sessionStorage.setItem(key, "1"); } catch { /* 存不下就只在本页生效 */ }
}

/** 这一次的「地基已完成」提示过没有：提示过一次就不再弹 */
const notifiedKey = (jobId: string) => `kaiwu:foundation-notified:${jobId}`;
/** 这个档案的生成被中断后，本次打开已经自动接着跑过一次了（只自动续一次，免得反复扣额度） */
const resumedKey = (pid: string) => `kaiwu:foundation-resumed:${pid}`;
function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* 存不下：刷新后由服务端按档案再查一次 */ }
}
function removeLocal(key: string) {
  try { localStorage.removeItem(key); } catch { /* 忽略 */ }
}

export function FoundationSetup() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [types, setTypes] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<PublicJob | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [purpose, setPurpose] = useState("staged");
  const [stage, setStage] = useState("start");
  const [error, setError] = useState("");
  // 上次的生成找不到了（服务器更新重启、或过期）：等档案进度读到后决定是提示完成，还是自动接着补缺的
  const [interrupted, setInterrupted] = useState(false);
  const [notice, setNotice] = useState("");

  /** 读当前档案和它已有的定位类型。取不到就不弹，不猜 */
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      if (!res.ok) return;
      const list = (await res.json()) as Profile[];
      const current = pickProfileForSetup(Array.isArray(list) ? list : [], getActiveProfileId());
      setProfile(current);
      if (!current) { setTypes(null); return; }
      const pos = await fetch(`/api/positioning?profileId=${encodeURIComponent(current.id)}`, { cache: "no-store" });
      if (!pos.ok) return;
      const rows = (await pos.json()) as { positioning_type?: string }[];
      setTypes(Array.isArray(rows) ? [...new Set(rows.map((r) => r.positioning_type ?? ""))] : []);
    } catch {
      // 网络抖一下不影响页面
    }
  }, []);

  useEffect(() => {
    void reload();
    const offProfile = onActiveProfileChange(() => void reload());
    const offProgress = onProgressChanged(() => void reload());
    return () => { offProfile(); offProgress(); };
  }, [reload]);

  const missing = !!profile && !!types && CORE.some((t) => !types.includes(t));

  /*
   * 换了档案、刷新、关掉页面再回来：把这个档案的那一次生成接上（2026-10-29）。
   * - 还在跑：接着显示进度。
   * - 已经跑完、还没提示过：弹出「地基已完成」。原来这里只是悄悄删掉记录，用户不知道已经好了。
   * - 本机记的那一次找不到了（服务器更新重启、或过期）：交给下面的「中断」处理。
   * 本机没记（换了浏览器、换了设备）就按档案问服务端最近的一次。
   */
  useEffect(() => {
    if (!profile) return;
    const pid = profile.id;
    setDismissed(readFlag(dismissKey(pid)));
    const saved = readLocal(jobKey(pid));
    const url = saved ? `/api/foundation?jobId=${encodeURIComponent(saved)}` : `/api/foundation?profileId=${encodeURIComponent(pid)}`;
    let alive = true;
    void fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 404 && saved) { removeLocal(jobKey(pid)); setInterrupted(true); return; }
        if (!r.ok) return;
        const d = (await r.json().catch(() => null)) as { job?: PublicJob | null } | null;
        const found = d?.job;
        if (!alive || !found) return;
        if (found.status === "running") { writeLocal(jobKey(pid), found.id); setJob(found); setPhase("running"); return; }
        removeLocal(jobKey(pid));
        if (!readLocal(notifiedKey(found.id))) { writeLocal(notifiedKey(found.id), "1"); setJob(found); setPhase("done"); }
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [profile]);

  /*
   * 上次的生成被中断了：等这个档案的进度读到后再定。
   * 定位和简报都已经有了 → 直接提示地基已完成（中断前已经写进库的结果都在）；
   * 还缺 → 自动接着生成缺的那几项（只补缺的，已有的不重复扣额度），一次打开只自动续一次。
   */
  useEffect(() => {
    if (!interrupted || !profile || types === null) return;
    setInterrupted(false);
    const pid = profile.id;
    if (!missing) {
      const id = `restored-${pid}`;
      if (readLocal(notifiedKey(id))) return;
      writeLocal(notifiedKey(id), "1");
      const steps: PublicStep[] = [
        { key: "positioning", label: "账号定位" },
        { key: "brief", label: "创作简报" },
        { key: "advice", label: "行业建议" },
      ].map((s) => ({ ...s, status: types.includes(s.label) ? "done" : "error", error: types.includes(s.label) ? null : "没有生成，可以重新生成" }));
      setJob({ id, profileId: pid, status: steps.every((s) => s.status === "done") ? "done" : "partial", steps });
      setPhase("done");
      return;
    }
    if (readFlag(resumedKey(pid))) {
      setNotice("上次的生成被中断了，点「一键生成」接着补缺的那几项");
      setPhase("prepare");
      return;
    }
    writeFlag(resumedKey(pid));
    setNotice("上次的生成被中断了（服务器刚更新），已自动接着生成缺的那几项");
    void start();
    // start 每次渲染都是新的，这里只在「中断」被发现的那一次执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interrupted, profile, types, missing]);

  // 软强制：没有打好地基、又没有被关掉，就自动打开准备页
  useEffect(() => {
    if (missing && !dismissed && phase === "idle") setPhase("prepare");
  }, [missing, dismissed, phase]);

  // 运行中：每 2.5 秒取一次进度，结束后切到完成面板
  const jobId = job?.id;
  useEffect(() => {
    if (phase !== "running" || !jobId || !profile) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/foundation?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" })
        .then(async (r) => {
          // 任务没了（生成中服务器更新重启）：原来这里一直转圈。改成按「中断」处理：先读最新进度，再提示完成或自动接着补
          if (r.status === 404) {
            window.clearInterval(timer);
            removeLocal(jobKey(profile.id));
            setPhase("idle");
            await reload();
            setInterrupted(true);
            return null;
          }
          return r.ok ? ((await r.json()) as { job?: PublicJob }) : null;
        })
        .then((d) => {
          if (!d?.job) return;
          setJob(d.job);
          if (d.job.status !== "running") {
            window.clearInterval(timer);
            removeLocal(jobKey(profile.id));
            // 跑完就弹出「地基已完成」：最小化了、去了别的页面，也会弹出来
            writeLocal(notifiedKey(d.job.id), "1");
            setMinimized(false);
            setPhase("done");
            void reload();
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [phase, jobId, profile, reload]);

  const start = async () => {
    if (!profile) return;
    setError("");
    setPhase("running");
    try {
      const res = await fetch("/api/foundation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, purpose, stage }),
      });
      const data = (await res.json().catch(() => ({}))) as { job?: PublicJob | null; alreadyDone?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || "没有开始，请稍后再试");
        setPhase("prepare");
        return;
      }
      if (data.alreadyDone || !data.job) {
        await reload();
        setPhase("idle");
        return;
      }
      // 记下这一次：刷新、关掉页面再回来能接上进度和完成提示（记不下也没关系，回来时按档案再问服务端）
      writeLocal(jobKey(profile.id), data.job.id);
      setJob(data.job);
    } catch {
      setError("网络断开了，没有开始。恢复后再点一次");
      setPhase("prepare");
    }
  };

  const later = () => {
    if (profile) writeFlag(dismissKey(profile.id));
    setDismissed(true);
    setPhase("idle");
    setMinimized(false);
  };

  const finishAndClose = () => {
    if (profile) writeFlag(dismissKey(profile.id));
    setDismissed(true);
    setPhase("idle");
    setJob(null);
    setMinimized(false);
    setNotice("");
  };

  if (!profile) return null;

  // 准备要生成的项：缺的核心项，加上行业建议（它没有强制，但一键里一起做）
  const toMake = [
    ...CORE.filter((t) => !(types ?? []).includes(t)),
    ...(!(types ?? []).includes("行业建议") ? ["行业建议"] : []),
  ];
  const doneCount = job ? job.steps.filter((s) => s.status === "done" || s.status === "skipped").length : 0;
  const totalCount = job ? job.steps.length : toMake.length;

  // 运行中被最小化：右下角一个小浮条，点开再看
  if (phase === "running" && minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 left-4 z-40 rounded-full border border-border bg-background/95 px-4 py-2 text-[12.5px] text-foreground shadow-lg backdrop-blur"
      >
        地基生成中 {doneCount}/{totalCount} · 后台进行中，完成后会提示你
      </button>
    );
  }

  // 没打好地基、又关掉了：顶部一直有这条提示
  if (phase === "idle") {
    if (!missing) return null;
    return (
      <button
        type="button"
        onClick={() => { setDismissed(false); setPhase("prepare"); }}
        className="fixed bottom-4 left-4 z-40 rounded-full border border-amber-500/40 bg-background/95 px-4 py-2 text-[12.5px] text-amber-600 shadow-lg backdrop-blur dark:text-amber-300"
      >
        账号地基还没打好 · 去完成
      </button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="先打好地基" className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-xl">
        {phase === "prepare" && (
          <>
            <h2 className="text-[17px] font-semibold text-foreground">先打好地基</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              《{profile.profile_name || "未命名档案"}》的账号定位和创作简报，是之后选题、脚本的依据。现在一键生成，之后生成的内容会自动用上它们。
            </p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {toMake.map((t) => (
                <li key={t} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="text-foreground">{t}</span>
                  <span className="text-muted-foreground">{t === "行业建议" ? "可选" : "必须"}</span>
                </li>
              ))}
            </ul>
            {toMake.includes("行业建议") && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[12px] text-muted-foreground">
                  账号目的
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] text-foreground">
                    {ADVICE_PURPOSES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </label>
                <label className="text-[12px] text-muted-foreground">
                  当前阶段
                  <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] text-foreground">
                    {ADVICE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            )}
            <p className="mt-4 text-[12px] text-muted-foreground">会使用定位额度 {toMake.length} 次（已有的不重复生成）。生成在后台进行，可以最小化后继续用别的功能。</p>
            {error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={later} className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">稍后再说</button>
              <button type="button" onClick={() => void start()} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">一键生成</button>
            </div>
          </>
        )}

        {phase === "running" && job && (
          <>
            <h2 className="text-[17px] font-semibold text-foreground">正在生成地基</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">定位和简报是先后的两步，行业建议同时在做。关掉这个窗口、关掉页面都没关系，生成在后台一直跑到完成，结果会保存下来；完成后会提示你。</p>
            {notice && <p className="mt-2 text-[12.5px] text-amber-600 dark:text-amber-300">{notice}</p>}
            <ul className="mt-4 space-y-2 text-[13px]">
              {job.steps.map((s) => (
                <li key={s.key} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="text-foreground">{s.label}</span>
                  <span className={s.status === "running" ? "text-primary" : "text-muted-foreground"}>{STATUS_TEXT[s.status]}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setMinimized(true)} className="rounded-lg border border-border px-3 py-2 text-[13px] text-foreground">关掉窗口，后台继续生成</button>
            </div>
          </>
        )}

        {phase === "done" && job && (
          <>
            <h2 className="text-[17px] font-semibold text-foreground">{job.status === "done" ? "✓ 地基已完成，可以继续创作了" : "地基有一部分没完成"}</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {job.status === "done" ? "账号定位、创作简报都已保存，之后的选题、脚本会自动用上它们。" : "已完成的结果已经保存。没完成的可以重新生成，只会补缺的。"}
            </p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {job.steps.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div>
                    <span className="text-foreground">{s.label}</span>
                    <span className={`ml-2 text-[12px] ${s.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                      {s.status === "error" ? `没完成：${s.error ?? ""}` : STATUS_TEXT[s.status]}
                    </span>
                  </div>
                  {(s.status === "done" || s.status === "skipped") && RESULT_LINKS[s.key] && (
                    <Link href={RESULT_LINKS[s.key].href} className="rounded-lg bg-primary/10 px-3 py-1.5 text-[12.5px] text-primary">
                      {RESULT_LINKS[s.key].label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {job.status !== "done" && (
                <button type="button" onClick={() => void start()} className="rounded-lg border border-border px-3 py-2 text-[13px] text-foreground">重新生成没完成的</button>
              )}
              <button type="button" onClick={finishAndClose} className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">关闭</button>
              <Link href="/dashboard/topic" onClick={finishAndClose} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">开始创作</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
