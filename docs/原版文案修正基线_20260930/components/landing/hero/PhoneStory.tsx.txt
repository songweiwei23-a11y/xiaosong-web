"use client";

import { useEffect, useRef } from "react";
import { Check, Heart, MessageCircle, Play, Share2, Soup, Sparkles } from "lucide-react";
import { easeInOut, easeOut, seg, useFitScale, useLoopClock } from "./loop";

/**
 * 首页动画·「一镜到底的手机」：一句话，是怎么变成一条爆款的。
 *
 * 一台悬浮的手机。左边打出一句"我在县城开了家面馆"，这句话化成光粒飞进手机，
 * 手机里一步步排出选题、开篇、脚本、分镜，然后整块屏幕变成一条正在播放的视频，
 * 爱心往上飘，身后一条增长曲线画到百万。最后落一句"说一句你是做什么的，剩下的交给开物"。
 *
 * 一镜到底：所有东西都是同一个 t 算出来的位置和透明度，
 * 场景之间是变形、溶解，不是翻页。按 560×440 的设计尺寸画，外面等比缩放。
 */

const LOOP = 14;
const W = 560;
const H = 440;
// 用餐饮店：拍短视频引客的需求里它最多，小白一看就能代入（产品方定）
const PROMPT = "我在县城开了家面馆，想拍短视频";
const STEPS = ["选题：一碗汤熬 8 小时", "开篇：反常识钩子", "脚本：60 秒口播", "分镜：6 个镜头"];
const HEARTS = Array.from({ length: 12 }, (_, i) => ({ at: 7.6 + i * 0.32, sway: ((i * 37) % 11) - 5, size: 12 + ((i * 7) % 8) }));
// 光粒：从那句话飞进手机屏幕
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  sx: 36 + (i % 15) * 11,
  sy: 118 + Math.floor(i / 15) * 16,
  ex: 312 + ((i * 53) % 150),
  ey: 150 + ((i * 97) % 200),
  d: i * 0.018,
}));

/**
 * freezeAt：定格在第几秒，逐帧检查画面用；首页不传。
 * 要放在有确定宽度的容器里（首页是网格的一栏）：舞台故意不撑宽度，
 * 放进"按内容收缩"的容器（flex 居中之类）会缩成 0。
 */
export function PhoneStory({ freezeAt }: { freezeAt?: number } = {}) {
  const { ref, t } = useLoopClock(LOOP, 10.8, freezeAt);
  const { box, scale } = useFitScale(W);

  const out = 1 - seg(t, 13.1, 13.9); // 一轮结束整体淡出，接回开头
  const typed = Math.floor(PROMPT.length * seg(t, 0.5, 2.3));
  const promptOn = seg(t, 0.2, 0.5) * (1 - seg(t, 2.8, 3.3));
  const build = seg(t, 3.2, 3.6) * (1 - seg(t, 6.5, 7.1));
  const video = seg(t, 6.6, 7.2) * out;
  const grow = easeInOut(seg(t, 7.2, 11));
  const views = Math.round(37 * Math.pow(1_000_000 / 37, grow));
  const headline = seg(t, 10.9, 11.7) * out;

  // 手机的悬浮和缓慢转动
  const rotY = -18 + Math.sin(t * 0.45) * 5;
  const rotX = 7 + Math.sin(t * 0.3) * 2;
  const floatY = Math.sin(t * 0.8) * 6;

  // 增长曲线：先平后陡，像真的爆起来
  const curve = "M 20 400 C 160 395, 260 380, 330 320 S 470 120, 545 40";
  // 曲线上的点表：给"曲线头的亮点"查 y 用
  const pathRef = useRef<SVGPathElement>(null);
  const lut = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    lut.current = Array.from({ length: 241 }, (_, i) => {
      const pt = p.getPointAtLength((len * i) / 240);
      return { x: pt.x, y: pt.y };
    });
  }, []);
  const headAt = (x: number) => {
    const pts = lut.current;
    if (!pts.length) return null;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best.y;
  };

  return (
    // 舞台绝对定位 + 外层裁掉溢出：不让 560 的设计宽度撑宽页面。
    // 量到容器宽度之前，舞台是按 560 排的；手机浏览器会在那一刻把整页宽度定死在 468，
    // 之后缩回来也没用——整页一直能横着划
    <div ref={box} className="relative w-full min-w-0 overflow-hidden" style={{ height: H * scale }}>
      <div
        ref={ref}
        className="absolute left-1/2 top-0 -translate-x-1/2 overflow-hidden rounded-3xl border border-border/50 bg-foreground/[0.02]"
        style={{ width: W * scale, height: H * scale }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          {/* 身后的增长曲线 */}
          <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <defs>
              <linearGradient id="ps-line" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--brand-from))" />
                <stop offset="100%" stopColor="hsl(var(--brand-to))" />
              </linearGradient>
              <linearGradient id="ps-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--brand-to))" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(var(--brand-to))" stopOpacity="0" />
              </linearGradient>
              <clipPath id="ps-reveal">
                <rect x="0" y="0" width={20 + 525 * grow} height={H} />
              </clipPath>
            </defs>
            <g opacity={out} clipPath="url(#ps-reveal)">
              <path d={`${curve} L 545 ${H} L 20 ${H} Z`} fill="url(#ps-area)" />
              <path ref={pathRef} d={curve} fill="none" stroke="url(#ps-line)" strokeWidth="3" strokeLinecap="round" />
            </g>
            {/* 曲线头上的亮点：按曲线上真实的点走，不是估一个 */}
            {grow > 0.02 && grow < 1 && headAt(20 + 525 * grow) && (
              <circle cx={20 + 525 * grow} cy={headAt(20 + 525 * grow)!} r="5" fill="hsl(var(--brand-to))" opacity={out} />
            )}
          </svg>

          {/* 左上：那一句话（打字） */}
          <div
            className="absolute left-7 top-[88px] w-[230px] rounded-2xl rounded-tl-md border border-border/60 bg-background/70 p-3.5 text-[14px] leading-relaxed text-foreground shadow-lg backdrop-blur"
            style={{ opacity: promptOn, transform: `translateY(${(1 - seg(t, 0.2, 0.6)) * 10}px)` }}
          >
            <span style={{ opacity: 1 - seg(t, 2.6, 3.0) }}>
              {PROMPT.slice(0, typed)}
              {t < 2.5 && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary" />}
            </span>
          </div>

          {/* 光粒：那句话溶解，飞进手机 */}
          {PARTICLES.map((p, i) => {
            const k = easeInOut(seg(t, 2.7 + p.d, 3.55 + p.d));
            if (k <= 0 || k >= 1) return null;
            const cx = (p.sx + p.ex) / 2;
            const cy = Math.min(p.sy, p.ey) - 90;
            const x = (1 - k) * (1 - k) * p.sx + 2 * (1 - k) * k * cx + k * k * p.ex;
            const y = (1 - k) * (1 - k) * p.sy + 2 * (1 - k) * k * cy + k * k * p.ey;
            return (
              <span
                key={i}
                className="brand-gradient absolute h-[5px] w-[5px] rounded-full"
                style={{ left: x, top: y, opacity: 1 - k * 0.6, boxShadow: "0 0 10px hsl(var(--brand-from) / .8)" }}
              />
            );
          })}

          {/* 手机 */}
          <div className="absolute left-[292px] top-[30px]" style={{ perspective: 1100 }}>
            <div
              className="relative h-[380px] w-[204px] rounded-[34px] border border-white/15 bg-[hsl(var(--card))] p-[7px] shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]"
              style={{ transform: `translateY(${floatY}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`, transformStyle: "preserve-3d" }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-background">
                {/* 屏幕 1：生成中 */}
                <div className="absolute inset-0 p-3.5" style={{ opacity: build, transform: `scale(${1 - seg(t, 6.5, 7.1) * 0.05})` }}>
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    开物 · 正在帮你写
                  </div>
                  <div className="space-y-2">
                    {STEPS.map((s, i) => {
                      const on = seg(t, 3.4 + i * 0.45, 3.7 + i * 0.45);
                      const done = seg(t, 3.8 + i * 0.45, 3.95 + i * 0.45);
                      return (
                        <div
                          key={s}
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/[0.03] px-2 py-1.5 text-[10.5px] text-foreground"
                          style={{ opacity: on, transform: `translateX(${(1 - easeOut(on)) * 14}px)` }}
                        >
                          <span
                            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: done > 0.5 ? "hsl(var(--primary))" : "transparent", border: "1px solid hsl(var(--primary) / .6)" }}
                          >
                            {done > 0.5 && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </span>
                          {s}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 rounded-lg bg-primary/10 px-2 py-1.5 text-[10.5px] leading-snug text-foreground" style={{ opacity: seg(t, 5.2, 5.6) }}>
                    开头：同样 15 块一碗，凭什么他家排队
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {[92, 78, 86, 64, 70].map((wd, i) => (
                      <div key={i} className="h-1.5 rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-foreground/25" style={{ width: `${wd * easeOut(seg(t, 5.4 + i * 0.18, 5.9 + i * 0.18))}%` }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 屏幕 2：视频在播 */}
                <div className="absolute inset-0" style={{ opacity: video, transform: `scale(${1.05 - seg(t, 6.6, 7.3) * 0.05})` }}>
                  {/* 暖色：拍的是一碗面，蓝紫色的画面没有食欲 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <Soup className="absolute left-1/2 top-[38%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-white/35" />
                  <Play className="absolute left-1/2 top-[38%] h-7 w-7 -translate-x-1/2 -translate-y-1/2 fill-white/90 text-white/90" style={{ opacity: 1 - seg(t, 7.3, 7.8) }} />
                  {/* 右侧互动栏 */}
                  <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white">
                    {[
                      { I: Heart, n: Math.round(views * 0.064) },
                      { I: MessageCircle, n: Math.round(views * 0.0041) },
                      { I: Share2, n: Math.round(views * 0.009) },
                    ].map(({ I, n }, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <I className={`h-5 w-5 ${i === 0 ? "fill-rose-500 text-rose-500" : ""}`} />
                        <span className="mt-0.5 text-[8.5px] tabular-nums">{n >= 10000 ? `${(n / 10000).toFixed(1)}w` : n}</span>
                      </div>
                    ))}
                  </div>
                  {/* 飘起来的爱心 */}
                  {HEARTS.map((hh, i) => {
                    const k = seg(t, hh.at, hh.at + 1.6);
                    if (k <= 0 || k >= 1) return null;
                    return (
                      <Heart
                        key={i}
                        className="absolute fill-rose-400 text-rose-400"
                        style={{
                          right: 12 + Math.sin(k * 5) * hh.sway,
                          bottom: 150 + k * 150,
                          width: hh.size,
                          height: hh.size,
                          opacity: 1 - k,
                          transform: `scale(${0.6 + easeOut(Math.min(1, k * 3)) * 0.6})`,
                        }}
                      />
                    );
                  })}
                  <div className="absolute bottom-6 left-3 right-12 text-white">
                    <div className="text-[11px] font-semibold">@县城老面馆</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-white/85">凌晨四点起锅熬的骨汤，来晚了就没了</div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 h-[2px] rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white" style={{ width: `${((t - 7.2 + 30) % 3) / 3 * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 播放量：放在左下的空处（放右上会压住手机的角） */}
          <div className="absolute bottom-10 left-7" style={{ opacity: seg(t, 7.3, 7.8) * out }}>
            <div className="text-[10.5px] tracking-[0.2em] text-muted-foreground">播放量</div>
            <div className="font-mono text-[34px] font-semibold leading-tight tabular-nums text-foreground">
              {views >= 1_000_000 ? "1,000,000+" : views.toLocaleString("en-US")}
            </div>
          </div>

          {/* 收尾：换掉那一句话的位置 */}
          <div className="absolute left-7 top-[96px] w-[240px]" style={{ opacity: headline, transform: `translateY(${(1 - headline) * 10}px)` }}>
            <div className="text-[24px] font-semibold leading-snug text-foreground">
              说一句你是做什么的
              <br />
              <span className="brand-gradient bg-clip-text text-transparent">剩下的，交给开物</span>
            </div>
            <div className="mt-3 text-[13px] leading-relaxed text-muted-foreground">不会写脚本、不懂镜头都没关系</div>
          </div>

          <div className="absolute bottom-3 left-5 text-[10.5px] text-muted-foreground/60">画面与数字为示意</div>
        </div>
      </div>
    </div>
  );
}
