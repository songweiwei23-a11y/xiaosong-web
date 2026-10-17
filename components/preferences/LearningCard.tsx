"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { basisText, type PreferenceItem } from "@/lib/preferences";
import { fetchPreferences } from "@/lib/preferences-client";

/**
 * 工作台首页：「开物验证过的写法」＋「下一条怎么写」（二期 B/C 阶段）。
 * 只用他自己录下的完播数据验证过的写法；没有验证过的就不出现，不拿编的数字充门面。
 */
export function LearningCard() {
  const { context, loading } = useCreatorContext();
  const id = context.profile?.id ?? null;
  const [items, setItems] = useState<PreferenceItem[]>([]);

  useEffect(() => {
    if (loading || !id) return;
    let off = false;
    void fetchPreferences(id).then((v) => {
      if (off) return;
      setItems(v?.ready && v.enabled ? v.items.filter((i) => i.origin === "data" && i.status === "active") : []);
    });
    return () => { off = true; };
  }, [id, loading]);

  if (!id || !items.length) return null;
  const top = [...items].sort((a, b) => b.count - a.count).slice(0, 2);
  return (
    <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
      <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        开物验证过的写法（用你自己录下的完播数据）
      </p>
      <ul className="mt-2 space-y-1.5 text-[12.5px] text-muted-foreground">
        {top.map((i) => (
          <li key={i.id}>
            <span className="text-foreground">{i.text}</span>
            <span className="ml-2 text-[11.5px]">{basisText(i)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <span className="text-foreground">下一条选题，就照「{top[0].text}」来写。</span>
        <Link href="/dashboard/topic" className="text-primary hover:underline">去选题 →</Link>
      </div>
    </div>
  );
}
