"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type TouchEvent, type WheelEvent } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { listWorks, deleteWork, type Work } from "@/lib/works";
import { onActiveProfileChange } from "@/lib/active-profile";
import { nextStage, workStageUrl } from "@/lib/resume";
import { confirmDialog, notify } from "@/components/ui/feedback";

/** 滚轮累计够这么多才切一条；切过之后一小段时间不再切，触摸板的惯性滚动不会一下翻过好几条 */
const WHEEL_STEP = 48;
const WHEEL_COOLDOWN_MS = 300;
const SWIPE_MIN = 28;

/**
 * 顶栏里的「进行中」：一次只露一条，滚轮或上下滑动切换。
 *
 * 原来挂在侧边栏、一次列三条，侧边栏一收起来就看不见。放进顶栏，任何板块都能接着做。
 * 电脑上是顶栏中间的一个胶囊；手机上顶栏放不下，它单独占一行。
 */
export function InProgressStrip({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [works, setWorks] = useState<Work[] | null>(null);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [profileTick, setProfileTick] = useState(0);
  const wheelAcc = useRef(0);
  const wheelLockUntil = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // 只列当前档案的（lib/works 按档案取）；切了档案立刻换成那个档案的
  useEffect(() => onActiveProfileChange(() => setProfileTick((n) => n + 1)), []);
  // 路由变化时重新取一次——刚生成完的内容应当立刻反映在这里
  useEffect(() => {
    let cancelled = false;
    listWorks(12).then((list) => {
      if (cancelled) return;
      // 已经标了拍摄/发布的不算进行中（落地状态，2026-10-02）
      setWorks(list.filter((w) => !w.is_done && (w.shoot_status ?? "none") === "none"));
    });
    return () => { cancelled = true; };
  }, [pathname, profileTick]);

  const count = works?.length ?? 0;
  const i = count ? Math.min(index, count - 1) : 0;
  const w = works?.[i];

  const step = (d: 1 | -1) => {
    if (count < 2) return;
    setDir(d);
    setIndex((n) => (Math.min(n, count - 1) + d + count) % count);
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (count < 2) return;
    const now = Date.now();
    if (now < wheelLockUntil.current) {
      wheelAcc.current = 0;
      return;
    }
    wheelAcc.current += e.deltaY;
    if (Math.abs(wheelAcc.current) < WHEEL_STEP) return;
    step(wheelAcc.current > 0 ? 1 : -1);
    wheelAcc.current = 0;
    wheelLockUntil.current = now + WHEEL_COOLDOWN_MS;
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const s = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dy) < SWIPE_MIN || Math.abs(dy) < Math.abs(dx)) return;
    step(dy < 0 ? 1 : -1);
  };

  const removeWork = async (target: Work) => {
    const ok = await confirmDialog(
      `从「进行中」删掉「${target.title}」？\n已经写好的脚本、分镜这些内容不会删，仍然在各板块的历史记录里。`,
      { tone: "danger", confirmText: "删除", title: "删除作品" }
    );
    if (!ok) return;
    if (await deleteWork(target.id)) {
      setWorks((prev) => prev?.filter((x) => x.id !== target.id) ?? null);
      notify("已删除");
    } else {
      notify("删除失败，请重试");
    }
  };

  const root = `min-w-0 ${className}`;

  if (works === null) {
    return (
      <div className={root}>
        <div className="h-9 w-full animate-pulse rounded-xl bg-foreground/[0.05] md:h-11 md:max-w-[640px] md:rounded-2xl" />
      </div>
    );
  }
  if (!w) return null;

  const next = nextStage(w.stages);
  const href = workStageUrl(w.id, next ?? "标题封面");
  const slideDir = { "--strip-dir": dir } as CSSProperties;

  return (
    <div
      className={root}
      role="group"
      aria-label="进行中的作品"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex h-9 w-full touch-pan-x items-center gap-2 rounded-xl bg-foreground/[0.05] pl-2.5 pr-1 md:h-11 md:max-w-[640px] md:gap-3 md:rounded-2xl md:pl-3.5 md:pr-1.5">
        <div className="hidden shrink-0 flex-col leading-none md:flex">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground/80">进行中</span>
          <span className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {i + 1} / {count}
          </span>
        </div>
        <span className="hidden h-6 w-px shrink-0 bg-foreground/10 md:block" />

        <Link href={href} className="min-w-0 flex-1 py-1">
          <div key={w.id} style={slideDir} className="motion-safe:animate-[workStripIn_.32s_ease-out]">
            <p className="truncate text-[12.5px] font-medium text-foreground md:text-[13px]">{w.title}</p>
            <div className="mt-px flex items-center gap-2 md:mt-1">
              <span className="shrink-0 tabular-nums text-[10.5px] text-muted-foreground md:hidden">
                {i + 1}/{count}
              </span>
              {/* 做完的填实、没做的空心，一眼看出卡在第几步 */}
              <span className="hidden shrink-0 items-center gap-1 md:flex">
                {w.stages.map((s) => (
                  <span
                    key={s.name}
                    title={`${s.name}${s.done ? "（已做）" : ""}`}
                    className={`h-1.5 w-1.5 rounded-full ${s.done ? "bg-primary" : "bg-foreground/15"}`}
                  />
                ))}
              </span>
              <span className="truncate text-[10.5px] text-muted-foreground md:text-[11px]">
                {next ? `下一步：${next}` : "都做完了"}
              </span>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={count < 2}
            aria-label="上一个进行中的作品"
            title="上一个（滚轮向上也行）"
            className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40 md:flex md:items-center"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={count < 2}
            aria-label="下一个进行中的作品"
            title="下一个（滚轮向下也行）"
            className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40 md:flex md:items-center"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => removeWork(w)}
            aria-label={`删除作品：${w.title}`}
            title="删除这条作品（内容不会删）"
            className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
