"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Copy, Loader2, Pencil, Search, Trash2, Wand2, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CreationLinks } from "@/components/workspace/CreationLinks";
import { OutputsPanel } from "@/components/library/OutputsPanel";
import { postSafely } from "@/lib/safe-post";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { CATEGORY_NEXT, LIBRARY_CATEGORIES, categoryLabel, type LibraryCategory, type LibraryItem } from "@/lib/library";

/*
 * 素材库（2026-10-02）。
 *
 * 产品方："每个板块生成的好内容要能收藏保留起来，用户再用时不会浪费之前的资源。"
 * 收藏入口在各板块结果下面的「继续创作」那一栏；这里按分类摊开，每条都能直接拿去继续创作。
 * 和「创作进度」分开：进度管的是一条内容做到哪一步、拍没拍；这里管的是攒下来的好素材。
 */

const fmt = (s: string) => new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const preview = (s: string) => s.replace(/[#*>|`-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

export default function LibraryPage() {
  /*
   * 两部分（2026-10-02 产品方）：
   *   我的收藏：自己挑出来的好内容
   *   全部产出：历史里生成过的所有结果，自动按库归好（选题库、脚本库……），不用收藏也在
   * 合起来就是这个用户攒下的全部创作资产
   */
  const [tab, setTab] = useState<"favorites" | "outputs">("favorites");
  const [outputsTotal, setOutputsTotal] = useState<number | null>(null);
  // undefined = 还没读到当前档案，先别加载产出（免得先拉全部档案、再拉一遍当前档案）
  const [activeProfile, setActiveProfile] = useState<string | null | undefined>(undefined);
  const autoTabbed = useRef(false);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [notReady, setNotReady] = useState("");
  const [scope, setScope] = useState<"profile" | "all">("profile");
  const [category, setCategory] = useState<LibraryCategory | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const load = async () => {
    setItems(null);
    const pid = scope === "profile" ? getActiveProfileId() : null;
    setActiveProfile(pid);
    try {
      const res = await fetch(`/api/library${pid ? `?profileId=${encodeURIComponent(pid)}` : ""}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) setNotReady(data.error || "素材库还没启用");
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      // 还没收藏过：直接打开「全部产出」，别让人对着空列表
      if (!autoTabbed.current) { autoTabbed.current = true; if (list.length === 0) setTab("outputs"); }
    } catch {
      notify("素材库加载失败，请刷新重试", "error");
      setItems([]);
    }
  };

  useEffect(() => {
    load();
    // 侧边栏切了档案，跟着换
    return onActiveProfileChange(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items ?? []) m[it.category] = (m[it.category] ?? 0) + 1;
    return m;
  }, [items]);

  const shown = (items ?? []).filter((it) => {
    if (category !== "all" && it.category !== category) return false;
    const kw = q.trim();
    return !kw || it.title.includes(kw) || it.content.includes(kw) || it.note.includes(kw);
  });

  const remove = async (it: LibraryItem) => {
    if (!(await confirmDialog(`从素材库删掉「${it.title}」？`, { tone: "danger", confirmText: "删除", title: "删除素材" }))) return;
    const res = await fetch(`/api/library?id=${it.id}`, { method: "DELETE" });
    if (!res.ok) return notify("删除失败，请重试", "error");
    setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id));
    notify("已删除");
  };

  const rename = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return setEditing(null);
    const res = await postSafely(`/api/library?id=${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!res.ok) return notify("改名失败，请重试", "error");
    setItems((cur) => (cur ?? []).map((x) => (x.id === editing.id ? { ...x, title } : x)));
    setEditing(null);
  };

  const chip = (id: LibraryCategory | "all", label: string, n: number) => (
    <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id}
      className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${category === id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
      {label}<span className="ml-1 opacity-70">{n}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Bookmark className="h-6 w-6 text-primary" />
          素材库
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你的创作资产都在这里：收藏的好内容，加上各板块生成过的全部结果（自动按选题库、脚本库……归好）。随时拿去继续创作
        </p>
      </header>

      <div className="mb-4 flex gap-1.5 border-b border-border" role="tablist" aria-label="素材库分区">
        {([["favorites", "我的收藏", items?.length], ["outputs", "全部产出", outputsTotal]] as const).map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-medium transition-colors ${tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}{typeof n === "number" && <span className="ml-1 text-[12px] opacity-70">{n}</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-[12.5px]">
          {(["profile", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s}
              className={`rounded-md px-2.5 py-1 ${scope === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {s === "profile" ? "当前档案" : "全部档案"}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "outputs" ? "搜标题、内容" : "搜标题、内容、备注"} aria-label="搜索素材" className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="清空搜索"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </label>
      </div>

      {/* 全部产出常驻挂载：切回收藏再切回来不用重新加载；数量一进页面就能显示在标签上 */}
      <div hidden={tab !== "outputs"}>
        {activeProfile !== undefined && <OutputsPanel profileId={activeProfile} q={tab === "outputs" ? q : ""} onCounts={setOutputsTotal} />}
      </div>

      {tab === "favorites" && (<>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip("all", "全部", items?.length ?? 0)}
        {LIBRARY_CATEGORIES.filter((c) => counts[c.id]).map((c) => chip(c.id, c.label, counts[c.id]))}
      </div>

      {notReady ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-amber-500">{notReady}</div>
      ) : items === null ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-center text-sm leading-relaxed text-muted-foreground sm:p-10">
          {items.length === 0
            ? <>素材库还是空的。在选题、脚本、自由对话……任何板块生成结果后，点结果下面的「<span className="text-primary">收藏到素材库</span>」就会存到这里；一批里只想留几条，先勾选再收藏。</>
            : "没有符合条件的素材，换个分类或关键词试试"}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((it) => (
            <li key={it.id} className="glass-panel rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {editing?.id === it.id ? (
                    <input autoFocus value={editing.title} onChange={(e) => setEditing({ id: it.id, title: e.target.value })}
                      onBlur={rename} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setEditing(null); }}
                      aria-label="素材标题" className="w-full rounded-lg border border-primary bg-background px-2 py-1 text-[14px] text-foreground outline-none" />
                  ) : (
                    <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="block w-full text-left">
                      <span className="block font-medium leading-6 text-foreground">{it.title}</span>
                    </button>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{categoryLabel(it.category)}</span>
                    {it.source && <span>来自{it.source}</span>}
                    <span>{fmt(it.created_at)} 收藏</span>
                  </p>
                  {open !== it.id && <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{preview(it.content)}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn label="改名" onClick={() => setEditing({ id: it.id, title: it.title })}><Pencil className="h-4 w-4" /></IconBtn>
                  <IconBtn label="复制" onClick={() => { navigator.clipboard?.writeText(it.content); notify("已复制"); }}><Copy className="h-4 w-4" /></IconBtn>
                  <IconBtn label="删除" danger onClick={() => remove(it)}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>

              {open === it.id && (
                <div className="prose prose-slate dark:prose-invert mt-3 max-w-none border-t border-border/60 pt-3 prose-headings:text-[14px] prose-p:text-[13.5px] prose-li:text-[13.5px]">
                  <Markdown>{it.content}</Markdown>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setContinuing(continuing === it.id ? null : it.id)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90">
                  <Wand2 className="h-3.5 w-3.5" />{continuing === it.id ? "收起" : "继续创作"}
                </button>
                <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
                  {open === it.id ? "收起全文" : "看全文"}
                </button>
              </div>
              {continuing === it.id && (
                <div className="mt-3">
                  <CreationLinks body={it.content} hideFavorite recommended={CATEGORY_NEXT[it.category as LibraryCategory] ?? CATEGORY_NEXT.other}
                    context={{ from: `素材库·${it.source || categoryLabel(it.category)}`, title: it.title }} heading="去哪个板块 · 内容自动带入" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      </>)}
    </div>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`rounded-lg p-1.5 text-muted-foreground ${danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"}`}>
      {children}
    </button>
  );
}
