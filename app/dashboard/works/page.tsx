"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, Loader2 } from "lucide-react";
import { listWorks, deleteWork, setShootStatus, progressGroup, type ProgressGroup, type ShootStatus, type Work } from "@/lib/works";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { WorkCard } from "@/components/works/WorkCard";

/*
 * 创作进度（原「我的作品」，2026-10-02 改名并加上落地状态）。
 *
 * 一条内容从选题到标题要经过好几个板块，每个板块的产出原来都是"一次性"的：
 * 做完不接着往下走，过两天就找不回来了（线上有 57 条脚本、分镜、审稿没挂到
 * 任何作品上）。这一页把所有作品摊开，每个环节都能点开——做过的打开看、
 * 接着改；没做的直接去做。隔多久都行，只要数据还在。
 *
 * 产品方要求再往后管一步：内容做完了拍没拍、发没发，并且提醒（"脚本好了 3 天还没拍"）。
 * 收藏的好素材在「素材库」，和这里分开。
 *
 * 点开用的是 ?work= 地址（lib/resume.ts），目标页会把这个作品的内容取回来。
 */

type Filter = ProgressGroup | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "创作中" },
  { id: "toShoot", label: "待拍摄" },
  { id: "shot", label: "已拍摄" },
  { id: "published", label: "已发布" },
  { id: "all", label: "全部" },
];

export default function WorksPage() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  useEffect(() => {
    listWorks(50).then((list) => {
      setWorks(list);
      // 没有创作中的、但有待拍摄的：直接打开待拍摄，别让人对着空列表
      if (!list.some((w) => progressGroup(w) === "active") && list.some((w) => progressGroup(w) === "toShoot")) setFilter("toShoot");
    });
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

  const changeShoot = async (w: Work, status: ShootStatus) => {
    try {
      const saved = await setShootStatus(w.id, status);
      setWorks((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, ...saved, stages: x.stages, optional: x.optional, doneCount: x.doneCount } : x)));
      notify(status === "published" ? "已标记为发布 🎉" : status === "shot" ? "已标记为拍摄完成" : "已改回还没拍");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };

  const count = (f: Filter) => (works ?? []).filter((w) => f === "all" || progressGroup(w) === f).length;
  const shown = (works ?? []).filter((w) => filter === "all" || progressGroup(w) === filter);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ListChecks className="h-6 w-6 text-primary" />
          创作进度
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每一条内容做到哪一步、拍没拍、发没发。点任何一个环节都能打开接着做；收藏的好素材在
          <Link href="/dashboard/library" className="mx-1 text-primary hover:underline">素材库</Link>
        </p>
      </header>

      {works && works.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["active", "toShoot", "shot", "published"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setFilter(g)} className={`glass-panel rounded-xl px-3 py-2.5 text-left ${filter === g ? "ring-1 ring-primary" : ""}`}>
              <span className="block text-[11.5px] text-muted-foreground">{FILTERS.find((f) => f.id === g)!.label}</span>
              <span className={`text-xl font-semibold ${g === "toShoot" && count(g) ? "text-amber-500" : "text-foreground"}`}>{count(g)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
              filter === f.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            {works && <span className="ml-1 opacity-70">{count(f.id)}</span>}
          </button>
        ))}
      </div>

      {works === null ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-6 sm:p-10 text-center text-sm text-muted-foreground">
          {filter === "toShoot" ? "没有待拍摄的：内容做完（标题封面也出了）的作品会出现在这里"
            : filter === "shot" ? "还没有标记为已拍摄的作品"
            : filter === "published" ? "还没有标记为已发布的作品"
            : "还没有作品。"}
          {(filter === "active" || filter === "all") && (
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
            <WorkCard key={w.id} work={w} onDelete={() => remove(w)} onShootChange={(s) => changeShoot(w, s)} />
          ))}
        </ul>
      )}
    </div>
  );
}
