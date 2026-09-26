"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Loader2 } from "lucide-react";
import { listWorks, deleteWork, type Work } from "@/lib/works";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { WorkCard } from "@/components/works/WorkCard";

/*
 * 我的作品。
 *
 * 一条内容从选题到标题要经过好几个板块，每个板块的产出原来都是"一次性"的：
 * 做完不接着往下走，过两天就找不回来了（线上有 57 条脚本、分镜、审稿没挂到
 * 任何作品上）。这一页把所有作品摊开，每个环节都能点开——做过的打开看、
 * 接着改；没做的直接去做。隔多久都行，只要数据还在。
 *
 * 点开用的是 ?work= 地址（lib/resume.ts），目标页会把这个作品的内容取回来。
 */

type Filter = "active" | "done" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "进行中" },
  { id: "done", label: "已完成" },
  { id: "all", label: "全部" },
];

export default function WorksPage() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  useEffect(() => {
    listWorks(50).then(setWorks);
  }, []);

  const remove = async (w: Work) => {
    const ok = await confirmDialog(
      `删掉作品「${w.title}」？\n已经写好的脚本、分镜这些内容不会删，仍然在各板块的历史记录里。`,
      { tone: "danger", confirmText: "删除", title: "删除作品" }
    );
    if (!ok) return;
    if (await deleteWork(w.id)) {
      setWorks((prev) => (prev ?? []).filter((x) => x.id !== w.id));
      notify("已删除");
    } else {
      notify("删除失败，请重试");
    }
  };

  const shown = (works ?? []).filter((w) =>
    filter === "all" ? true : filter === "done" ? w.is_done : !w.is_done
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <FolderOpen className="h-6 w-6 text-primary" />
          我的作品
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每一条内容从选题到标题的全过程。点任何一个环节都能打开接着做，隔多久都行
        </p>
      </header>

      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((f) => {
          const n = (works ?? []).filter((w) =>
            f.id === "all" ? true : f.id === "done" ? w.is_done : !w.is_done
          ).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                filter === f.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {works && <span className="ml-1 opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      {works === null ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-6 sm:p-10 text-center text-sm text-muted-foreground">
          {filter === "done" ? "还没有做完的作品" : "还没有作品。"}
          {filter !== "done" && (
            <>
              从
              <Link href="/dashboard/topic" className="mx-1 text-primary hover:underline">选题策划</Link>
              挑一条选题开始，或者直接去
              <Link href="/dashboard/script" className="mx-1 text-primary hover:underline">写脚本</Link>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((w) => (
            <WorkCard key={w.id} work={w} onDelete={() => remove(w)} />
          ))}
        </ul>
      )}
    </div>
  );
}
