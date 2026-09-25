"use client";

import { useEffect, useState } from "react";

/**
 * 当前时间，按给定频率刷新。
 *
 * 首屏先给 null：服务端渲染时的时间和浏览器里的对不上，直接渲染会报水合不一致，
 * 而且会先闪一下服务器时区的时间。挂载后再开始走。
 * smooth=true 时按动画帧刷新（秒针扫动用），否则对齐到整秒跳。
 */
export function useNow(smooth = false): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    if (smooth) {
      let raf = 0;
      const loop = () => {
        setNow(new Date());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    // 对齐到下一个整秒再开始每秒跳，秒数不会比真实时间慢半拍
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, [smooth]);

  return now;
}
