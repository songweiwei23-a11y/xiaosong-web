"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/workspace/PageHeader";
import { listAllWorks, type Work } from "@/lib/works";
import { buildMonthlyReport, monthLabel, previousMonth } from "@/lib/monthly-report";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import Link from "next/link";
import { CONTENT_ROLE_LIST } from "@/lib/content-roles";
import { reviewMonthLabel, type MonthlyReview } from "@/lib/monthly-review";

/**
 * 月报（体检 F3）：一个月做了什么、效果怎样、下个月计划。可以打印，或者「存为 PDF」发给客户。
 * 数字都从作品和它录的数据里算出来，没有模型参与。打印时隐藏侧栏和按钮。
 */
export default function ReportPage() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [error, setError] = useState("");
  const months = useMemo(() => {
    const list: string[] = [];
    let m = previousMonth();
    for (let i = 0; i < 12; i++) {
      list.push(m);
      const [y, mo] = m.split("-").map(Number);
      m = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
    }
    return list;
  }, []);
  const [month, setMonth] = useState(months[0]);

  // 切换档案时重新统计：旧档案的作品不能留在报告里（体检 F02）
  const [loadKey, setLoadKey] = useState(0);
  useEffect(() => onActiveProfileChange(() => setLoadKey((k) => k + 1)), []);

  // 把作品全部取完再算。取不到就只显示错误，不生成「发布 0 条」之类的报告（体检 F01、F02）
  useEffect(() => {
    let off = false;
    setWorks(null);
    setError("");
    listAllWorks()
      .then((w) => { if (!off) setWorks(w); })
      .catch((e: Error) => { if (!off) setError(e.message || "作品没取到，请刷新重试"); });
    return () => { off = true; };
  }, [loadKey]);

  const report = works ? buildMonthlyReport(works, month) : null;

  // 那个月的复盘（第三步：月报和复盘合成一页）：先在当前卡和最近 6 版里找，找不到再去永久存档里找全文
  const [reviewOf, setReviewOf] = useState<{ month: string; review: MonthlyReview | null; archived: string } | null>(null);
  useEffect(() => {
    const pid = getActiveProfileId();
    let off = false;
    setReviewOf(null);
    if (!pid) return;
    (async () => {
      const d = await fetch(`/api/monthly-review?profileId=${encodeURIComponent(pid)}&month=${month}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const all = [d?.review, ...(d?.history ?? [])].filter(Boolean) as MonthlyReview[];
      const hit = all.filter((r) => r.month === month).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ?? null;
      let archived = "";
      if (!hit) {
        const a = await fetch(`/api/monthly-review?profileId=${encodeURIComponent(pid)}&archive=review`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        archived = ((a?.items ?? []) as { month?: string | null; result: string }[]).find((x) => x.month === month)?.result ?? "";
      }
      if (!off) setReviewOf({ month, review: hit, archived });
    })();
    return () => { off = true; };
  }, [month, loadKey]);
  const rv = reviewOf?.month === month ? reviewOf : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-7">
      <style>{`@media print { aside, .no-print { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="no-print">
        <PageHeader
          title="月报"
          subtitle="一个月做了什么、效果怎样、复盘出来什么起作用、下个月怎么调。可以打印，或者存为 PDF 发给客户。"
        />
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select
            aria-label="选择月份"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
          >
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground disabled:opacity-50"
          >
            打印 / 存为 PDF
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {!report && !error && <p className="text-[13px] text-muted-foreground">正在汇总…</p>}

      {report && (
        <article className="glass-panel rounded-2xl p-6 print:rounded-none print:border-0 print:shadow-none">
          <h2 className="text-[20px] font-semibold text-foreground">{report.label} 内容报告</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">统计依据：当前档案的 {works?.length ?? 0} 条作品（已全部读取）</p>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-foreground/[0.04] p-3"><dt className="text-[11.5px] text-muted-foreground">拍摄完成</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{report.shot} 条</dd></div>
            <div className="rounded-xl bg-foreground/[0.04] p-3"><dt className="text-[11.5px] text-muted-foreground">发布</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{report.published} 条</dd></div>
            <div className="rounded-xl bg-foreground/[0.04] p-3"><dt className="text-[11.5px] text-muted-foreground">合计播放</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{report.totalViews === null ? "未录" : report.totalViews.toLocaleString("zh-CN")}</dd></div>
            <div className="rounded-xl bg-foreground/[0.04] p-3"><dt className="text-[11.5px] text-muted-foreground">完播中位数</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{report.medianCompletion === null ? "未录" : `${report.medianCompletion}%`}</dd></div>
          </dl>

          <section className="mt-6">
            <h3 className="text-[14px] font-medium text-foreground">这个月的情况</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
              {report.lines.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </section>

          {report.best && (
            <section className="mt-6">
              <h3 className="text-[14px] font-medium text-foreground">表现最好的一条</h3>
              <p className="mt-2 text-[13.5px] text-muted-foreground">《{report.best.title}》，完播 {report.best.completion}%</p>
            </section>
          )}

          {/* 这个月的复盘和下月策略（月度复盘，lib/monthly-review） */}
          <section className="mt-6">
            <h3 className="text-[14px] font-medium text-foreground">复盘：什么起作用、下个月怎么调</h3>
            {!rv && <p className="mt-2 text-[13px] text-muted-foreground">正在读这个月的复盘…</p>}
            {rv?.review && (() => {
              const r = rv.review!;
              const s = r.strategy;
              return (
                <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {r.summary && <p className="text-foreground">{r.summary}</p>}
                  {r.worked.length > 0 && <ul className="list-disc space-y-1 pl-5">{r.worked.map((x) => <li key={x}>起作用：{x}</li>)}</ul>}
                  {r.notWorked.length > 0 && <ul className="list-disc space-y-1 pl-5">{r.notWorked.map((x) => <li key={x}>没起作用：{x}</li>)}</ul>}
                  {r.experimentResults.length > 0 && <ul className="list-disc space-y-1 pl-5">{r.experimentResults.map((e) => <li key={e.name}>上月试验「{e.name}」：{e.result}{e.evidence ? `（${e.evidence}）` : ""}</li>)}</ul>}
                  <p className="pt-1 text-foreground">下个月最该抓：{s.focus}</p>
                  <p>配比：{s.mix ? CONTENT_ROLE_LIST.map((x) => `${x} ${s.mix![x]}%`).join("、") : "暂不调整"}{s.mixReason ? `（${s.mixReason}）` : ""}</p>
                  {s.doMore.length > 0 && <p>多做：{s.doMore.join("；")}</p>}
                  {s.doLess.length > 0 && <p>少做：{s.doLess.join("；")}</p>}
                  {s.experiments.length > 0 && <p>下个月试验：{s.experiments.map((e) => `${e.name}（${e.how}；成没成看：${e.success}）`).join("；")}</p>}
                  {!!r.inferred?.length && <p className="text-[12.5px]">没记目的的作品（推测）：{r.inferred.map((x) => `《${x.title}》${x.purpose}`).join("、")}</p>}
                  <p className="text-[11.5px]">{reviewMonthLabel(r.month)}复盘，{r.generatedAt.slice(0, 10)}{r.source === "auto" ? " 自动" : " 手动"}{r.edited ? "，编导改过" : ""}</p>
                </div>
              );
            })()}
            {rv && !rv.review && rv.archived && <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{rv.archived.replace(/\*\*/g, "")}</div>}
            {rv && !rv.review && !rv.archived && (
              <p className="mt-2 text-[13px] text-muted-foreground no-print">这个月还没复盘。<Link href="/dashboard/works" className="text-primary underline">去创作进度复盘</Link>（每月 1 号也会自动复盘上个月）</p>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-[14px] font-medium text-foreground">下个月计划</h3>
            {report.nextMonthPlan.length ? (
              <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted-foreground">
                {report.nextMonthPlan.map((p) => <li key={p.title + p.planned_at}>{p.title}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">还没有定下来的计划。可以先去「内容规划」排一下下个月的条数。</p>
            )}
          </section>

          <p className="mt-8 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">数字部分由开物根据作品记录和录入的数据算出；复盘部分是月度复盘的结论（模型写的，依据见创作进度里的复盘全文）。数据没录的地方，报告里写的是「未录」，不是 0。</p>
        </article>
      )}
    </div>
  );
}
