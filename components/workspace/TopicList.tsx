"use client";

import Link from "next/link";
import { FileText, Sparkles, Type, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DupHit } from "@/lib/topic-dup";
import type { Work } from "@/lib/works";
import { nextStage, workStageUrl } from "@/lib/resume";
import { topicKey } from "@/lib/topic-library";

/**
 * 选题清单：一批选题里的每一条，都能单独送去下一个板块。
 *
 * 【原来的样子】结果区下面只有两个按钮——「写成脚本」「设计开篇」，
 * 点了是把**整批**十几条一股脑带过去，到那边再挑一次。想给第 7 条起个标题？
 * 没有入口。从历史里打开一批两周前的选题？也只能看，送不出去。
 *
 * 【现在】每条选题一行，三个出口。点了就给这一条建作品（同题已有进行中的
 * 作品就直接复用），带着作品编号跳过去——之后隔多久都能从「我的作品」接着做。
 * 已经在做的那条标出来，给"接着做"的入口，不会被当成新的再开一遍。
 */

export type TopicStage = "脚本生成" | "开篇钩子" | "标题封面";

/** 选题清单和选题库共用这三个出口 */
export const TOPIC_ACTIONS: { stage: TopicStage; label: string; icon: typeof FileText }[] = [
  { stage: "脚本生成", label: "写脚本", icon: FileText },
  { stage: "开篇钩子", label: "设计开篇", icon: Sparkles },
  { stage: "标题封面", label: "起标题", icon: Type },
];

/** 同一批标题只查一次（切页面、从历史打开同一批不再花一次调用） */
const dupCache = new Map<string, DupHit[]>();

export function TopicList({
  topics,
  works,
  onAction,
  dupCheck = null,
}: {
  topics: string[];
  /** 用来标出"已经在做"的那几条。按标题对，与服务端复用作品的规则一致 */
  works: Work[];
  onAction: (topic: string, stage: TopicStage) => Promise<void>;
  /** 要查重时传档案编号（lib/topic-dup）：和这个号已拍、已发的比，像的那条下面标一行，换不换编导定 */
  dupCheck?: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dups, setDups] = useState<DupHit[]>([]);
  const dupKey = dupCheck && topics.length ? `${dupCheck}|${topics.join('\n')}` : "";

  useEffect(() => {
    if (!dupKey || !dupCheck) { setDups([]); return; }
    const cached = dupCache.get(dupKey);
    if (cached) { setDups(cached); return; }
    let off = false;
    setDups([]);
    fetch("/api/topic-dup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: dupCheck, titles: topics }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const hits = Array.isArray(d?.hits) ? (d.hits as DupHit[]) : [];
        if (!d?.skipped) dupCache.set(dupKey, hits);
        if (!off) setDups(hits);
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, [dupKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (topics.length === 0) return null;
  const dupOf = new Map(dups.map((d) => [d.title, d]));

  // 按指纹对：这次撞车的就是标点半角全角不同，按原文对会漏
  const byTitle = new Map(works.filter((w) => !w.is_done).map((w) => [topicKey(w.title), w]));

  return (
    <section className="glass-panel mt-4 rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-foreground">挑一条接着做</h3>
        <span className="text-[11.5px] text-muted-foreground">
          共 {topics.length} 条 · 做过的会存进「创作进度」，隔多久都能接着做
        </span>
      </div>

      <ol className="divide-y divide-border/50">
        {topics.map((t, i) => {
          const work = byTitle.get(topicKey(t));
          const next = work ? nextStage(work.stages) : null;
          return (
            <li key={`${i}-${t}`} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 text-[13px] leading-snug text-foreground">
                  {t}
                  {dupOf.get(t) && (
                    <span className="mt-0.5 block text-[11.5px] text-amber-500">
                      和{dupOf.get(t)!.status}的《{dupOf.get(t)!.like}》很像{dupOf.get(t)!.why ? `：${dupOf.get(t)!.why}` : ""}（换不换你定）
                    </span>
                  )}
                </span>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-7 sm:pl-0">
                {work && (
                  <Link
                    href={workStageUrl(work.id, next ?? "标题封面")}
                    title="这条已经在做了，接着上次的进度"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/15"
                  >
                    已在做{next ? ` · 下一步${next}` : ""}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {TOPIC_ACTIONS.map((a) => {
                  const key = `${t}|${a.stage}`;
                  return (
                    <button
                      key={a.stage}
                      type="button"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(key);
                        try {
                          await onAction(t, a.stage);
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className="glass-panel inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                    >
                      {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <a.icon className="h-3 w-3" />}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
