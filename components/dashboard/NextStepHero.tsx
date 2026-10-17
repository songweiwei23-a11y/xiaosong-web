"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SetupStep } from "@/lib/setup-progress";

/**
 * 首页顶部的「下一步」主卡（整改 A1）。
 * 三步地基没做完时，首屏只留这一个主动作；全做完就不出现，让位给「接着上次」。
 */
export function NextStepHero({ loading, next, done, total }: {
  loading: boolean;
  next: SetupStep | null;
  done: number;
  total: number;
}) {
  if (loading || !next) return null;
  return (
    <section className="glass-panel mb-5 rounded-2xl border border-primary/30 p-5 sm:p-6">
      <p className="text-[12px] text-muted-foreground">
        下一步 · 地基已完成 {done}/{total}
      </p>
      <h2 className="mt-1.5 text-[18px] font-semibold text-foreground">
        {next.index}. {next.title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{next.why}</p>
      <Link
        href={next.href}
        className="brand-gradient mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white"
      >
        去做这一步 <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
