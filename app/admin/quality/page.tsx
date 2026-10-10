"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayCircle, RefreshCw } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { SELECT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Button, ErrorState, Panel, StatCard, readError } from "@/components/admin/kit";

/*
 * 质检看板。每次生成完都体检一遍（踩禁忌、用了排除的信息、配比对不上、年限和人设事实卡不符），
 * 每晚 3 点用固定档案回归一次。这里看趋势：哪个板块问题多、最常见的是什么、最近哪几条不合格。
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

const KIND_LABEL: Record<string, string> = {
  taboo: "踩禁忌",
  excluded: "用了排除的信息",
  mix: "配比对不上",
  years: "年限不符",
  generation: "生成未完成或内容缺失",
  facts: "关键事实没有出处",
};
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
      if (!res.ok) throw new Error(await readError(res, "读取失败"));
      setData(await res.json());
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
      if (!res.ok) throw new Error(await readError(res, "运行失败"));
      notify("回归已跑完", "success");
      await load();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setRunning(false);
    }
  };

  const passTone = data?.passRate === null || data?.passRate === undefined ? "default" : data.passRate < 90 ? "warn" : "ok";

  return (
    <AdminPage
      title="质检看板"
      subtitle="每次生成都自动体检；每晚 3 点用固定档案回归一次。规则改坏了，第二天这里就能看到"
      actions={
        <>
          <select aria-label="时间范围" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${SELECT_CLS} w-auto py-1.5`}>
            {[1, 7, 14, 30].map((d) => <option key={d} value={d}>近 {d} 天</option>)}
          </select>
          <Button variant="default" onClick={() => void load()} busy={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
          <Button variant="primary" onClick={() => void runNow()} busy={running}>
            <PlayCircle className="h-3.5 w-3.5" />{running ? "回归中（约 3 分钟）…" : "立即跑一次回归"}
          </Button>
        </>
      }
    >
      {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}
      {loading && !data && <p className="py-10 text-center text-[13px] text-muted-foreground">读取中…</p>}

      {data && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={`体检次数（近 ${data.days} 天）`} value={data.total} />
            <StatCard label="通过率" value={data.passRate === null ? "—" : `${data.passRate}%`} tone={passTone} hint={passTone === "warn" ? "低于 90%，建议看下面的问题" : undefined} />
            <StatCard label="有问题的" value={data.failed} tone={data.failed > 0 ? "warn" : "ok"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="最常见的问题">
              {data.byKind.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">这段时间没有问题</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {data.byKind.map((k) => (
                    <li key={k.kind} className="flex justify-between gap-3">
                      <span>{KIND_LABEL[k.kind] ?? k.label ?? k.kind}</span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTask.map((t) => (
                      <tr key={t.task} className="border-t border-border/40">
                        <td className="py-1.5">{t.task}</td>
                        <td className="py-1.5 text-right tabular-nums">{t.total}</td>
                        <td className={`py-1.5 text-right tabular-nums ${t.failed ? "text-amber-400" : "text-muted-foreground"}`}>{t.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel
            title={`最近一次每晚回归${data.nightly[0] ? `（${time(data.nightly[0].created_at)}）` : ""}`}
          >
            {data.nightly.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">还没跑过。可以点右上角「立即跑一次回归」</p>
            ) : (
              <ul className="space-y-2.5 text-[13px]">
                {data.nightly.map((r, i) => (
                  <li key={i}>
                    <span className={r.passed ? "text-emerald-400" : "text-amber-400"}>
                      {r.passed ? "✓" : "✗"} {r.task_type.replace(/^回归:/, "")}
                    </span>
                    {!r.passed && (
                      <div className="mt-0.5 pl-4 text-[12px] text-muted-foreground">
                        {r.issues.length ? r.issues.map((x) => `【${KIND_LABEL[x.kind] ?? x.kind}】${x.detail}`).join("；") : r.sample}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="最近有问题的生成">
            {data.recentFailures.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">没有 ✓</p>
            ) : (
              <ul className="divide-y divide-border/50 text-[13px]">
                {data.recentFailures.map((r, i) => (
                  <li key={i} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.task_type}</span>
                      <span className="text-[12px] text-muted-foreground">{time(r.created_at)}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-amber-300/90">
                      {r.issues.map((x) => `【${KIND_LABEL[x.kind] ?? x.kind}】${x.detail}`).join("；")}
                    </div>
                    {r.sample && <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{r.sample}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <AdminPanelHint>质检只看规则能判断的问题（禁忌、排除项、配比、年限、关键事实有没有出处）。通过不代表内容一定能拍，需要人工再看一遍。</AdminPanelHint>
        </div>
      )}
    </AdminPage>
  );
}
