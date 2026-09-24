"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Library, Search, ChevronDown, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { collectTopics, topicKey } from "@/lib/topic-library";
import { nextStage, workStageUrl } from "@/lib/resume";
import type { Work } from "@/lib/works";
import { TOPIC_ACTIONS, type TopicStage } from "./TopicList";

/**
 * 选题库：出过的每一条选题都在这里，隔多久都能挑出来接着做。
 *
 * 【原来】选题一批一整段地存，历史里看到的是"某天那一批"。想找两周前出过的
 * 某一条，得一批批点开翻；而且只能看，送不出去。
 *
 * 【现在】所有批次拆成一条一条，同一条在几批里都出现过的只留一份，
 * 可搜索、可筛选、可展开看当时的完整方案（内容方向、钩子、拍法），
 * 每条都能单独送去写脚本 / 设计开篇 / 起标题，也能单独删掉。
 * 删掉的会被记住：生成新选题时照样算"出过"，AI 不会再推回来。
 */

type Filter = "all" | "fresh" | "doing";

const PAGE = 15;

const fmt = (s: string) => new Date(s).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

export function TopicLibrary({
  batches,
  works,
  onAction,
  onDelete,
}: {
  batches: { id: string; result: string; created_at: string }[];
  works: Work[];
  onAction: (title: string, stage: TopicStage, body: string) => Promise<void>;
  onDelete: (title: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // 批次按新到旧，同一条只留最新那次
  const topics = useMemo(
    () => collectTopics([...batches].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))),
    [batches]
  );
  // 按指纹对作品：标点、空格不同也认得出是同一条
  const workByKey = useMemo(
    () => new Map(works.filter((w) => !w.is_done).map((w) => [topicKey(w.title), w])),
    [works]
  );

  const filtered = topics.filter((t) => {
    const k = topicKey(t.title);
    if (filter === "fresh" && workByKey.has(k)) return false;
    if (filter === "doing" && !workByKey.has(k)) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return t.title.toLowerCase().includes(needle) || t.body.toLowerCase().includes(needle);
  });

  if (topics.length === 0) return null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-panel mt-4 rounded-2xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
          <Library className="h-4 w-4 text-primary" />
          选题库
          <span className="text-[12px] font-normal text-muted-foreground">共 {topics.length} 条</span>
        </h3>
        <span className="text-[11.5px] text-muted-foreground">
          出过的每一条都在这里；删掉的会被记住，不会再推荐给你
        </span>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="搜选题或内容，比如：夜市、拒单、装修"
            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex gap-1">
          {(
            [
              ["all", "全部"],
              ["fresh", "没做过"],
              ["doing", "在做的"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                setShown(PAGE);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] ${
                filter === id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-muted-foreground">没有符合条件的选题</p>
      ) : (
        <ol className="divide-y divide-border/50">
          {filtered.slice(0, shown).map((t) => {
            const k = topicKey(t.title);
            const work = workByKey.get(k);
            const next = work ? nextStage(work.stages) : null;
            const expanded = open === k;
            return (
              <li key={k} className="py-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : k)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                    title="展开看当时的完整方案"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 self-center text-muted-foreground transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                    <span className="min-w-0 text-[13px] leading-snug text-foreground">{t.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmt(t.createdAt)}</span>
                  </button>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-5 sm:pl-0">
                    {work && (
                      <Link
                        href={workStageUrl(work.id, next ?? "标题封面")}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/15"
                      >
                        已在做{next ? ` · 下一步${next}` : ""}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {TOPIC_ACTIONS.map((a) => {
                      const key = `${k}|${a.stage}`;
                      return (
                        <button
                          key={a.stage}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(key, () => onAction(t.title, a.stage, t.body))}
                          className="glass-panel inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                        >
                          {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <a.icon className="h-3 w-3" />}
                          {a.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => run(`${k}|del`, () => onDelete(t.title))}
                      aria-label={`删除选题：${t.title}`}
                      title="删掉这条（会被记住，不会再推荐）"
                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {busy === `${k}|del` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="prose prose-slate dark:prose-invert mt-2 max-w-none rounded-xl bg-foreground/[0.03] px-4 py-3 prose-p:text-[13px] prose-li:text-[13px] prose-strong:text-foreground">
                    {/* AI 常把"标题：……""拍法：……"写成相邻两行，Markdown 会并成一段，按原样换行 */}
                    <Markdown>{t.body ? t.body.replace(/([^\n])\n(?!\n)/g, "$1  \n") : "（这条没有详细方案）"}</Markdown>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 w-full rounded-lg py-1.5 text-[12px] text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
        >
          再显示 {Math.min(PAGE, filtered.length - shown)} 条（还有 {filtered.length - shown} 条）
        </button>
      )}
    </section>
  );
}
