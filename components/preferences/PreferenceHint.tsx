"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { PREFERENCE_BOARDS, preferenceHint } from "@/lib/preferences";
import { fetchPreferences } from "@/lib/preferences-client";
import type { Board } from "@/lib/context-manifest";

/** 生成结果下面一行小字：「💡 已按你的偏好写：……　调整」。只在写稿类板块、有生效的偏好时出现 */
export function PreferenceHint({ board }: { board: Board }) {
  const { context } = useCreatorContext();
  const text = PREFERENCE_BOARDS.has(board) ? preferenceHint(context.preferences) : "";
  if (!text) return null;
  const id = context.profile?.id;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
      <span>💡 {text}</span>
      {id && <Link href={`/dashboard/profiles/${id}/edit#preferences`} className="text-primary hover:underline">调整</Link>}
    </p>
  );
}

/** 工作台首页：「🧠 开物最近又学到 N 条你的习惯　看看对不对」。没有新学到的就不出现 */
export function PreferenceNews() {
  const { context, loading } = useCreatorContext();
  const id = context.profile?.id ?? null;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (loading) return;
    let off = false;
    void fetchPreferences(id).then((v) => { if (!off) setCount(v?.ready && v.enabled ? v.newCount : 0); });
    return () => { off = true; };
  }, [id, loading]);
  if (!count || !id) return null;
  return (
    <Link href={`/dashboard/profiles/${id}/edit#preferences`}
      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-[13px] text-foreground transition-colors hover:border-primary/50">
      <Brain className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1">开物最近又学到 <b className="text-primary">{count}</b> 条你的习惯</span>
      <span className="shrink-0 text-primary">看看对不对 →</span>
    </Link>
  );
}
