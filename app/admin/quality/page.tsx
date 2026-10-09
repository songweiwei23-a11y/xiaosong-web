"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle, PlayCircle } from "lucide-react";

/*
 * 质检看板（2026-10-03）。
 *
 * 每次生成完浏览器都体检一遍（踩禁忌、用了排除的信息、配比对不上、年限和人设事实卡不符），
 * 每晚服务器再拿固定档案回归一次。这里看趋势：哪个板块问题多、最常见的是什么、
 * 最近哪几条不合格。规则见 lib/quality-checks.ts。
 */

interface Issue { kind: string; detail: string }
interface Row { task_type: string; source: string; passed: boolean; issues: Issue[]; sample?: string | null; created_at: string }
interface Resp {
  days: number;
  total: number;
  failed: number;
  passRate: number | null;
  byTask: { task: string; total: number; failed: number }[];
  byKind: { kind: string; label: string; count: number }[];
  recentFailures: Row[];
  nightly: Row[];
}

const KIND_LABEL: Record<string, string> = { taboo: "踩禁忌", excluded: "用了排除的信息", mix: "配比对不上", years: "年限不符", generation: "生成未完成或内容缺失" };
const time = (s: string) => new Date(s).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function QualityPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/quality?days=${days}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/admin/quality/regression", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "运行失败");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const card = "rounded-2xl border border-border bg-card p-4";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground"><ShieldCheck className="h-5 w-5" />质检看板</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">每次生成都自动体检；每晚 3 点用固定档案回归一次。规则改坏了，这里第二天就能看到。</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="时间范围" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1.5 text-[13px]">
            {[1, 7, 14, 30].map((d) => <option key={d} value={d}>近 {d} 天</option>)}
          </select>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px]"><RefreshCw className="h-4 w-4" />刷新</button>
          <button onClick={() => void runNow()} disabled={running} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] text-primary-foreground disabled:opacity-60">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}{running ? "回归中（约 3 分钟）…" : "立即跑一次回归"}
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-[13px] text-rose-300"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {loading && !data && <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />读取中…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={card}><div className="text-[12px] text-muted-foreground">体检次数（近 {data.days} 天）</div><div className="mt-1 text-3xl font-semibold tabular-nums">{data.total}</div></div>
            <div className={card}><div className="text-[12px] text-muted-foreground">通过率</div><div className={`mt-1 text-3xl font-semibold tabular-nums ${data.passRate !== null && data.passRate < 90 ? "text-amber-400" : "text-emerald-400"}`}>{data.passRate === null ? "—" : `${data.passRate}%`}</div></div>
            <div className={card}><div className="text-[12px] text-muted-foreground">有问题的</div><div className="mt-1 text-3xl font-semibold tabular-nums">{data.failed}</div></div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={card}>
              <h2 className="mb-2 text-[14px] font-semibold">最常见的问题</h2>
              {data.byKind.length === 0 ? <p className="text-[13px] text-muted-foreground">没有问题 ✓</p> : (
                <ul className="space-y-1.5 text-[13px]">{data.byKind.map((k) => <li key={k.kind} className="flex justify-between"><span>{k.label}</span><span className="tabular-nums text-muted-foreground">{k.count} 次</span></li>)}</ul>
              )}
            </div>
            <div className={card}>
              <h2 className="mb-2 text-[14px] font-semibold">各板块</h2>
              {data.byTask.length === 0 ? <p className="text-[13px] text-muted-foreground">还没有记录</p> : (
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[12px] text-muted-foreground"><th className="pb-1 font-normal">板块</th><th className="pb-1 text-right font-normal">体检</th><th className="pb-1 text-right font-normal">有问题</th></tr></thead>
                  <tbody>{data.byTask.map((t) => <tr key={t.task}><td className="py-0.5">{t.task}</td><td className="py-0.5 text-right tabular-nums">{t.total}</td><td className={`py-0.5 text-right tabular-nums ${t.failed ? "text-amber-400" : "text-muted-foreground"}`}>{t.failed}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-2 text-[14px] font-semibold">最近一次每晚回归{data.nightly[0] ? `（${time(data.nightly[0].created_at)}）` : ""}</h2>
            {data.nightly.length === 0 ? <p className="text-[13px] text-muted-foreground">还没跑过。可以点右上角「立即跑一次回归」。</p> : (
              <ul className="space-y-2 text-[13px]">
                {data.nightly.map((r, i) => (
                  <li key={i}>
                    <span className={r.passed ? "text-emerald-400" : "text-amber-400"}>{r.passed ? "✓" : "✗"} {r.task_type.replace(/^回归:/, "")}</span>
                    {!r.passed && <div className="mt-0.5 pl-4 text-[12px] text-muted-foreground">{r.issues.length ? r.issues.map((x) => `【${KIND_LABEL[x.kind] ?? x.kind}】${x.detail}`).join("；") : r.sample}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <h2 className="mb-2 text-[14px] font-semibold">最近有问题的生成</h2>
            {data.recentFailures.length === 0 ? <p className="text-[13px] text-muted-foreground">没有 ✓</p> : (
              <ul className="divide-y divide-border text-[13px]">
                {data.recentFailures.map((r, i) => (
                  <li key={i} className="py-2">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.task_type}</span><span className="text-[12px] text-muted-foreground">{time(r.created_at)}</span></div>
                    <div className="mt-0.5 text-[12.5px] text-amber-300/90">{r.issues.map((x) => `【${KIND_LABEL[x.kind] ?? x.kind}】${x.detail}`).join("；")}</div>
                    {r.sample && <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{r.sample}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
