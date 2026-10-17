"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/workspace/PageHeader";
import { listWorks, type Work } from "@/lib/works";
import { buildMonthlyReport, monthLabel, previousMonth } from "@/lib/monthly-report";

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

  useEffect(() => {
    let off = false;
    listWorks(200)
      .then((w) => { if (!off) setWorks(w); })
      .catch(() => { if (!off) setError("作品没取到，请刷新重试"); });
    return () => { off = true; };
  }, []);

  const report = works ? buildMonthlyReport(works, month) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-7">
      <style>{`@media print { aside, .no-print { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="no-print">
        <PageHeader
          title="月报"
          subtitle="一个月做了什么、效果怎样、下个月计划。可以打印，或者存为 PDF 发给客户。"
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

          <p className="mt-8 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">由开物根据作品记录和录入的数据生成。数据没录的地方，报告里写的是「未录」，不是 0。</p>
        </article>
      )}
    </div>
  );
}
