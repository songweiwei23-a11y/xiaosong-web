"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronRight } from "lucide-react";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { LIBRARY_CATEGORIES, categoryLabel, type LibraryListItem } from "@/lib/library";
import { DEFAULT_PROFILE_SCOPE } from "@/lib/profile-history";

/**
 * 工作台上的素材库卡片（2026-10-02，产品方："新上的功能同步到工作台首页"）。
 * 收藏了几条、各分类多少、最近收藏的几条，点进去就是素材库。
 * 还没收藏过：告诉人收藏按钮在哪——不说没人知道每个板块结果下面有它。
 */
export function LibraryCard({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<LibraryListItem[] | null>(null);
  // 总数和各分类数量用接口给的（列表现在是分页的，一页只有 20 条，自己数会少）
  const [stats, setStats] = useState<{ all: number; categories: Record<string, number> } | null>(null);

  useEffect(() => {
    const load = () => {
      // 只看当前档案的（2026-10-04 按档案隔离）；没选档案时看没挂档案的
      const pid = getActiveProfileId() || DEFAULT_PROFILE_SCOPE;
      fetch(`/api/library?limit=3&profileId=${encodeURIComponent(pid)}`)
        .then((r) => r.json().catch(() => ({})))
        .then((d) => { setItems(Array.isArray(d.items) ? d.items : []); setStats(d.counts ?? null); })
        .catch(() => setItems([]));
    };
    load();
    return onActiveProfileChange(load);
  }, []);

  const counts = LIBRARY_CATEGORIES.map((c) => ({ ...c, n: stats?.categories[c.id] ?? 0 })).filter((c) => c.n > 0);
  const total = stats?.all ?? items?.length ?? 0;

  return (
    <section className={`glass-panel rounded-2xl p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          素材库
          {total > 0 && <span className="text-[11.5px] font-normal text-muted-foreground">{total} 条</span>}
        </h2>
        <Link href="/dashboard/library" className="text-[11.5px] text-muted-foreground hover:text-foreground">打开</Link>
      </div>

      {items === null ? (
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-foreground/[0.04] px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
          还没有收藏。任何板块生成结果后，点结果下面的「收藏到素材库」，好内容就存在这里，随时拿去继续创作
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {counts.slice(0, 5).map((c) => (
              <span key={c.id} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{c.label} {c.n}</span>
            ))}
          </div>
          <div className="space-y-0.5">
            {items.slice(0, 3).map((it) => (
              <Link key={it.id} href="/dashboard/library" className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/[0.05]">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{it.title}</span>
                <span className="shrink-0 text-[10.5px] text-muted-foreground">{categoryLabel(it.category)}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
