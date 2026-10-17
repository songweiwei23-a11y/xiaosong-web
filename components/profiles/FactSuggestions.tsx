"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { postSafely } from "@/lib/safe-post";
import type { FactSuggestion } from "@/lib/fact-memory";

/**
 * 档案编辑页：「开物发现：你最近几次生成都用了某个拍摄条件，档案里还没有 / 写的不一样」。
 * 只提示，用户点了才写进档案；点「忽略」就不再提示这一条。
 */
export function FactSuggestions({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<FactSuggestion[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    fetch(`/api/fact-suggestions?profileId=${encodeURIComponent(profileId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { suggestions?: FactSuggestion[] } | null) => { if (!off && d?.suggestions) setItems(d.suggestions); })
      .catch(() => {});
    return () => { off = true; };
  }, [profileId]);

  const act = async (s: FactSuggestion, action: "accept" | "dismiss") => {
    setBusy(s.key);
    setError("");
    try {
      const res = await postSafely("/api/fact-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action, field: s.field, value: s.value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "没成功，请重试");
      // 写进了档案：刷新一下，表单里就是新值
      if (action === "accept") { window.location.reload(); return; }
      setItems((xs) => xs.filter((x) => x.key !== s.key));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!items.length) return null;
  return (
    <section className="glass-panel mb-4 rounded-2xl p-4">
      {items.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
            开物发现：你最近 {s.n} 次生成（共 {s.of} 次里）都用了「{s.value}」（{s.label}），档案里{s.current ? `写的是「${s.current}」` : "还没写"}。
            {s.kind === "multi" ? `要加进${s.label}吗？` : `要改成这个吗？`}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={!!busy} onClick={() => act(s, "accept")} className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] text-primary-foreground disabled:opacity-50">
              {busy === s.key ? "写入中…" : "更新档案"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => act(s, "dismiss")} className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground disabled:opacity-50">
              忽略
            </button>
          </div>
        </div>
      ))}
      {error && <p className="mt-1 text-[12px] text-destructive">{error}</p>}
    </section>
  );
}
