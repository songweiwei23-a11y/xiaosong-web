"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, Loader2 } from "lucide-react";
import { listWorksPage, workGroupCounts, deleteWork, setShootStatus, saveWorkMetrics, type ProgressGroup, type ShootStatus, type Work } from "@/lib/works";
import { PerformanceReview } from "@/components/works/PerformanceReview";
import { invalidateCreatorContext } from "@/hooks/useCreatorContext";
import type { WorkMetrics } from "@/lib/performance";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { WorkCard } from "@/components/works/WorkCard";
import { MetricsImport } from "@/components/works/MetricsImport";
import { onActiveProfileChange } from "@/lib/active-profile";

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

const PAGE = 20;
const isFilter = (v: string | null): v is Filter => !!v && FILTERS.some((f) => f.id === v);

export default function WorksPage() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  /*
   * 各组数量用数据库计数（2026-10-04）。原来取最近 50 条在浏览器里数和筛，第 51 条以后的作品看不到也不算数。
   * 列表按组在服务端筛、翻页（再加载 20 条）
   */
  const [counts, setCounts] = useState<(Record<ProgressGroup, number> & { all: number }) | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  // 录了数据就刷新数据复盘
  const [perfRev, setPerfRev] = useState(0);

  const refreshCounts = () => workGroupCounts().then((c) => { setCounts(c); return c; });

  // 先要数量，再定打开哪一组：地址里 ?group= 指定的（首页「今天拍什么」），否则创作中；没有创作中的、有待拍摄的，打开待拍摄
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("group");
    refreshCounts().then((c) => {
      if (isFilter(wanted)) setFilter(wanted);
      else setFilter(c && !c.active && c.toShoot ? "toShoot" : "active");
    });
  }, []);

  // 只看当前档案的作品（lib/works 按档案取）；侧边栏切了档案，数量和列表都换成那个档案的
  const [profileTick, setProfileTick] = useState(0);
  useEffect(() => onActiveProfileChange(() => { refreshCounts(); setProfileTick((n) => n + 1); }), []);

  useEffect(() => {
    if (!filter) return;
    let alive = true;
    setWorks(null); setLoadError("");
    listWorksPage({ group: filter === "all" ? null : filter, limit: PAGE })
      .then((list) => { if (alive) { setWorks(list); setHasMore(list.length === PAGE); } })
      .catch((e) => { if (alive) { setWorks([]); setLoadError((e as Error).message); } });
    return () => { alive = false; };
  }, [filter, profileTick]);

  const loadMore = async () => {
    if (!works || !filter) return;
    setLoadingMore(true);
    try {
      const more = await listWorksPage({ group: filter === "all" ? null : filter, offset: works.length, limit: PAGE });
      // 翻页期间有作品更新会挪位置：按 id 去重
      setWorks((cur) => { const seen = new Set((cur ?? []).map((w) => w.id)); return [...(cur ?? []), ...more.filter((w) => !seen.has(w.id))]; });
      setHasMore(more.length === PAGE);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (w: Work) => {
    const ok = await confirmDialog(
      `删掉作品「${w.title}」？\n已经写好的脚本、分镜这些内容不会删，仍然在各板块的历史记录里。`,
      { tone: "danger", confirmText: "删除", title: "删除作品" }
    );
    if (!ok) return;
    if (await deleteWork(w.id)) {
      setWorks((prev) => (prev ?? []).filter((x) => x.id !== w.id));
      refreshCounts();
      notify("已删除");
    } else {
      notify("删除失败，请重试");
    }
  };

  const changeShoot = async (w: Work, status: ShootStatus) => {
    try {
      const saved = await setShootStatus(w.id, status);
      // 改完不立刻从当前组挪走（免得一点就不见了、以为没点上），数量先跟上
      setWorks((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, ...saved, stages: x.stages, optional: x.optional, doneCount: x.doneCount } : x)));
      refreshCounts();
      notify(status === "published" ? "已标记为发布 🎉" : status === "shot" ? "已标记为拍摄完成" : "已改回还没拍");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };

  /** 录发布后的数据（数据回流）：存上了刷新卡片和数据复盘 */
  const saveMetrics = async (w: Work, metrics: WorkMetrics | null): Promise<boolean> => {
    try {
      const saved = await saveWorkMetrics(w.id, metrics);
      setWorks((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, metrics: saved.metrics ?? null } : x)));
      setPerfRev((n) => n + 1);
      // 各板块缓存的账号上下文里有数据汇总，作废让它重新取
      invalidateCreatorContext();
      notify("数据已保存，选题和方向会参考它");
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    }
  };

  // 数量拿不到（拍摄状态的迁移没跑）时不显示数字，别显示成 0
  const count = (f: Filter): number | null => (counts ? (f === "all" ? counts.all : counts[f]) : null);
  const shown = works ?? [];

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

      {/* 数据复盘（数据回流）：发布后录的数据汇总，同样会写进选题、方向的提示词 */}
      {(counts?.published ?? 0) > 0 && <PerformanceReview revision={perfRev} />}
      {/* 从平台后台复制数据表批量导入（2026-10-04） */}
      {(counts?.published ?? 0) > 0 && (
        <MetricsImport onSaved={() => {
          setPerfRev((n) => n + 1);
          invalidateCreatorContext();
          // 当前列表里的作品数据跟着刷新
          if (filter) listWorksPage({ group: filter === "all" ? null : filter, limit: Math.max(PAGE, works?.length ?? 0) }).then(setWorks).catch(() => {});
        }} />
      )}

      {counts && counts.all > 0 && (
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
            {count(f.id) !== null && <span className="ml-1 opacity-70">{count(f.id)}</span>}
          </button>
        ))}
      </div>

      {works === null ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div role="alert" className="glass-panel rounded-2xl border border-border p-6 text-center text-sm text-destructive">{loadError}</div>
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
            <WorkCard key={w.id} work={w} onDelete={() => remove(w)} onShootChange={(s) => changeShoot(w, s)} onMetricsSave={(m) => saveMetrics(w, m)} />
          ))}
        </ul>
      )}
      {works && hasMore && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="flex items-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-60">
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}再加载 {PAGE} 条
          </button>
        </div>
      )}
    </div>
  );
}
