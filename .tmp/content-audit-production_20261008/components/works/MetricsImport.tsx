"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, X } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { listWorksPage, saveWorkMetrics, type Work } from "@/lib/works";
import { metricsLine } from "@/lib/performance";
import { matchRowsToWorks, parseMetricsTable, type MatchResult } from "@/lib/metrics-import";

/**
 * 批量导入发布数据（2026-10-04），解析和匹配见 lib/metrics-import.ts。
 * 只往「已发布」的作品上挂；对不上、对到多条的列出来，不乱挂。保存时和作品原有的数据合并（导入的列覆盖同名项）。
 */
export function MetricsImport({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preview = async () => {
    setError(""); setMatches(null);
    const parsed = parseMetricsTable(text);
    if (parsed.error) return setError(parsed.error);
    if (!parsed.rows.length) return setError("没认出任何数据：检查表头里有没有播放、点赞这些列");
    setBusy(true);
    try {
      // 已发布的作品全部取回来对标题（一页 50 条，最多取 20 页）
      const all: Work[] = [];
      for (let page = 0; page < 20; page++) {
        const list = await listWorksPage({ group: "published", offset: page * 50, limit: 50 });
        all.push(...list);
        if (list.length < 50) break;
      }
      setWorks(all);
      if (!all.length) return setError("还没有标记为「已发布」的作品：先在作品卡片上把落地状态改成已发布");
      setMatches(matchRowsToWorks(parsed.rows, all));
      const unknown = parsed.columns.filter((c) => !c.key).map((c) => c.name).filter(Boolean);
      if (unknown.length) notify(`这些列没认出来，已跳过：${unknown.slice(0, 6).join("、")}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!matches) return;
    const ok = matches.filter((m) => m.workId);
    setBusy(true);
    let saved = 0;
    const failed: string[] = [];
    for (const m of ok) {
      const old = works.find((w) => w.id === m.workId)?.metrics ?? {};
      try { await saveWorkMetrics(m.workId!, { ...old, ...m.row.metrics, updatedAt: new Date().toISOString() }); saved++; }
      catch { failed.push(m.row.title); }
    }
    setBusy(false);
    notify(failed.length ? `存上 ${saved} 条，${failed.length} 条没存上（${failed.slice(0, 3).join("、")}），可以再点一次保存` : `已导入 ${saved} 条作品的数据`, failed.length ? "error" : undefined);
    if (saved) onSaved();
    if (!failed.length) { setOpen(false); setText(""); setMatches(null); }
    else setMatches(matches.filter((m) => !m.workId || failed.includes(m.row.title)));
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-4 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <FileSpreadsheet className="h-4 w-4" />从平台后台批量导入数据
      </button>
    );
  }
  const matched = matches?.filter((m) => m.workId).length ?? 0;
  return (
    <div className="glass-panel mb-4 rounded-2xl border border-primary/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium text-foreground">批量导入发布数据</h2>
        <button type="button" aria-label="关闭" onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <p className="mb-2 text-[12px] leading-relaxed text-muted-foreground">在抖音、视频号、小红书后台把作品数据表格选中复制（带表头），粘到下面。按标题对到「已发布」的作品，先预览再保存。</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setMatches(null); }} rows={6} aria-label="粘贴数据表"
        placeholder={"标题\t播放量\t完播率\t点赞\n一元火锅怎么给料\t1.2万\t32%\t860"}
        className="w-full resize-y rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-primary" />
      {error && <p role="alert" className="mt-2 text-[12.5px] text-destructive">{error}</p>}
      {matches && (
        <ul className="mt-3 space-y-1.5 text-[12.5px]">
          {matches.map((m) => (
            <li key={m.row.line} className={`rounded-lg px-3 py-2 ${m.workId ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
              <span className="block break-words text-foreground">第 {m.row.line} 行「{m.row.title}」{m.workId ? <> → {m.workTitle}</> : <span className="text-amber-600 dark:text-amber-400"> · {m.reason}</span>}</span>
              <span className="block text-muted-foreground">{metricsLine(m.row.metrics)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={preview} disabled={busy || !text.trim()} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50">
          {busy && !matches && <Loader2 className="h-3.5 w-3.5 animate-spin" />}预览
        </button>
        <button type="button" onClick={save} disabled={busy || !matched} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy && matches && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存对上的 {matched} 条
        </button>
      </div>
    </div>
  );
}
