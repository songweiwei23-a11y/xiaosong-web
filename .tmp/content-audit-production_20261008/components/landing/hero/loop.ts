"use client";

import { useEffect, useRef, useState } from "react";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** t 在 [a, b] 之间走了多少（0~1） */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * 一镜到底的循环时钟：返回这一轮走到第几秒。
 *
 * 整段动画是 t 的函数，不是"第几页"——每一帧都由同一个时间算出来，
 * 所以画面是连续流动的，不会出现幻灯片那种硬切。
 *
 * - 滚出屏幕、切到后台时停，省电也省风扇
 * - 系统设了"减少动态效果"的，直接停在 still 这一帧（最完整的那一刻）
 */
export function useLoopClock(loop: number, still: number, freezeAt?: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(freezeAt ?? 0);

  useEffect(() => {
    // 定格在某一秒：逐帧检查画面用
    if (freezeAt !== undefined) {
      setT(freezeAt);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(still);
      return;
    }
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let acc = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    if (ref.current) io.observe(ref.current);
    const tick = (now: number) => {
      // 切回来时别一下跳好几秒
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        acc = (acc + dt) % loop;
        setT(acc);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [loop, still, freezeAt]);

  return { ref, t };
}

/** 按设计尺寸画，外面按容器宽度等比缩放——手机上不用另画一套 */
export function useFitScale(designWidth: number) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / designWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  return { box, scale };
}
