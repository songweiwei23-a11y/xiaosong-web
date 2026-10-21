"use client";

import { useState } from "react";
import { CalendarDays, Link2 } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import type { Work } from "@/lib/works";
import { fromDateInput, toDateInput } from "@/lib/publish-plan";
import { notifyProgressChanged } from "@/lib/progress-events";

/**
 * 作品卡片上的一行：计划哪天发（体检 F2）+ 素材放在哪（体检 F4）。
 * 日期一改就存；素材位置失去焦点时存。存不上会提示，不吞掉。
 */
export function WorkPlanRow({ work }: { work: Work }) {
  const [planned, setPlanned] = useState(toDateInput(work.planned_at));
  const [note, setNote] = useState(work.material_note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/works?id=${encodeURIComponent(work.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "没存上，请稍后再试");
      notifyProgressChanged();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
      <label className="flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        计划发布
        <input
          type="date"
          aria-label="计划发布日期"
          value={planned}
          disabled={busy}
          onChange={(e) => {
            setPlanned(e.target.value);
            void save({ plannedAt: e.target.value ? fromDateInput(e.target.value) : null });
          }}
          className="rounded-md border border-border bg-background px-2 py-0.5 text-[12px] text-foreground"
        />
      </label>
      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0">素材位置</span>
        <input
          aria-label="素材位置"
          value={note}
          maxLength={300}
          placeholder="网盘或草稿链接，或一句说明"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== (work.material_note ?? "")) void save({ materialNote: note }); }}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-0.5 text-[12px] text-foreground"
        />
      </label>
    </div>
  );
}
