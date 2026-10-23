"use client";

import { useEffect, useState } from "react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { persistGenerationHistory } from "@/lib/history";
import { readUnsaved, removeUnsaved, UNSAVED_EVENT, type UnsavedResult } from "@/lib/unsaved-results";

/**
 * 全站提示：有生成结果没有保存进历史（2026-10-24）。
 * 可以重试保存、复制，或丢弃（丢弃要确认）。没有未保存的结果时不占位。
 */
export function UnsavedResultsNotice() {
  const [items, setItems] = useState<UnsavedResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setItems(readUnsaved());
    load();
    window.addEventListener(UNSAVED_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(UNSAVED_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const retry = async (item: UnsavedResult) => {
    setBusy(item.id);
    try {
      const ok = await persistGenerationHistory(item.taskType, item.inputData, item.result, item.workId);
      if (ok) {
        removeUnsaved(item.id);
        notify("已保存进历史", "success");
      } else {
        notify("还是没保存成功，请稍后再试，或先复制结果", "warning");
      }
    } finally {
      setBusy(null);
    }
  };

  const copy = async (item: UnsavedResult) => {
    try {
      await navigator.clipboard.writeText(item.result);
      notify("已复制到剪贴板", "success");
    } catch {
      notify("复制失败，请手动选中文字复制", "warning");
    }
  };

  const discard = async (item: UnsavedResult) => {
    const ok = await confirmDialog("丢弃后这份结果就找不回来了，确定丢弃？", {
      tone: "danger",
      confirmText: "确定丢弃",
      title: "丢弃未保存的结果",
    });
    if (ok) removeUnsaved(item.id);
  };

  if (items.length === 0) return null;

  return (
    <div role="alert" className="fixed bottom-4 left-1/2 z-40 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-background/95 p-4 shadow-lg backdrop-blur">
      <p className="text-sm font-medium text-amber-600 dark:text-amber-300">有 {items.length} 份生成结果没有保存进历史</p>
      <p className="mt-1 text-xs text-muted-foreground">刷新或换页后可能找不到，找不到就要重新生成，又扣一次额度。请先重试保存或复制。</p>
      <ul className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{item.taskType}</span>
              <span className="text-muted-foreground">{new Date(item.failedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{item.result.slice(0, 80)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void retry(item)} disabled={busy === item.id} className="rounded-lg bg-primary/10 px-3 py-1.5 text-primary disabled:opacity-50">
                {busy === item.id ? "保存中…" : "重试保存"}
              </button>
              <button type="button" onClick={() => void copy(item)} className="rounded-lg border border-border px-3 py-1.5 text-foreground">复制结果</button>
              <button type="button" onClick={() => void discard(item)} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:text-destructive">丢弃</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
