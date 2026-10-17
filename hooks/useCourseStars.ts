"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_STAR, cleanStars, mergeStars, type StarMap } from "@/lib/newbie-course";
import { postSafely } from "@/lib/safe-post";

const LOCAL_KEY = "kaiwu:course-stars";

function readLocal(): StarMap {
  try {
    return cleanStars(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

function writeLocal(s: StarMap) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    // 存不下就只在本次打开期间有效
  }
}

/**
 * 新手课的星星：存数据库（换设备也看得到），本机也记一份。
 * 表还没建时只存本机，照样能玩。两边都是只升不降，合并取大。
 * 打开时：本机比服务器多的（比如功能上线前在本机拿的）补传上去。
 */
export function useCourseStars() {
  const [stars, setStars] = useState<StarMap>({});
  const cur = useRef<StarMap>({});
  /** 服务器能用（表已建、上次请求没报 unavailable）才往服务器写 */
  const serverOk = useRef(false);

  const show = useCallback((next: StarMap) => {
    cur.current = next;
    setStars(next);
    writeLocal(next);
  }, []);

  const push = useCallback(
    async (items: { no: number; stars: number }[]) => {
      try {
        const r = await postSafely("/api/course-stars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const d = await r.json().catch(() => ({}));
        if (d.unavailable) {
          serverOk.current = false;
          return;
        }
        if (d.stars) show(mergeStars(cur.current, cleanStars(d.stars)));
      } catch {
        // 存不上就先留在本机，下次打开会补传
      }
    },
    [show]
  );

  useEffect(() => {
    show(readLocal());
    fetch("/api/course-stars", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (d) => {
        if (d.unavailable) return;
        serverOk.current = true;
        const server = cleanStars(d.stars);
        const merged = mergeStars(cur.current, server);
        show(merged);
        const behind = Object.entries(merged)
          .filter(([k, v]) => v > (server[k] ?? 0))
          .map(([k, v]) => ({ no: Number(k), stars: v }));
        if (behind.length) await push(behind);
      })
      .catch(() => {
        // 拉不到服务器就用本机的，不影响学
      });
  }, [show, push]);

  const award = useCallback(
    (no: number, n: number) => {
      const key = String(no);
      const next = Math.min(MAX_STAR, n);
      if (next <= (cur.current[key] ?? 0)) return;
      show({ ...cur.current, [key]: next });
      if (serverOk.current) void push([{ no, stars: next }]);
    },
    [show, push]
  );

  return { stars, award };
}
