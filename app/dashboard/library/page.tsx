"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check, Copy, Download, Loader2, NotebookPen, Pencil, Search, Star, Trash2, Wand2, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CreationLinks } from "@/components/workspace/CreationLinks";
import { OutputsPanel } from "@/components/library/OutputsPanel";
import { RealMaterialForm } from "@/components/library/RealMaterialForm";
import { CreatorPresets } from "@/components/library/CreatorPresets";
import { postSafely } from "@/lib/safe-post";
import { copyText } from "@/lib/clipboard";
import { throwApiError } from "@/lib/api-error";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { DEFAULT_PROFILE_SCOPE } from "@/lib/profile-history";
import { CATEGORY_NEXT, LIBRARY_CATEGORIES, MATERIAL_KINDS, PAGE_SIZE, categoryLabel, kindLabel, type LibraryCategory, type LibraryItem, type LibraryListItem, type MaterialKind } from "@/lib/library";

/*
 * 素材库（2026-10-02；2026-10-03 改成分页 + 真实素材 + 好稿 + 风格预设）。
 *
 * 产品方："每个板块生成的好内容要能收藏保留起来，用户再用时不会浪费之前的资源。"
 * 收藏入口在各板块结果下面的「继续创作」那一栏；这里按分类摊开，每条都能直接拿去继续创作。
 * 和「创作进度」分开：进度管的是一条内容做到哪一步、拍没拍；这里管的是攒下来的好素材。
 *
 * 列表在服务端分页、搜索（GET /api/library），只带预览；正文点开再取。
 * 原来一次取 500 条在浏览器里筛，第 501 条以后看不到也搜不到。
 */

const fmt = (s: string) => new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

interface Counts { all: number; categories: Record<string, number>; kinds: Record<string, number> }

export default function LibraryPage() {
  /*
   * 三部分：
   *   我的收藏：自己挑出来的好内容 + 自己记下的真实素材
   *   全部产出：历史里生成过的所有结果，自动按库归好（选题库、脚本库……），不用收藏也在
   *   风格预设：从认可的好稿里学写法，生成时套用
   */
  const [tab, setTab] = useState<"favorites" | "outputs" | "presets">("favorites");
  const [outputsTotal, setOutputsTotal] = useState<number | null>(null);
  // undefined = 还没读到当前档案，先别加载（免得先拉全部档案、再拉一遍当前档案）
  const [activeProfile, setActiveProfile] = useState<string | null | undefined>(undefined);
  const autoTabbed = useRef(false);
  const [items, setItems] = useState<LibraryListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notReady, setNotReady] = useState("");
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState<LibraryCategory | "all">("all");
  const [kind, setKind] = useState<MaterialKind | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, LibraryItem>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [editingBody, setEditingBody] = useState<{ id: string; content: string } | null>(null);
  const [recording, setRecording] = useState<null | { editId?: string; item?: LibraryItem }>(null);
  const reqId = useRef(0);
  const [version, setVersion] = useState(0);

  const query = useCallback((offset: number) => {
    const p = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
    if (activeProfile) p.set("profileId", activeProfile);
    if (category !== "all") p.set("category", category);
    if (kind !== "all") p.set("kind", kind);
    if (q.trim()) p.set("q", q.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/api/library?${p.toString()}`;
  }, [activeProfile, category, kind, q, from, to]);

  /*
   * 只看当前档案的（2026-10-04 产品方：档案之间互相独立，档案 1 收藏、生成的，档案 2 看不到）。
   * 原来有「全部档案」切换，去掉了。没选档案时看没挂档案的旧内容（default）。侧边栏切了档案跟着换。
   */
  useEffect(() => {
    const read = () => setActiveProfile(getActiveProfileId() || DEFAULT_PROFILE_SCOPE);
    read();
    return onActiveProfileChange(read);
  }, []);

  // 第一页（筛选变了重来；搜索停手 300ms 再搜）
  useEffect(() => {
    if (activeProfile === undefined) return;
    const my = ++reqId.current;
    setItems(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(query(0));
        if (!res.ok && res.status !== 503) await throwApiError(res, "素材库加载失败");
        const data = await res.json().catch(() => ({}));
        if (my !== reqId.current) return;
        if (res.status === 503) setNotReady(data.error || "素材库还没启用");
        const list: LibraryListItem[] = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        setTotal(typeof data.total === "number" ? data.total : list.length);
        setNotice(data.notice || "");
        if (data.counts) setCounts(data.counts);
        // 还没收藏过：直接打开「全部产出」，别让人对着空列表
        if (!autoTabbed.current) { autoTabbed.current = true; if ((data.counts?.all ?? list.length) === 0) setTab("outputs"); }
      } catch {
        if (my !== reqId.current) return;
        notify("素材库加载失败，请刷新重试", "error");
        setItems([]);
      }
    }, q.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [activeProfile, query, q, version]);

  const loadMore = async () => {
    if (!items) return;
    const my = reqId.current;
    setLoadingMore(true);
    try {
      const res = await fetch(query(items.length));
      if (!res.ok) await throwApiError(res, "加载失败");
      const data = await res.json().catch(() => ({}));
      if (my !== reqId.current) return;
      const more: LibraryListItem[] = Array.isArray(data.items) ? data.items : [];
      // 翻页期间新收藏了几条，会把旧的往后挤：按 id 去重
      setItems((cur) => {
        const seen = new Set((cur ?? []).map((x) => x.id));
        return [...(cur ?? []), ...more.filter((x) => !seen.has(x.id))];
      });
      if (typeof data.total === "number") setTotal(data.total);
    } catch {
      notify("加载失败，请重试", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const getBody = async (id: string): Promise<LibraryItem | null> => {
    if (bodies[id]) return bodies[id];
    setLoadingBody(id);
    try {
      const r = await fetch(`/api/library?id=${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.item) throw new Error(d.error || "读取失败");
      setBodies((b) => ({ ...b, [id]: d.item }));
      return d.item as LibraryItem;
    } catch (e) {
      notify((e as Error).message || "读取失败，请重试", "error");
      return null;
    } finally {
      setLoadingBody(null);
    }
  };

  const toggleOpen = async (id: string) => {
    if (open === id) return setOpen(null);
    if (await getBody(id)) setOpen(id);
  };
  const toggleContinue = async (id: string) => {
    if (continuing === id) return setContinuing(null);
    if (await getBody(id)) setContinuing(id);
  };
  const copy = async (id: string) => {
    // 复制要在点击里同步做（http 下用的是老办法）：正文没取过就先取、展开，再点一次
    const b = bodies[id];
    if (b) return copyText(b.content) ? notify("已复制") : notify("复制失败，请展开后手动选中复制", "error");
    if (await getBody(id)) { setOpen(id); notify("全文已展开，再点一次复制"); }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await postSafely(`/api/library?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) await throwApiError(res, "保存失败，请重试");
  };

  const remove = async (it: LibraryListItem) => {
    if (!(await confirmDialog(`从素材库删掉「${it.title}」？`, { tone: "danger", confirmText: "删除", title: "删除素材" }))) return;
    const res = await postSafely(`/api/library?id=${it.id}`, { method: "DELETE" });
    if (!res.ok) return notify("删除失败，请重试", "error");
    setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id));
    setTotal((n) => Math.max(0, n - 1));
    notify("已删除");
  };

  const rename = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return setEditing(null);
    try {
      await patch(editing.id, { title });
      setItems((cur) => (cur ?? []).map((x) => (x.id === editing.id ? { ...x, title } : x)));
      setEditing(null);
    } catch (e) { notify((e as Error).message, "error"); }
  };

  const saveBody = async () => {
    if (!editingBody) return;
    try {
      await patch(editingBody.id, { content: editingBody.content });
      const content = editingBody.content.trim();
      setBodies((b) => ({ ...b, [editingBody.id]: { ...b[editingBody.id], content } }));
      setItems((cur) => (cur ?? []).map((x) => (x.id === editingBody.id ? { ...x, preview: content.slice(0, 140), length: content.length } : x)));
      setEditingBody(null);
      notify("已保存修改");
    } catch (e) {
      // 失败时编辑框里的内容原样留着
      notify((e as Error).message, "error");
    }
  };

  const toggleApproved = async (it: LibraryListItem) => {
    const next: MaterialKind = it.kind === "approved" ? "ai" : "approved";
    try {
      await patch(it.id, { kind: next });
      setItems((cur) => (cur ?? []).map((x) => (x.id === it.id ? { ...x, kind: next } : x)));
      notify(next === "approved" ? "已认可为好稿：可以在「风格预设」里当示例" : "已取消认可");
    } catch (e) { notify((e as Error).message, "error"); }
  };

  // 记录 / 修改了真实素材：清掉缓存的正文，重新取第一页
  const reload = () => { setRecording(null); setBodies({}); setOpen(null); setVersion((v) => v + 1); };

  const chip = (active: boolean, onClick: () => void, label: string, n?: number, key?: string) => (
    <button key={key ?? label} type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${active ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
      {label}{typeof n === "number" && <span className="ml-1 opacity-70">{n}</span>}
    </button>
  );

  const exportHref = `/api/library/export${activeProfile ? `?profileId=${encodeURIComponent(activeProfile)}` : ""}`;
  const filtered = category !== "all" || kind !== "all" || q.trim() || from || to;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Bookmark className="h-6 w-6 text-primary" />
          素材库
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你的创作资产都在这里：收藏的好内容、自己记下的真实素材，加上各板块生成过的全部结果（自动按选题库、脚本库……归好）。随时拿去继续创作
        </p>
      </header>

      <div className="mb-4 flex gap-1.5 overflow-x-auto border-b border-border" role="tablist" aria-label="素材库分区">
        {([["favorites", "我的收藏", counts?.all], ["outputs", "全部产出", outputsTotal], ["presets", "风格预设", undefined]] as const).map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[14px] font-medium transition-colors ${tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}{typeof n === "number" && <span className="ml-1 text-[12px] opacity-70">{n}</span>}
          </button>
        ))}
      </div>

      {tab !== "presets" && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "outputs" ? "搜标题、全文" : "搜标题、全文、备注"} aria-label="搜索素材" className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="清空搜索"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>时间</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="开始日期" className="rounded-lg border border-border bg-background/50 px-2 py-1 text-foreground" />
            <span>至</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="结束日期" className="rounded-lg border border-border bg-background/50 px-2 py-1 text-foreground" />
            {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-primary">清除时间</button>}
          </div>
        </div>
      )}

      {/* 全部产出常驻挂载：切回收藏再切回来不用重新加载；数量一进页面就能显示在标签上 */}
      <div hidden={tab !== "outputs"}>
        {activeProfile !== undefined && <OutputsPanel profileId={activeProfile} q={tab === "outputs" ? q : ""} from={from} to={to} onCounts={setOutputsTotal} />}
      </div>

      {tab === "presets" && <CreatorPresets />}

      {tab === "favorites" && (<>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRecording(recording ? null : {})}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90">
          <NotebookPen className="h-4 w-4" />记录真实素材
        </button>
        <a href={exportHref} download className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />导出这个档案的
        </a>
      </div>

      {recording && (
        <RealMaterialForm profileId={activeProfile && activeProfile !== DEFAULT_PROFILE_SCOPE ? activeProfile : null} editId={recording.editId}
          initial={recording.item ? { title: recording.item.title, fields: recording.item.fields } : undefined}
          onCancel={() => setRecording(null)} onSaved={() => { reload(); }} />
      )}

      {notice && <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-600 dark:text-amber-400">{notice}</div>}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {chip(kind === "all", () => setKind("all"), "全部来源", counts?.all)}
        {MATERIAL_KINDS.map((k) => chip(kind === k.id, () => setKind(k.id), k.label, counts?.kinds[k.id] ?? 0, k.id))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip(category === "all", () => setCategory("all"), "全部分类", counts?.all)}
        {LIBRARY_CATEGORIES.filter((c) => counts?.categories[c.id] || category === c.id).map((c) => chip(category === c.id, () => setCategory(c.id), c.label, counts?.categories[c.id] ?? 0, c.id))}
      </div>

      {notReady ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-amber-500">{notReady}</div>
      ) : items === null ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-center text-sm leading-relaxed text-muted-foreground sm:p-10">
          {!filtered && (counts?.all ?? 0) === 0
            ? <>素材库还是空的。在选题、脚本、自由对话……任何板块生成结果后，点结果下面的「<span className="text-primary">收藏到素材库</span>」就会存到这里；也可以点上面的「记录真实素材」，把客户的真实问题和结果记下来。</>
            : "没有符合条件的素材，换个分类、时间或关键词试试"}
        </div>
      ) : (
        <>
        <p className="mb-2 text-[12px] text-muted-foreground">共 {total} 条{items.length < total ? `，已显示 ${items.length} 条` : ""}</p>
        <ul className="space-y-3">
          {items.map((it) => {
            const full = bodies[it.id];
            return (
            <li key={it.id} className="glass-panel rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {editing?.id === it.id ? (
                    <input autoFocus value={editing.title} onChange={(e) => setEditing({ id: it.id, title: e.target.value })}
                      onBlur={rename} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setEditing(null); }}
                      aria-label="素材标题" className="w-full rounded-lg border border-primary bg-background px-2 py-1 text-[14px] text-foreground outline-none" />
                  ) : (
                    <button type="button" onClick={() => toggleOpen(it.id)} className="block w-full text-left">
                      <span className="block break-words font-medium leading-6 text-foreground">{it.title}</span>
                    </button>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                    <span className={`rounded px-1.5 py-0.5 ${it.kind === "real" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : it.kind === "approved" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted"}`}>{kindLabel(it.kind)}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{categoryLabel(it.category)}</span>
                    {it.source && <span>来自{it.source}</span>}
                    <span>{fmt(it.created_at)} {it.kind === "real" ? "记录" : "收藏"}</span>
                  </p>
                  {open !== it.id && <p className="mt-2 line-clamp-2 break-words text-[12.5px] leading-relaxed text-muted-foreground">{it.preview}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {it.kind !== "real" && (
                    <IconBtn label={it.kind === "approved" ? "取消认可" : "认可为好稿（可当风格示例）"} onClick={() => toggleApproved(it)}>
                      <Star className={`h-4 w-4 ${it.kind === "approved" ? "fill-amber-400 text-amber-500" : ""}`} />
                    </IconBtn>
                  )}
                  <IconBtn label="改名" onClick={() => setEditing({ id: it.id, title: it.title })}><Pencil className="h-4 w-4" /></IconBtn>
                  <IconBtn label="复制" onClick={() => copy(it.id)}><Copy className="h-4 w-4" /></IconBtn>
                  <IconBtn label="删除" danger onClick={() => remove(it)}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>

              {open === it.id && full && (
                editingBody?.id === it.id ? (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <textarea value={editingBody.content} onChange={(e) => setEditingBody({ id: it.id, content: e.target.value })} rows={12} aria-label="编辑正文"
                      className="w-full resize-y rounded-lg border border-primary bg-background px-3 py-2 text-[13.5px] leading-relaxed text-foreground outline-none" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingBody(null)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">取消</button>
                      <button type="button" onClick={saveBody} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white"><Check className="h-3.5 w-3.5" />保存</button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert mt-3 max-w-none break-words border-t border-border/60 pt-3 prose-headings:text-[14px] prose-p:text-[13.5px] prose-li:text-[13.5px]">
                    <Markdown>{full.content}</Markdown>
                  </div>
                )
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => toggleContinue(it.id)} disabled={loadingBody === it.id}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                  {loadingBody === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}{continuing === it.id ? "收起" : "继续创作"}
                </button>
                <button type="button" onClick={() => toggleOpen(it.id)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
                  {open === it.id ? "收起全文" : `看全文${it.length ? `（${it.length} 字）` : ""}`}
                </button>
                {open === it.id && full && editingBody?.id !== it.id && (
                  it.kind === "real"
                    ? <button type="button" onClick={() => setRecording({ editId: it.id, item: full })} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">修改各栏</button>
                    : <button type="button" onClick={() => setEditingBody({ id: it.id, content: full.content })} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">编辑正文</button>
                )}
              </div>
              {continuing === it.id && full && (
                <div className="mt-3">
                  <CreationLinks body={full.content} hideFavorite recommended={CATEGORY_NEXT[it.category as LibraryCategory] ?? CATEGORY_NEXT.other}
                      context={{ ...full.fields?.creationContext, from: `素材库·${it.source || categoryLabel(it.category)}`, title: it.title }} heading="去哪个板块 · 内容自动带入" />
                </div>
              )}
            </li>
          );})}
        </ul>
        {items.length < total && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={loadMore} disabled={loadingMore}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-60">
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}再加载 {Math.min(PAGE_SIZE, total - items.length)} 条（还有 {total - items.length} 条）
            </button>
          </div>
        )}
        </>
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
