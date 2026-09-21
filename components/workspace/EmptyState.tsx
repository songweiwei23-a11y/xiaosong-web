"use client";

import type { LucideIcon } from "lucide-react";

/**
 * 结果区的空状态。
 *
 * 改版前几个页面把空状态做成了一块 140px 见方的实心彩色图标
 * （成交理由是橙、分镜是绿），在一片留白里格外扎眼，而空状态本身
 * 只是"还没开始"的提示，不该抢走注意力。
 *
 * 现在统一成：小尺寸图标 + 极淡的底色 + 两行文字。图标用线性图标而非
 * emoji——emoji 在不同系统里字形差异很大，并且自带饱和色，无法跟随主题。
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  tips,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** 可选的使用提示，最多三两条，多了就不是空状态而是说明书了 */
  tips?: string[];
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>

        <p className="mt-5 text-[15px] font-medium text-foreground">{title}</p>
        {hint && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>
        )}

        {tips && tips.length > 0 && (
          <ul className="mt-5 space-y-1.5 rounded-xl bg-foreground/[0.04] px-4 py-3 text-left">
            {tips.map((t) => (
              <li key={t} className="text-[12px] leading-relaxed text-muted-foreground">
                · {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
