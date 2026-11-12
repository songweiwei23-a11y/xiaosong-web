"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Wand2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CreationLinks } from "@/components/workspace/CreationLinks";
import { notify } from "@/components/ui/feedback";
import { historyOpenUrl } from "@/lib/resume";
import { CATEGORY_NEXT, PAGE_SIZE } from "@/lib/library";
import { copyText } from "@/lib/clipboard";
import { OUTPUT_LIBRARIES, outputLibrary, type OutputLibrary } from "@/lib/library-outputs";
import type { CreationContext } from '@/lib/creation-flow';

interface OutputItem { id: string; historyId: string; taskType: string; title: string; preview: string; createdAt: string; workId: string | null }

const fmt = (s: string) => new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

/**
 * 素材库「全部产出」（2026-10-02）：各板块生成过的结果，不用收藏也自动按库归好。
 * 列表只有标题和预览，全文点开再取（lib/library-outputs、app/api/library/outputs）。
 * 每条都能看全文、复制、继续创作、收藏、回到原板块接着改。
 */
export function OutputsPanel({ profileId, q, from = "", to = "", onCounts }: { profileId: string | null; q: string; from?: string; to?: string; onCounts?: (total: number) => void }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [lib, setLib] = useState<OutputLibrary["id"] | null>(null);
  const [items, setItems] = useState<OutputItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // 选题索引：迁移没跑（indexReady=false）时选题库每次现拆全文；旧批次多时分几次补（indexing>0）
  const [indexState, setIndexState] = useState<{ ready: boolean; pending: number }>({ ready: true, pending: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [contexts, setContexts] = useState<Record<string, CreationContext>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const reqId = useRef(0);
  const lastBase = useRef<string | null>(null);

  const params = new URLSearchParams();
  if (profileId) params.set("profileId", profileId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const base = params.toString();

  // 各库数量；默认打开第一个有内容的库。选题还在整理时，隔一会儿再要一次，直到补齐
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 筛选变了才清空；整理选题时的再次请求不清，免得列表闪
    if (lastBase.current !== base) { lastBase.current = base; setCounts(null); setItems(null); setBodies({}); setContexts({}); }
    fetch(`/api/library/outputs?${base}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const c: Record<string, number> = d.counts ?? {};
        setCounts(c);
        setIndexState({ ready: d.indexReady !== false, pending: d.indexing ?? 0 });
        onCounts?.(Object.values(c).reduce((a, b) => a + b, 0));
        setLib((cur) => (cur && c[cur] ? cur : OUTPUT_LIBRARIES.find((l) => c[l.id])?.id ?? null));
        if ((d.indexing ?? 0) > 0) timer = setTimeout(() => setRound((n) => n + 1), 1500);
      })
      .catch(() => { if (alive) { setCounts({}); notify("产出加载失败，请刷新重试", "error"); } });
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, round]);

  const listUrl = (offset: number) => `/api/library/outputs?${base}${base ? "&" : ""}lib=${lib}&offset=${offset}&limit=${PAGE_SIZE}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;

  // 当前库的第一页（搜索在服务端做，停手 300ms 再搜）
  useEffect(() => {
    if (!lib) { setItems([]); setTotal(0); return; }
    const my = ++reqId.current;
    setItems(null);
    const t = setTimeout(() => {
      fetch(listUrl(0))
        .then((r) => r.json())
        .then((d) => {
          if (my !== reqId.current) return;
          const list = Array.isArray(d.items) ? d.items : [];
          setItems(list);
          setTotal(typeof d.total === "number" ? d.total : list.length);
        })
        .catch(() => { if (my === reqId.current) { setItems([]); notify("加载失败，请重试", "error"); } });
    }, q.trim() ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, q, base, lib === "topic" ? round : 0]);

  const loadMore = async () => {
    if (!items) return;
    const my = reqId.current;
    setLoadingMore(true);
    try {
      const d = await fetch(listUrl(items.length)).then((r) => r.json());
      if (my !== reqId.current) return;
      const more: OutputItem[] = Array.isArray(d.items) ? d.items : [];
      setItems((cur) => {
        const seen = new Set((cur ?? []).map((x) => x.id));
        return [...(cur ?? []), ...more.filter((x) => !seen.has(x.id))];
      });
      if (typeof d.total === "number") setTotal(d.total);
    } catch {
      notify("加载失败，请重试", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const getBody = async (id: string): Promise<string | null> => {
    if (bodies[id] !== undefined) return bodies[id];
    setLoadingBody(id);
    try {
      const r = await fetch(`/api/library/outputs?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "读取失败");
      setBodies((b) => ({ ...b, [id]: d.body }));
      setContexts(current => ({ ...current, [id]: d.creationContext || {} }));
      return d.body as string;
    } catch (e) {
      notify((e as Error).message || "读取失败，请重试", "error");
      return null;
    } finally {
      setLoadingBody(null);
    }
  };

  const toggleOpen = async (id: string) => {
    if (open === id) return setOpen(null);
    if (await getBody(id) !== null) setOpen(id);
  };
  const toggleContinue = async (id: string) => {
    if (continuing === id) return setContinuing(null);
    if (await getBody(id) !== null) setContinuing(id);
  };
  const copy = async (id: string) => {
    // 复制要在点击里同步做（http 下用老办法）：正文没取过就先取、展开，再点一次
    const b = bodies[id];
    if (b !== undefined) return copyText(b) ? notify("已复制") : notify("复制失败，请展开后手动选中复制", "error");
    if (await getBody(id) !== null) { setOpen(id); notify("全文已展开，再点一次复制"); }
  };

  const current = lib ? outputLibrary(lib) : undefined;

  if (counts === null) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!Object.values(counts).some(Boolean)) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-6 text-center text-sm leading-relaxed text-muted-foreground sm:p-10">
        还没有生成过内容。在选题、脚本、创作方向……任何板块生成的结果，都会自动归到这里的选题库、脚本库等各个库里
      </div>
    );
  }

  return (
    <>
      {!indexState.ready && (
        <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-600 dark:text-amber-400">选题索引还没建：选题库每次打开都要整理全部旧选题，会慢一些。请在 Supabase 执行 20261003_library_assets.sql</div>
      )}
      {indexState.pending > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[12.5px] text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />还在整理 {indexState.pending} 批旧选题，选题库的数量会陆续补全</div>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {OUTPUT_LIBRARIES.filter((l) => counts[l.id]).map((l) => (
          <button key={l.id} type="button" onClick={() => { setLib(l.id); setOpen(null); setContinuing(null); }} aria-pressed={lib === l.id}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${lib === l.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {l.label}<span className="ml-1 opacity-70">{counts[l.id]}</span>
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">没有符合条件的内容，换个关键词试试</div>
      ) : (
        <>
        <p className="mb-2 text-[12px] text-muted-foreground">共 {total} 条{items.length < total ? `，已显示 ${items.length} 条` : ""}</p>
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="glass-panel rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => toggleOpen(it.id)} className="min-w-0 flex-1 text-left">
                  <span className="block font-medium leading-6 text-foreground">{it.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{it.taskType}</span>
                    <span>{fmt(it.createdAt)} 生成</span>
                  </span>
                  {open !== it.id && it.preview && <span className="mt-2 line-clamp-2 block text-[12.5px] leading-relaxed text-muted-foreground">{it.preview}</span>}
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => copy(it.id)} aria-label="复制" title="复制" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button>
                  <Link href={historyOpenUrl({ task_type: it.taskType, work_id: it.workId })} aria-label="回到原板块" title="回到原板块接着改" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></Link>
                </div>
              </div>

              {open === it.id && bodies[it.id] && (
                <div className="prose prose-slate dark:prose-invert mt-3 max-w-none border-t border-border/60 pt-3 prose-headings:text-[14px] prose-p:text-[13.5px] prose-li:text-[13.5px]">
                  <Markdown>{bodies[it.id]}</Markdown>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => toggleContinue(it.id)} disabled={loadingBody === it.id}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                  {loadingBody === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {continuing === it.id ? "收起" : "继续创作 / 收藏"}
                </button>
                <button type="button" onClick={() => toggleOpen(it.id)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
                  {open === it.id ? "收起全文" : "看全文"}
                </button>
              </div>
              {continuing === it.id && bodies[it.id] && current && (
                <div className="mt-3">
                  <CreationLinks body={bodies[it.id]} favoriteBoard={current.board} recommended={CATEGORY_NEXT[current.id]}
                      context={{ ...contexts[it.id], from: `素材库·${it.taskType}`, title: it.title }} heading="去哪个板块 · 内容自动带入；好的点右上角收藏" />
                </div>
              )}
            </li>
          ))}
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
    </>
  );
}
