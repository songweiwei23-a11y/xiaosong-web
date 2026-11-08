"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { BenchmarkReport } from "@/components/benchmark/BenchmarkReport";

/**
 * 历次账号诊断 / 月度复盘的永久存档（2026-11-08 产品方：「拆解账号、复盘账号产出的结果要一直保存着，别出现没有记忆的情况」）。
 * 每一份都在 script_history 里另存一条，新的不覆盖旧的；点开才去取，不拖慢页面。
 */
interface Item { id: string; createdAt: string; result: string; month?: string | null }

export function ReportArchive({ profileId, kind, label }: { profileId: string; kind: "review" | "diagnosis"; label: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setError("");
    setItems(null);
    const res = await fetch(`/api/monthly-review?profileId=${encodeURIComponent(profileId)}&archive=${kind}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data) { setError("存档暂时没读到，稍后再点一次"); return; }
    setItems(data.items as Item[]);
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void toggle()} className="inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline">
        <History className="h-3.5 w-3.5" />{open ? `收起${label}` : `看${label}（全部存着）`}
      </button>
      {open && (
        <div className="space-y-1.5 rounded-lg border border-border/60 p-2.5">
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          {!items && !error && <p className="text-[12px] text-muted-foreground">正在读取…</p>}
          {items && !items.length && <p className="text-[12px] text-muted-foreground">还没有存档。</p>}
          {items?.map((it) => (
            <div key={it.id}>
              <button type="button" onClick={() => setShown(shown === it.id ? null : it.id)} className="w-full rounded-md px-2 py-1 text-left text-[12.5px] text-foreground hover:bg-foreground/[0.05]">
                {it.createdAt.slice(0, 16).replace("T", " ")}{it.month ? `｜复盘 ${it.month}` : ""}｜{it.result.replace(/[#*\s]+/g, " ").trim().slice(0, 40)}…
              </button>
              {shown === it.id && <div className="mt-1"><BenchmarkReport report={it.result} title={label.replace(/^历次/, "")} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
