"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useGuide } from "@/hooks/useGuide";

/**
 * 顶栏的引导小条：一行说清「现在是什么阶段」，点开看可以怎么选。
 * 点它只是展开选项，不会跳转；每一项都要用户自己点。换了页面自动收起。
 * 数据没取到时不显示，不占位。
 */
export function GuideChip({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { guide } = useGuide();
  // 记下是在哪个页面展开的：换了页面，路径对不上，面板自然收起
  const [openPath, setOpenPath] = useState<string | null>(null);
  if (!guide) return null;

  const open = openPath === pathname;
  const { stageLabel, stageDesc, options, alert } = guide;
  // 小条上只露出「建议」那一项的文字，提示用户可以看看；不替用户选
  const hint = options.find((o) => o.recommended)?.label ?? stageDesc;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`新手引导：${stageLabel}`}
        onClick={() => setOpenPath(open ? null : pathname)}
        className="glass-panel glass-interactive flex w-full min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-left text-[12px]"
      >
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-medium text-primary">
          {stageLabel}
        </span>
        <span className="min-w-0 truncate text-foreground">{hint}</span>
        {alert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="有额度提醒" />}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-panel absolute left-0 top-full z-30 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl p-2 shadow-xl"
        >
          <p className="px-2 pb-2 pt-1 text-[12px] text-muted-foreground">{stageDesc}</p>
          <ul className="space-y-1">
            {options.map((o) => (
              <li key={o.key}>
                <Link
                  href={o.href}
                  role="menuitem"
                  onClick={() => setOpenPath(null)}
                  className="flex items-start justify-between gap-2 rounded-xl px-3 py-2 hover:bg-foreground/[0.06]"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium text-foreground">
                      {o.label}
                      {o.recommended && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">建议</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{o.why}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {alert && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-foreground/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <Link href={alert.href} onClick={() => setOpenPath(null)} className="min-w-0 hover:underline">
                {alert.text}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
