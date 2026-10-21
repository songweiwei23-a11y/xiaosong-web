"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle, Lightbulb } from "lucide-react";
import { useGuide } from "@/hooks/useGuide";

/**
 * 首页顶部的新手引导大卡：现在处于什么阶段、可以怎么选、几条行为建议。
 * 引导只列出选项，不替用户做决定：每一项都要用户自己点，「建议」只是提示。
 * 数据没取到时整块不显示，不猜。
 */
export function GuideCard() {
  const { guide, loading } = useGuide();

  if (loading) {
    return <div className="glass-panel mb-5 h-[168px] animate-pulse rounded-2xl" aria-hidden />;
  }
  if (!guide) return null;

  const { progress, options, intro, tips, alert } = guide;

  return (
    <section
      aria-label="新手引导"
      className="glass-panel mb-5 rounded-2xl border border-primary/30 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">{guide.stageLabel}</span>
        <span>{guide.stageDesc}</span>
      </div>

      {progress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]" aria-label={`地基 ${progress.done}/${progress.total}`}>
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-muted-foreground">{intro}</p>
      <ul className="mt-2.5 space-y-2">
        {options.map((o) => (
          <li key={o.key}>
            <Link
              href={o.href}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-primary/60 ${
                o.recommended ? "border-primary/40 bg-primary/[0.06]" : "border-border/60"
              }`}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-foreground">
                  {o.label}
                  {o.recommended && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-medium text-primary">建议</span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{o.why}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {alert && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-foreground/90">
          <span className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{alert.text}</span>
          </span>
          <Link href={alert.href} className="shrink-0 text-[12px] font-medium text-primary hover:opacity-80">
            {alert.cta} →
          </Link>
        </div>
      )}

      {tips.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> 小提示
          </p>
          <ul className="mt-2 space-y-1.5">
            {tips.map((t) => (
              <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
