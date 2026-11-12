"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { PlanSection } from "@/lib/plan-builder";

/**
 * 出方案 · 确认大纲（2026-10-04）：AI 出的大纲在这里改——章节名、要点（一行一条）、调顺序、删、加；
 * 标题和补充要求也能改。点确认才写全文。逻辑见 lib/plan-builder。
 */
export function PlanOutlineEditor({ initialTitle, initialSections, disabled, onConfirm, hasDoubts = false }: {
  initialTitle: string;
  initialSections: PlanSection[];
  disabled: boolean;
  /** 大纲开头标了「⚠️ 需要你确认」：提醒在下面写明怎么处理 */
  hasDoubts?: boolean;
  onConfirm: (p: { title: string; sections: PlanSection[]; note: string }) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [rows, setRows] = useState(() => initialSections.map((s) => ({ title: s.title, points: s.points.join("\n") })));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const move = (i: number, d: -1 | 1) => setRows((r) => {
    const j = i + d;
    if (j < 0 || j >= r.length) return r;
    const next = [...r];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const confirm = () => {
    const sections = rows.map((r) => ({ title: r.title.trim(), points: r.points.split("\n").map((p) => p.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean) })).filter((s) => s.title);
    if (sections.length < 2) return setError("至少留两章");
    setError("");
    onConfirm({ title: title.trim(), sections, note: note.trim() });
  };

  const field = "w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";
  if (!initialSections.length) {
    return <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">没认出大纲里的章节。点上面的「重新生成」再出一次大纲。</p>;
  }
  return (
    <div className="mt-3 rounded-xl border border-primary/40 bg-card p-3 text-left sm:p-4">
      <p className="text-sm font-medium text-foreground">确认大纲</p>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">章节名、要点都能直接改，可以调顺序、删章、加章。改好了点下面确认，再写完整方案。</p>
      {hasDoubts && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          大纲开头有「⚠️ 需要你确认」的地方：在最下面「还有什么要求」里写明怎么处理（比如「附件 2 是抖音的，文件名写错了」），写全文时按你说的来；不写就按它暂定的处理。
        </p>
      )}
      <label className="mb-3 block"><span className="mb-1 block text-xs text-muted-foreground">方案标题</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={field} /></label>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">第{i + 1}章</span>
              <input value={r.title} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))} maxLength={80} aria-label={`第${i + 1}章章节名`} className={field} />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上移" className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="下移" className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} aria-label="删除这一章" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <textarea value={r.points} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, points: e.target.value } : y)))} rows={Math.min(5, Math.max(2, r.points.split("\n").length))} placeholder="这一章要写的要点，一行一条" aria-label={`第${i + 1}章要点`} className={`${field} mt-1.5 resize-y text-xs`} />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setRows((x) => [...x, { title: "", points: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" />加一章</button>
      <label className="mt-3 block"><span className="mb-1 block text-xs text-muted-foreground">还有什么要求（可不填）</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={800} placeholder="比如：预算控制在 2 万以内；第 3 章写细一点；语气给员工看的" className={`${field} resize-y text-xs`} /></label>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={confirm} disabled={disabled} className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-50">确认大纲，写完整方案</button>
      </div>
    </div>
  );
}
