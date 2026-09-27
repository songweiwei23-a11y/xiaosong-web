"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, PartyPopper, X } from "lucide-react";
import type { Lesson } from "@/lib/newbie-course";

/** 卡片底色：深色竖屏，像刷抖音；几种轮着用，一张一张翻的时候看得出换了一张 */
const CARD_BG = [
  "linear-gradient(160deg,#0f172a,#1e3a8a)",
  "linear-gradient(160deg,#1e1b4b,#4c1d95)",
  "linear-gradient(160deg,#042f2e,#0e7490)",
];

type Phase = "cards" | "quiz";

/**
 * 一关：先"刷"几张要点卡（上滑下一张，像刷抖音），再答一道题，答对过关。
 * 手机上从底部升起、电脑上居中；Esc 关闭，↓ / 空格翻下一张。
 */
export function LevelSheet({
  lesson,
  hasNext,
  onClose,
  onPassed,
  onNext,
}: {
  lesson: Lesson;
  hasNext: boolean;
  onClose: () => void;
  onPassed: () => void;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("cards");
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cards = [{ head: lesson.title, body: lesson.hook, intro: true }, ...lesson.points.map((p) => ({ ...p, intro: false }))];
  const last = cards.length - 1;

  const go = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (phase === "cards" && (e.key === "ArrowDown" || e.key === " ")) {
        e.preventDefault();
        go(Math.min(last, idx + 1));
      }
      if (phase === "cards" && e.key === "ArrowUp") go(Math.max(0, idx - 1));
    };
    window.addEventListener("keydown", onKey);
    // 后面的页面别跟着滚
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [phase, idx, last, onClose]);

  const right = pick === lesson.quiz.answer;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`第 ${lesson.no} 关：${lesson.title}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#0b1020] text-white shadow-2xl sm:h-[640px] sm:max-w-[400px] sm:rounded-[32px]"
      >
        <button onClick={onClose} aria-label="关闭" className="absolute right-3 top-3 z-20 rounded-full bg-black/30 p-2 text-white/80 hover:bg-black/50">
          <X className="h-4 w-4" />
        </button>

        {phase === "cards" && (
          <>
            {/* 顶上的分段进度条，像抖音的图文 */}
            <div className="absolute inset-x-4 top-4 z-10 mr-10 flex gap-1">
              {cards.map((_, i) => (
                <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= idx ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
            <div
              ref={scroller}
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
              onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollTop / Math.max(1, e.currentTarget.clientHeight)))}
            >
              {cards.map((c, i) => (
                <div key={i} className="relative flex h-full snap-start flex-col justify-center px-7" style={{ background: CARD_BG[i % CARD_BG.length] }}>
                  {c.intro ? (
                    <>
                      <div className="text-[13px] text-white/70">第 {lesson.no} 关 · 约 {lesson.minutes} 分钟</div>
                      <div className="mt-2 text-[26px] font-bold leading-snug">{c.head}</div>
                      <div className="mt-3 text-[15px] leading-relaxed text-white/80">{c.body}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[12px] text-white/60">{i} / {last}</div>
                      <div className="mt-2 text-[26px] font-bold leading-snug">{c.head}</div>
                      <div className="mt-4 text-[16px] leading-relaxed text-white/85">{c.body}</div>
                    </>
                  )}

                  {i < last ? (
                    <button onClick={() => go(i + 1)} className="absolute bottom-7 left-0 right-0 mx-auto flex w-fit animate-bounce items-center gap-1 text-[12.5px] text-white/70">
                      上滑继续 <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setPhase("quiz")}
                      className="absolute bottom-7 left-7 right-7 flex items-center justify-center gap-1.5 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black"
                    >
                      读完了，答一题过关 <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {phase === "quiz" && (
          <div className="flex h-full flex-col overflow-y-auto px-6 pb-6 pt-12" style={{ background: CARD_BG[1] }}>
            <div className="text-[12px] text-white/60">第 {lesson.no} 关 · 答一题</div>
            <div className="mt-2 text-[20px] font-bold leading-snug">{lesson.quiz.q}</div>
            <div className="mt-5 space-y-2.5">
              {lesson.quiz.options.map((o, i) => (
                <button
                  key={o}
                  onClick={() => {
                    setPick(i);
                    if (i === lesson.quiz.answer) onPassed();
                  }}
                  disabled={right}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] transition-colors ${
                    pick === i
                      ? i === lesson.quiz.answer
                        ? "border-emerald-400 bg-emerald-400/20"
                        : "border-rose-400 bg-rose-400/15"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {pick !== null && !right && <p className="mt-3 text-[13.5px] text-rose-200">再想想～ 可以回去再看一遍要点。</p>}
            {pick !== null && !right && (
              <button onClick={() => { setPick(null); setPhase("cards"); setIdx(0); }} className="mt-2 w-fit text-[13px] text-white/70 underline underline-offset-4">
                回去看要点
              </button>
            )}
            {right && (
              <div className="mt-4 rounded-2xl bg-emerald-400/15 p-4">
                <div className="flex items-center gap-2 text-[16px] font-semibold">
                  <PartyPopper className="h-5 w-5 text-amber-300" />
                  答对了，第 {lesson.no} 关通过！
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/85">{lesson.quiz.why}</p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link href={lesson.action.href} className="flex items-center justify-center gap-1.5 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black">
                    {lesson.action.label} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button onClick={hasNext ? onNext : onClose} className="rounded-2xl border border-white/30 py-3 text-[14px] text-white">
                    {hasNext ? "继续下一关" : "回到地图"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
