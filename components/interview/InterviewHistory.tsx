"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, History, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/script-result-utils";
import { confirmDialog, notify } from "@/components/ui/feedback";

export interface ImportRow {
  id: string;
  profile_name: string;
  target_profile_id: string | null;
  saved_profile_id: string | null;
  saved_at: string | null;
  created_at: string;
  field_count: number;
}

const COLLAPSED_COUNT = 5;

/**
 * 前采建档的历史记录：每次提取一条。
 * 点开回到确认页接着核对、改、写入；已经写入过的标出写进了哪个档案。
 * 提取时切走了页面，结果也在这里。
 */
export function InterviewHistory({
  refreshKey,
  profileNames,
  onOpen,
}: {
  /** 变了就重新取一次（提取完、写入完） */
  refreshKey: number;
  /** 档案 id → 现在的名字（档案改过名，这里跟着显示新名字） */
  profileNames: Map<string, string>;
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/interview/history")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => alive && Array.isArray(d) && setRows(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);

  const remove = async (row: ImportRow) => {
    const ok = await confirmDialog(`删掉这条前采记录？${row.saved_profile_id ? "已经写进档案的内容不受影响。" : "还没写进档案，删了就找不回来了。"}`, {
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/interview/history?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (!res.ok) {
      notify("删除失败，请重试", "error");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13px] font-medium text-foreground">历史记录</h3>
        <span className="text-[11px] text-muted-foreground">{rows.length}</span>
      </div>
      <ul className="space-y-1.5">
        {shown.map((row) => {
          const savedName = row.saved_profile_id ? profileNames.get(row.saved_profile_id) ?? row.profile_name : null;
          return (
            <li key={row.id} className="group flex items-center gap-2 rounded-xl hover:bg-foreground/[0.04]">
              <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <span className="block truncate text-[13.5px] text-foreground">{row.profile_name || "未命名"}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(row.created_at)}
                  </span>
                  <span>提取 {row.field_count} 项</span>
                  {savedName ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      已写入「{savedName}」
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">还没写入档案</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(row)}
                aria-label={`删除：${row.profile_name}`}
                className="mr-1.5 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "收起" : `还有 ${rows.length - COLLAPSED_COUNT} 条`}
        </button>
      )}
    </section>
  );
}
