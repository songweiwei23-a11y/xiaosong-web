"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, ChevronDown, Lock, Map as MapIcon, RotateCcw, Trophy } from "lucide-react";
import { COURSE_MINUTES, COURSE_TOTAL, LESSONS, graduated, type Lesson } from "@/lib/newbie-course";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { LevelSheet } from "@/components/course/LevelSheet";
import { confirmDialog } from "@/components/ui/feedback";

/** 每关在路线上的横向位置（%），走成弯弯曲曲的一条路 */
const X = [4, 46, 12, 52, 8, 44];

/**
 * 抖音新手课：给压根不了解抖音的小白（内容见 lib/newbie-course.ts）。
 *
 * 主线是闯关地图——有"想通关"的劲头，答题也能确认他真看懂了；
 * 每一关里用刷抖音的方式读要点（LevelSheet）；
 * 旁边一个「复习目录」，过了的关随时回来翻，不用重新闯。
 */
export default function CoursePage() {
  const { passed, ready, pass, reset } = useCourseProgress();
  const [tab, setTab] = useState<"map" | "review">("map");
  const [active, setActive] = useState<Lesson | null>(null);
  const done = graduated(passed);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">抖音新手课</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {COURSE_TOTAL} 关，每关 3～4 分钟，一共约 {COURSE_MINUTES} 分钟。读要点、答一题，答对就过关。
          </p>
        </div>
        <div className="flex rounded-xl border border-border/70 p-1 text-[13px]">
          {([
            { id: "map", label: "闯关", icon: MapIcon },
            { id: "review", label: "复习目录", icon: BookOpen },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${tab === t.id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${(passed / COURSE_TOTAL) * 100}%` }} />
        </div>
        <span className="text-[13px] tabular-nums text-muted-foreground">{passed} / {COURSE_TOTAL} 关</span>
      </div>

      {done && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-9 w-9 shrink-0 text-amber-400" />
            <div>
              <div className="text-[16px] font-semibold text-foreground">新手毕业！</div>
              <div className="text-[13px] text-muted-foreground">道理都懂了，接下来动手：7 天发出 7 条</div>
            </div>
          </div>
          <Link href="/dashboard#launch-plan" className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white">
            开始 7 天起号计划 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {tab === "map" ? (
        <div className="relative mt-6 h-[620px] overflow-hidden rounded-3xl border border-border/50 bg-foreground/[0.02] sm:h-[660px]">
          {/* 路线：虚线把六关连起来 */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path
              d={X.map((x, i) => `${i === 0 ? "M" : "L"} ${x + 5} ${9 + i * 16}`).join(" ")}
              fill="none"
              stroke="hsl(var(--primary) / .35)"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {LESSONS.map((l, i) => {
            const state = !ready ? "locked" : i < passed ? "done" : i === passed ? "open" : "locked";
            return (
              <button
                key={l.id}
                type="button"
                disabled={state === "locked"}
                onClick={() => setActive(l)}
                aria-label={`第 ${l.no} 关：${l.title}${state === "locked" ? "（未解锁）" : state === "done" ? "（已通过）" : ""}`}
                className="absolute flex max-w-[54%] items-center gap-2.5 text-left disabled:cursor-not-allowed"
                style={{ left: `${X[i]}%`, top: `${4 + i * 16}%` }}
              >
                <span
                  className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 text-[15px] font-bold transition-colors ${
                    state === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : state === "open"
                        ? "border-primary bg-background text-primary shadow-[0_0_24px_hsl(var(--primary)/.55)]"
                        : "border-border bg-background text-muted-foreground/60"
                  }`}
                >
                  {state === "done" ? <Check className="h-5 w-5" /> : state === "locked" ? <Lock className="h-4 w-4" /> : l.no}
                  {state === "open" && <span className="absolute inset-0 animate-ping rounded-2xl border-2 border-primary/50" aria-hidden />}
                </span>
                <span className={`text-[12.5px] leading-snug sm:text-[13.5px] ${state === "locked" ? "text-muted-foreground/60" : "text-foreground"}`}>
                  <span className="block text-[11px] text-muted-foreground">第 {l.no} 关{state === "open" ? " · 点我开始" : ""}</span>
                  {l.title}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <ReviewList passed={passed} />
      )}

      {done && (
        <button
          type="button"
          onClick={async () => {
            if (await confirmDialog("从第 1 关重新闯一遍？复习目录里的内容随时都能看，不用重闯也行。", { confirmText: "重新闯关", title: "重新学一遍" })) reset();
          }}
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重新闯一遍
        </button>
      )}

      {active && (
        <LevelSheet
          key={active.id}
          lesson={active}
          hasNext={active.no < COURSE_TOTAL}
          onClose={() => setActive(null)}
          onPassed={() => pass(active.no)}
          onNext={() => setActive(LESSONS[active.no] ?? null)}
        />
      )}
    </div>
  );
}

/** 复习目录：过了的关随时翻，没过的锁着（先闯关，别一口气全看完就不想动手了） */
function ReviewList({ passed }: { passed: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-6 space-y-2.5">
      {LESSONS.map((l, i) => {
        const unlocked = i < passed;
        const isOpen = open === l.id && unlocked;
        return (
          <div key={l.id} className={`glass-panel overflow-hidden rounded-2xl ${isOpen ? "ring-1 ring-primary/40" : ""}`}>
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => setOpen(isOpen ? null : l.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${unlocked ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-muted-foreground"}`}>
                {unlocked ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-semibold ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                  第 {l.no} 课 · {l.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{unlocked ? l.hook : `过了第 ${l.no} 关就能在这里复习`}</span>
              </span>
              {unlocked && <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />}
            </button>
            {isOpen && (
              <div className="border-t border-border/60 px-4 pb-4 pt-3 sm:pl-[4.25rem]">
                <ul className="space-y-3">
                  {l.points.map((p) => (
                    <li key={p.head}>
                      <div className="text-[14px] font-semibold text-foreground">{p.head}</div>
                      <div className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">{p.body}</div>
                    </li>
                  ))}
                </ul>
                <Link href={l.action.href} className="brand-gradient mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white">
                  {l.action.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
