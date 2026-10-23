"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayCircle, RefreshCw } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { SELECT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Button, ErrorState, Panel, StatCard, readError } from "@/components/admin/kit";
import { QUALITY_LABELS } from "@/lib/quality-checks";
import { ruleKeyOf } from "@/lib/quality-feedback";

/*
 * 质检看板。实时体检（每次生成后）、夜间回归（每晚 3 点）、手动回归分开看。
 * 通过率、最常见的问题只算阻断项；非阻断的单独列；没跑成的单独计数、不计入通过率。
 * 每条提醒可以标成「误报」或「确认有问题」，按规则统计误报率，误报率高的规则要去改规则。
 */

interface Issue { kind: string; detail: string; blocking?: boolean }
interface Row { id?: string; task_type: string; source: string; passed: boolean; issues: Issue[]; sample?: string | null; created_at: string }
interface RunCase { task: string; passed: boolean; error: boolean; blocking: string[]; advisory: string[]; sample: string }
interface Run { at: string; source: string; total: number; passed: number; errors: number; cases: RunCase[] }
interface Diff { newFailures: string[]; stillFailing: string[]; fixed: string[] }
interface Resp {
  days: number;
  source: string;
  total: number;
  failed: number;
  passRate: number | null;
  errors: number;
  byTask: { task: string; total: number; failed: number }[];
  byKind: { kind: string; label: string; count: number }[];
  advisory: { kind: string; label: string; count: number }[];
  recentFailures: Row[];
  daily: { day: string; live: { total: number; passed: number }; nightly: { total: number; passed: number } }[];
  runs: { nightly: Run[]; manual: Run[] };
  nightlyDiff: Diff | null;
  rules: { key: string; kind: string; label: string; occurrences: number; falsePositive: number; truePositive: number; fpRate: number | null }[];
  feedbackReady: boolean;
}
interface RunStatus { status: "idle" | "running" | "done" | "failed"; passed?: number; total?: number; error?: string }

const SOURCE_OPTIONS = [
  { value: "live", label: "实时体检" },
  { value: "nightly", label: "夜间回归" },
  { value: "manual", label: "手动回归" },
  { value: "all", label: "全部" },
];
const time = (s: string) => new Date(s).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const pct = (passed: number, total: number) => (total ? `${Math.round((passed / total) * 1000) / 10}%` : "—");
const kindText = (i: Issue) => `【${QUALITY_LABELS[i.kind as keyof typeof QUALITY_LABELS] ?? i.kind}】${i.detail}`;

/** 一次回归的逐条结果：通过的一行，不通过的展开看问题和样例 */
function RunBlock({ run, title }: { run: Run; title: string }) {
  return (
    <Panel title={`${title}（${time(run.at)}）`} action={<span className="text-[12px] text-muted-foreground">通过 {run.passed}/{run.total}{run.errors ? ` · 没跑成 ${run.errors}` : ""}</span>}>
      <ul className="space-y-2 text-[13px]">
        {run.cases.map((c, i) => (
          <li key={i}>
            <span className={c.error ? "text-muted-foreground" : c.passed ? "text-emerald-400" : "text-amber-400"}>
              {c.error ? "◌" : c.passed ? "✓" : "✗"} {c.task.replace(/^回归:/, "")}
            </span>
            {(c.blocking.length > 0 || c.advisory.length > 0 || c.error) && (
              <div className="mt-0.5 pl-4 text-[12px] text-muted-foreground">
                {c.error ? c.sample : [...c.blocking, ...c.advisory.map((a) => `（提醒）${a}`)].join("；")}
              </div>
            )}
            {c.sample && !c.error && (
              <details className="mt-1 pl-4 text-[12px]">
                <summary className="cursor-pointer text-muted-foreground">看输出</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-foreground/[0.04] p-2 text-[12px] leading-relaxed">{c.sample}</pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function QualityPage() {
  const [days, setDays] = useState(7);
  const [source, setSource] = useState("live");
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // 读取本身不同步改加载态（effect 里调用它，不会引起级联渲染）；加载态由 load 在触发前切换
  const fetchData = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ days: String(days), source });
      if (task) qs.set("task", task);
      const res = await fetch(`/api/admin/quality?${qs.toString()}`);
      if (!res.ok) throw new Error(await readError(res, "读取失败"));
      const json = (await res.json()) as Resp;
      setData(json);
      setTasks((prev) => [...new Set([...prev, ...json.byTask.map((t) => t.task)])].sort());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days, source, task]);

  const load = useCallback(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const runNow = async () => {
    if (running) return;
    // 手动回归约 10 次模型调用，费用由管理员承担，先确认，并说明节流规则
    const ok = await confirmDialog(
      "现在跑一次手动回归：约 10 次模型调用，约 3 分钟，有费用。最近 24 小时最多 5 次，两次之间至少隔 30 分钟。确定现在跑？",
      { confirmText: "确定运行", title: "立即跑一次回归" }
    );
    if (!ok) return;
    setRunning(true);
    try {
      // 服务端立即返回「已开始」，回归在后台跑；这里每 5 秒看一次进度
      const res = await fetch("/api/admin/quality/regression", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "运行失败"));
      const started = (await res.json()) as RunStatus;
      const done = started.status === "done" ? started : await waitForRun();
      notify(`手动回归已跑完：通过 ${done.passed ?? 0}/${done.total ?? 0}`, "success");
      await fetchData();
    } catch (e) {
      // 轮询或代理中途断开时，服务端通常仍在跑、结果会写进库。先刷新，再告诉管理员实情
      await fetchData();
      notify(`${(e as Error).message || "运行中断"}`, "warning");
    } finally {
      setRunning(false);
    }
  };

  /** 轮询回归进度，直到完成或失败。最多等 10 分钟 */
  const waitForRun = async (): Promise<RunStatus> => {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch("/api/admin/quality/regression");
      if (!res.ok) throw new Error(await readError(res, "读取回归进度失败"));
      const s = (await res.json()) as RunStatus;
      if (s.status === "done") return s;
      if (s.status === "failed") throw new Error(s.error || "回归没有完成");
    }
    throw new Error("回归时间比预期长，仍在后台运行");
  };

  /** 标记一条提醒：误报或确认有问题。标完刷新误报率 */
  const mark = async (row: Row, issue: Issue, verdict: "false_positive" | "true_positive") => {
    try {
      const res = await fetch("/api/admin/quality/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleKey: ruleKeyOf(issue), taskType: row.task_type, verdict }),
      });
      if (!res.ok) throw new Error(await readError(res, "标记失败"));
      notify(verdict === "false_positive" ? "已标为误报" : "已标为确认有问题", "success");
      await fetchData();
    } catch (e) {
      notify((e as Error).message, "warning");
    }
  };

  const passTone = data?.passRate === null || data?.passRate === undefined ? "default" : data.passRate < 90 ? "warn" : "ok";
  const nightly = data?.runs.nightly ?? [];
  const manual = data?.runs.manual ?? [];

  return (
    <AdminPage
      title="质检看板"
      subtitle="每次生成完自动体检；每晚 3 点用固定档案回归一次；需要时可以手动跑一次。改坏了规则，第二天这里就能看到"
      actions={
        <>
          <select aria-label="时间范围" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${SELECT_CLS} w-auto py-1.5`}>
            {[1, 7, 14, 30].map((d) => <option key={d} value={d}>近 {d} 天</option>)}
          </select>
          <select aria-label="记录来源" value={source} onChange={(e) => setSource(e.target.value)} className={`${SELECT_CLS} w-auto py-1.5`}>
            {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="板块" value={task} onChange={(e) => setTask(e.target.value)} className={`${SELECT_CLS} w-auto py-1.5`}>
            <option value="">全部板块</option>
            {tasks.map((t) => <option key={t} value={t}>{t.replace(/^回归:/, "回归·")}</option>)}
          </select>
          <Button variant="default" onClick={() => load()} busy={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
          <Button variant="primary" onClick={() => void runNow()} busy={running}>
            <PlayCircle className="h-3.5 w-3.5" />{running ? "手动回归中（约 3 分钟）…" : "立即跑一次回归"}
          </Button>
        </>
      }
    >
      {error && <div className="mb-5"><ErrorState message={error} onRetry={() => load()} /></div>}
      {loading && !data && <p className="py-10 text-center text-[13px] text-muted-foreground">读取中…</p>}

      {data && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label={`体检次数（近 ${data.days} 天）`} value={data.total} />
            <StatCard label="通过率" value={data.passRate === null ? "—" : `${data.passRate}%`} tone={passTone} hint={passTone === "warn" ? "低于 90%，建议看下面的问题" : undefined} />
            <StatCard label="有问题的" value={data.failed} tone={data.failed > 0 ? "warn" : "ok"} hint="只算阻断项" />
            <StatCard label="没跑成" value={data.errors} tone={data.errors > 0 ? "warn" : "default"} hint="运行出错，不是质量问题" />
          </div>
          {data.advisory.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              另有非阻断的提醒：{data.advisory.map((a) => `${a.label} ${a.count} 次`).join("、")}（不计入通过率）
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="最常见的问题（阻断项）">
              {data.byKind.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">这段时间没有阻断的问题</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {data.byKind.map((k) => (
                    <li key={k.kind} className="flex justify-between gap-3">
                      <span>{k.label}</span>
                      <span className="tabular-nums text-muted-foreground">{k.count} 次</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="各板块">
              {data.byTask.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">还没有记录</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-muted-foreground">
                      <th className="pb-1.5 font-normal">板块</th>
                      <th className="pb-1.5 text-right font-normal">体检</th>
                      <th className="pb-1.5 text-right font-normal">有问题</th>
                      <th className="pb-1.5 text-right font-normal">通过率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTask.map((t) => (
                      <tr key={t.task} className="border-t border-border/40">
                        <td className="py-1.5">{t.task}</td>
                        <td className="py-1.5 text-right tabular-nums">{t.total}</td>
                        <td className={`py-1.5 text-right tabular-nums ${t.failed ? "text-amber-400" : "text-muted-foreground"}`}>{t.failed}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{pct(t.total - t.failed, t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel title="每天的通过率（北京时间）" action={<span className="text-[11.5px] text-muted-foreground">没跑成的不计入</span>}>
            {data.daily.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">这段时间还没有记录</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-muted-foreground">
                    <th className="pb-1.5 font-normal">日期</th>
                    <th className="pb-1.5 text-right font-normal">实时体检</th>
                    <th className="pb-1.5 text-right font-normal">夜间回归</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.day} className="border-t border-border/40">
                      <td className="py-1.5">{d.day.slice(5)}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.live.total ? `${pct(d.live.passed, d.live.total)}（${d.live.passed}/${d.live.total}）` : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.nightly.total ? `${pct(d.nightly.passed, d.nightly.total)}（${d.nightly.passed}/${d.nightly.total}）` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="规则误报率" action={<span className="text-[11.5px] text-muted-foreground">在下面的记录里标「误报」，这里统计</span>}>
            {!data.feedbackReady && (
              <p className="mb-3 text-[12.5px] text-amber-400">误报标记表还没建：请先运行 supabase/migrations/20261023_quality_feedback.sql，之后这里才会统计误报率。</p>
            )}
            {data.rules.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">这段时间没有提醒</p>
            ) : (
              <ul className="space-y-2 text-[12.5px]">
                {data.rules.slice(0, 12).map((r) => (
                  <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      【{r.label}】{r.key.split("|").slice(1).join("|")}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      出现 {r.occurrences} 次 · 误报 {r.falsePositive} / 确认 {r.truePositive}
                      {r.fpRate !== null && (
                        <span className={r.fpRate >= 50 ? " text-amber-400" : ""}> · 误报率 {r.fpRate}%</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={`夜间回归${nightly[0] ? `（${time(nightly[0].at)}）` : ""}`}>
              {!nightly[0] ? (
                <p className="text-[13px] text-muted-foreground">还没跑过夜间回归</p>
              ) : (
                <div className="space-y-3 text-[13px]">
                  {data.nightlyDiff && (
                    <div className="space-y-1">
                      <p className={data.nightlyDiff.newFailures.length ? "text-amber-400" : "text-muted-foreground"}>
                        新增失败 {data.nightlyDiff.newFailures.length} 个{data.nightlyDiff.newFailures.length ? `：${data.nightlyDiff.newFailures.map((t) => t.replace(/^回归:/, "")).join("、")}` : ""}
                      </p>
                      <p className="text-muted-foreground">持续失败 {data.nightlyDiff.stillFailing.length} 个 · 已修复 {data.nightlyDiff.fixed.length} 个（和上一次夜间回归比）</p>
                    </div>
                  )}
                  <ul className="space-y-1 text-[12px] text-muted-foreground">
                    {nightly.slice(0, 7).map((r) => (
                      <li key={r.at}>{time(r.at)}：通过 {r.passed}/{r.total}{r.errors ? ` · 没跑成 ${r.errors}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
            <Panel title={`手动回归${manual[0] ? `（${time(manual[0].at)}）` : ""}`}>
              {!manual[0] ? (
                <p className="text-[13px] text-muted-foreground">还没手动跑过。点右上角「立即跑一次回归」</p>
              ) : (
                <ul className="space-y-1 text-[12px] text-muted-foreground">
                  {manual.slice(0, 7).map((r) => (
                    <li key={r.at}>{time(r.at)}：通过 {r.passed}/{r.total}{r.errors ? ` · 没跑成 ${r.errors}` : ""}</li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {nightly[0] && <RunBlock run={nightly[0]} title="夜间回归详情" />}
          {manual[0] && <RunBlock run={manual[0]} title="手动回归详情" />}

          <Panel title="最近有问题的生成" action={<span className="text-[11.5px] text-muted-foreground">误报的标出来，统计规则误报率</span>}>
            {data.recentFailures.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">没有 ✓</p>
            ) : (
              <ul className="divide-y divide-border/50 text-[13px]">
                {data.recentFailures.map((r, i) => (
                  <li key={r.id ?? i} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.task_type}</span>
                      <span className="text-[12px] text-muted-foreground">{time(r.created_at)}</span>
                    </div>
                    {r.issues.filter((x) => x.blocking !== false).map((x, j) => (
                      <div key={j} className="mt-1 flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 text-[12.5px] text-amber-300/90">{kindText(x)}</span>
                        <span className="flex shrink-0 gap-1.5">
                          <button type="button" onClick={() => void mark(r, x, "false_positive")} className="rounded-md border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground">误报</button>
                          <button type="button" onClick={() => void mark(r, x, "true_positive")} className="rounded-md border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground">确认有问题</button>
                        </span>
                      </div>
                    ))}
                    {r.sample && (
                      <details className="mt-1 text-[12px]">
                        <summary className="cursor-pointer text-muted-foreground">看输出</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-foreground/[0.04] p-2 text-[12px] leading-relaxed">{r.sample}</pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <AdminPanelHint>质检只看规则能判断的问题（禁忌、排除项、配比、年限、关键事实有没有出处）。通过不代表内容一定能拍，需要人工再看一遍。误报率高的规则说明规则本身要改，不要让它天天红。</AdminPanelHint>
        </div>
      )}
    </AdminPage>
  );
}
