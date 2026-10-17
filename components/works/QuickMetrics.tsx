"use client";

import { useState } from "react";
import { notify } from "@/components/ui/feedback";
import { parseQuickMetrics, type QuickMetricsInput } from "@/lib/quick-metrics";
import type { WorkMetrics } from "@/lib/performance";

/**
 * 发布后 3 个数快速录入（整改 B1）。作品卡和首页「待录数据」共用。
 * 播放必填，完播率、点赞选填；咨询、成交、平台等在「更多项」里填。
 */
export function QuickMetrics({ onSave, onFull }: {
  /** 返回 false 表示没存上，三个框保留，让用户改了再存 */
  onSave: (metrics: WorkMetrics) => Promise<boolean>;
  onFull?: () => void;
}) {
  const [v, setV] = useState<QuickMetricsInput>({ views: "", completion: "", likes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const r = parseQuickMetrics(v);
    if (!r.ok) {
      notify(r.error, "error");
      return;
    }
    setBusy(true);
    try {
      if (await onSave(r.metrics)) setV({ views: "", completion: "", likes: "" });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof QuickMetricsInput, label: string, placeholder: string) => (
    <label className="text-[11.5px] text-muted-foreground">
      {label}
      <input
        aria-label={label}
        inputMode="decimal"
        value={v[key]}
        placeholder={placeholder}
        onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-[13px] text-foreground"
      />
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {field("views", "播放", "12000")}
        {field("completion", "完播率（%）", "32")}
        {field("likes", "点赞", "860")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="brand-gradient rounded-lg px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
        >
          {busy ? "保存中…" : "保存数据"}
        </button>
        {onFull && (
          <button type="button" onClick={onFull} className="text-[11.5px] text-muted-foreground underline">
            更多项（咨询、成交、平台）
          </button>
        )}
      </div>
    </div>
  );
}
