"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { plannedThisWeek, planLabel, type PlanItem } from "@/lib/publish-plan";

/**
 * 首页「本周要发」（体检 F2）：计划在 7 天内、还没发的作品，按日期列出来。没有就不出现。
 */
export function PlanThisWeek({ works }: { works: PlanItem[] }) {
  const items = plannedThisWeek(works).slice(0, 5);
  if (!items.length) return null;
  return (
    <section className="glass-panel mb-5 rounded-2xl p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" />本周要发
      </h2>
      <ul className="space-y-1.5 text-[13px]">
        {items.map((w) => (
          <li key={w.id} className="flex items-center gap-3">
            <span className="shrink-0 rounded-md bg-primary/12 px-2 py-0.5 text-[11.5px] font-medium text-primary">{planLabel(w.planned_at!)}</span>
            <span className="min-w-0 flex-1 truncate text-foreground">{w.title}</span>
            <Link href="/dashboard/works" className="shrink-0 text-[12px] text-primary hover:underline">去拍 →</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
