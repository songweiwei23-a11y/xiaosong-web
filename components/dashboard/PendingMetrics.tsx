"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { QuickMetrics } from "@/components/works/QuickMetrics";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { pendingMetricsWorks } from "@/lib/quick-metrics";
import { saveWorkMetrics, type Work } from "@/lib/works";
import type { WorkMetrics } from "@/lib/performance";

/**
 * 首页「待录数据」（整改 B1）：已发布满 1 天、还没录过数据的作品，点开直接录 3 个数。
 * 没有待录的就不出现。录完后这一条自动从列表里消失。
 */
export function PendingMetrics({ works, onSaved }: {
  works: Work[];
  onSaved: (id: string, metrics: WorkMetrics) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = pendingMetricsWorks(works);
  if (!items.length) return null;

  const save = async (id: string, metrics: WorkMetrics): Promise<boolean> => {
    try {
      const saved = await saveWorkMetrics(id, metrics);
      onSaved(id, saved.metrics ?? metrics);
      // 各板块缓存的账号上下文里有数据汇总，作废让它重新取
      invalidateCreatorContext();
      notify("数据已保存，选题和方向会参考它");
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    }
  };

  return (
    <section className="glass-panel mb-5 rounded-2xl p-4">
      <h2 className="mb-1 flex items-center gap-2 text-[13px] font-medium text-foreground">
        <BarChart3 className="h-4 w-4 text-primary" />待录数据
      </h2>
      <p className="mb-2.5 text-[11.5px] text-muted-foreground">发完了就填 3 个数，选题和方向会参考这个号的真实表现。</p>
      <ul className="space-y-2">
        {items.map((w) => (
          <li key={w.id} className="rounded-xl border border-border/60 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setOpenId(openId === w.id ? null : w.id)}
              aria-expanded={openId === w.id}
              className="flex w-full items-center gap-3 text-left text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate text-foreground">{w.title}</span>
              <span className={`shrink-0 text-[11.5px] ${w.days >= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                发布 {w.days} 天{w.days >= 7 ? "，还没录" : ""}
              </span>
              <span className="shrink-0 text-[12px] text-primary">{openId === w.id ? "收起" : "录数据"}</span>
            </button>
            {openId === w.id && (
              <div className="mt-2.5">
                <QuickMetrics onSave={(m) => save(w.id, m)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
