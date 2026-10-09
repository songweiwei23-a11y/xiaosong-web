"use client";

import Link from "next/link";
import { Camera, CheckCircle, ChevronRight, Clock, type LucideIcon } from "lucide-react";
import { formatRelativeTime } from "@/lib/script-result-utils";

/**
 * 首页首屏三件事（2026-10-03）："接着上次""导入文案审稿""今天拍什么"。
 *
 * 产品要求：首屏优先这三个入口，连接真实作品和已有功能。
 * - 接着上次：最近一条没做完的作品，直接到它的下一步（带 ?work=）；没有作品退回最近一条生成记录
 * - 导入文案审稿：自己写好 / 别处拿来的稿子贴进审稿
 * - 今天拍什么：内容做完、还没拍的作品（创作进度「待拍摄」）；一条都没有就去定选题
 * 数据由首页传进来（首页本来就在取作品和历史），这里不再多发请求。
 */

export interface QuickResume { title: string; href: string; hint: string; at?: string }

export function QuickStart({ loading, resume, toShoot }: {
  loading: boolean;
  resume: QuickResume | null;
  toShoot: { count: number; first: string | null };
}) {
  const cards: { key: string; icon: LucideIcon; accent: string; title: string; line: React.ReactNode; href: string }[] = [
    {
      key: "resume", icon: Clock, accent: "bg-sky-500/12 text-sky-500", title: "接着上次",
      href: resume?.href ?? "/dashboard/direction",
      line: resume
        ? <><span className="block truncate text-foreground/90">{resume.title}</span><span className="block truncate">{resume.hint}{resume.at && <> · <span suppressHydrationWarning>{formatRelativeTime(resume.at)}</span></>}</span></>
        : <span className="block">还没有做到一半的，从定方向开始</span>,
    },
    {
      key: "review", icon: CheckCircle, accent: "bg-emerald-500/12 text-emerald-500", title: "导入文案审稿",
      href: "/dashboard/review",
      line: <span className="block">已经写好的稿子贴进来，按你的号逐条挑问题、给改法</span>,
    },
    {
      key: "shoot", icon: Camera, accent: "bg-amber-500/12 text-amber-500", title: "今天拍什么",
      href: toShoot.count > 0 ? "/dashboard/works?group=toShoot" : "/dashboard/topic",
      line: toShoot.count > 0
        ? <><span className="block truncate text-foreground/90">{toShoot.first}</span><span className="block">{toShoot.count} 条内容做好了还没拍，拿拍摄清单开拍</span></>
        : <span className="block">还没有待拍的内容，先定一条今天能拍的选题</span>,
    },
  ];

  return (
    <div className="mb-5 grid gap-2.5 sm:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.key} href={c.href} className="glass-panel glass-interactive group flex min-h-[88px] items-start gap-3 rounded-2xl p-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c.accent}`}>
            <c.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2 text-[15px] font-medium text-foreground">
              {c.title}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
            </span>
            {loading && c.key !== "review"
              ? <span className="mt-1.5 block h-3.5 w-3/4 animate-pulse rounded bg-muted" />
              : <span className="mt-0.5 block space-y-0.5 text-[12px] leading-relaxed text-muted-foreground">{c.line}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}
