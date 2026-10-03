"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileSearch, Trash2 } from "lucide-react";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import { postSafely } from "@/lib/safe-post";

/**
 * 新建、编辑档案页顶上的入口：有前采资料的，不用一格格手填。
 * 这两页正是最需要它的人会来的地方。
 */
export function InterviewEntry({ profileId }: { profileId?: string }) {
  const href = profileId ? `/dashboard/interview?profile=${encodeURIComponent(profileId)}` : "/dashboard/interview";
  return (
    <Link
      href={href}
      className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3 transition-colors hover:bg-primary/[0.09]"
    >
      <span className="flex items-center gap-2.5">
        <FileSearch className="h-5 w-5 shrink-0 text-primary" />
        <span>
          <span className="block text-[13.5px] font-medium text-foreground">
            {profileId ? "有新的前采资料？一键补充进来" : "有前采资料？一键导入，不用一格格填"}
          </span>
          <span className="block text-[12px] text-muted-foreground">贴文字或传 Word，AI 提取成档案，你确认了才写入</span>
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-medium text-primary">前采建档 →</span>
    </Link>
  );
}

/** 编辑页：这份档案存过的前采要点和原文，可以看、可以删 */
export function InterviewNotesCard({ profile, onCleared }: { profile: Record<string, unknown>; onCleared: () => void }) {
  const [open, setOpen] = useState(false);
  const notes = typeof profile.interview_notes === "string" ? profile.interview_notes : "";
  const highlights = typeof profile.interview_highlights === "string" ? profile.interview_highlights.split("\n").filter(Boolean) : [];
  if (!notes && highlights.length === 0) return null;

  const clear = async () => {
    const ok = await confirmDialog("删掉这份档案里存的前采原文和要点？档案里已经填好的各项不受影响。", { confirmText: "删除", tone: "danger" });
    if (!ok) return;
    const res = await postSafely("/api/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: profile.id, interview_notes: null, interview_highlights: null }),
    });
    if (!res.ok) {
      notify("删除失败，请重试", "error");
      return;
    }
    invalidateCreatorContext();
    notify("已删除前采资料", "success");
    onCleared();
  };

  return (
    <div className="mb-6 rounded-2xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground" aria-expanded={open}>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          前采资料（{highlights.length} 条要点{notes ? "，含原文" : ""}）
        </button>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> 删除
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">要点会在做账号定位时一起参考。</p>
      {open && (
        <div className="mt-3 space-y-3">
          {highlights.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-foreground">
              {highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          {notes && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-foreground/[0.03] p-3 font-sans text-[12.5px] leading-relaxed text-muted-foreground">{notes}</pre>
          )}
        </div>
      )}
    </div>
  );
}
