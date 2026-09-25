"use client";

import { useNow } from "@/hooks/useNow";
import { dateLine, dayProgress, festivalOf, pad2, periodOf } from "@/lib/clock";

/**
 * 首页时钟（用户从四版里选的「极简大字」）：
 * 细体大数字，冒号跟着秒轻轻呼吸，秒数用主题色小字；
 * 下面日期 + 星期 + 农历，逢节日带个小标签；最底下一条"今天过了多少"。
 */

function remainText(d: Date) {
  const left = Math.max(0, 24 * 60 - (d.getHours() * 60 + d.getMinutes()));
  const h = Math.floor(left / 60);
  const m = left % 60;
  return h > 0 ? `还剩 ${h} 小时 ${m} 分` : `还剩 ${m} 分`;
}

export function Clock() {
  const now = useNow();

  // 挂载前占位，高度和真钟一样，不会跳
  if (!now) return <div className="h-[150px] animate-pulse rounded-xl bg-foreground/[0.04]" />;

  const festival = festivalOf(now);
  const progress = dayProgress(now);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">{periodOf(now)}</span>
        {festival && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{festival}</span>
        )}
      </div>
      <div className="mt-1 flex items-end gap-2" aria-label={`现在 ${pad2(now.getHours())}:${pad2(now.getMinutes())}`}>
        <span className="text-[56px] font-extralight leading-none tracking-[-0.04em] text-foreground tabular-nums">
          {pad2(now.getHours())}
          {/* 冒号跟着秒呼吸，不是硬闪 */}
          <span
            className="mx-0.5 inline-block transition-opacity duration-700"
            style={{ opacity: now.getSeconds() % 2 ? 0.25 : 0.9 }}
          >
            :
          </span>
          {pad2(now.getMinutes())}
        </span>
        <span className="mb-1.5 text-[18px] font-light tabular-nums text-primary">{pad2(now.getSeconds())}</span>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{dateLine(now)}</p>
      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className="h-full rounded-full bg-primary/70 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground/80">
          <span>今天已过 {Math.floor(progress * 100)}%</span>
          <span>{remainText(now)}</span>
        </div>
      </div>
    </div>
  );
}
