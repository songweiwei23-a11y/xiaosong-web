"use client";

import { useEffect, useState } from "react";
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { fetchPreferences } from "@/lib/preferences-client";
import { learningProgressLine, VERIFY_MIN_ACTIVE } from "@/lib/verified-writing";

/**
 * 作品页顶部的一句学习进度（整改 B2）：录了数据的作品离「开物开始验证写法」还差几条。
 * 已经过了门槛就不出现（那时首页学习卡会直接显示验证过的写法）。
 */
export function LearningProgressNote() {
  const { context, loading } = useCreatorContext();
  const id = context.profile?.id ?? null;
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !id) return;
    let off = false;
    void fetchPreferences(id).then((v) => {
      if (off) return;
      const p = v?.ready && v.enabled ? v.progress : undefined;
      setLine(p && p.usable < (p.active ?? VERIFY_MIN_ACTIVE) ? learningProgressLine(p.usable, p.active) : null);
    });
    return () => { off = true; };
  }, [id, loading]);

  if (!line) return null;
  return <p className="mb-4 text-[12.5px] text-muted-foreground">{line}</p>;
}
