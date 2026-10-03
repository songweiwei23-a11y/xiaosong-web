"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Wand2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CreationLinks } from "@/components/workspace/CreationLinks";
import { notify } from "@/components/ui/feedback";
import { historyOpenUrl } from "@/lib/resume";
import { CATEGORY_NEXT } from "@/lib/library";
import { OUTPUT_LIBRARIES, outputLibrary, type OutputLibrary } from "@/lib/library-outputs";

interface OutputItem { id: string; historyId: string; taskType: string; title: string; preview: string; createdAt: string; workId: string | null }

const fmt = (s: string) => new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

/**
 * 素材库「全部产出」（2026-10-02）：各板块生成过的结果，不用收藏也自动按库归好。
 * 列表只有标题和预览，全文点开再取（lib/library-outputs、app/api/library/outputs）。
 * 每条都能看全文、复制、继续创作、收藏、回到原板块接着改。
 */
export function OutputsPanel({ profileId, q, onCounts }: { profileId: string | null; q: string; onCounts?: (total: number) => void }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [lib, setLib] = useState<OutputLibrary["id"] | null>(null);
  const [items, setItems] = useState<OutputItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);
  const reqId = useRef(0);

  const base = profileId ? `profileId=${encodeURIComponent(profileId)}` : "";

  // 各库数量；默认打开第一个有内容的库
  useEffect(() => {
    setCounts(null); setItems(null); setBodies({});
    fetch(`/api/library/outputs?${base}`)
      .then((r) => r.json())
      .then((d) => {
        const c: Record<string, number> = d.counts ?? {};
        setCounts(c);
        onCounts?.(Object.values(c).reduce((a, b) => a + b, 0));
        setLib((cur) => (cur && c[cur] ? cur : OUTPUT_LIBRARIES.find((l) => c[l.id])?.id ?? null));
      })
      .catch(() => { setCounts({}); notify("产出加载失败，请刷新重试", "error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // 当前库的列表（搜索在服务端做，停手 300ms 再搜）
  useEffect(() => {
    if (!lib) { setItems([]); return; }
    const my = ++reqId.current;
    setItems(null);
    const t = setTimeout(() => {
      fetch(`/api/library/outputs?${base}&lib=${lib}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`)
        .then((r) => r.json())
        .then((d) => { if (my === reqId.current) setItems(Array.isArray(d.items) ? d.items : []); })
        .catch(() => { if (my === reqId.current) setItems([]); });
    }, q.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [lib, q, base]);

  const getBody = async (id: string): Promise<string | null> => {
    if (bodies[id] !== undefined) return bodies[id];
    setLoadingBody(id);
    try {
      const r = await fetch(`/api/library/outputs?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "读取失败");
      setBodies((b) => ({ ...b, [id]: d.body }));
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
    const b = await getBody(id);
    if (b) { navigator.clipboard?.writeText(b); notify("已复制"); }
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
                    context={{ from: `素材库·${it.taskType}`, title: it.title }} heading="去哪个板块 · 内容自动带入；好的点右上角收藏" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
