"use client";

import { useCallback, useEffect, useState } from "react";
import { COURSE_TOTAL, MAX_STAR } from "@/lib/newbie-course";

const STARS_KEY = "kaiwu:course-stars";

/**
 * 读本机记下的星星：{ "1": 3, "2": 2, ... }。坏数据、越界的关当没有。
 */
function readStars(): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STARS_KEY) ?? "{}");
    if (!raw || typeof raw !== "object") return out;
    for (const [k, v] of Object.entries(raw)) {
      const no = Number(k);
      const n = Math.floor(Number(v));
      if (Number.isInteger(no) && no >= 1 && no <= COURSE_TOTAL && Number.isFinite(n)) {
        out[String(no)] = Math.min(MAX_STAR, Math.max(0, n));
      }
    }
  } catch {
    // 读不到就当没有星星，不影响学习
  }
  return out;
}

/**
 * 新手课的星星只存本机（不进数据库，不改过关规则）。
 * 只升不降：重玩拿到的星少，不会把之前拿到的覆盖掉。
 */
export function useCourseStars() {
  const [stars, setStars] = useState<Record<string, number>>({});

  useEffect(() => {
    setStars(readStars());
  }, []);

  const award = useCallback((no: number, n: number) => {
    setStars((prev) => {
      const key = String(no);
      const cur = prev[key] ?? 0;
      const next = Math.min(MAX_STAR, n);
      if (next <= cur) return prev;
      const merged = { ...prev, [key]: next };
      try {
        localStorage.setItem(STARS_KEY, JSON.stringify(merged));
      } catch {
        // 存不下就只在本次打开期间有效
      }
      return merged;
    });
  }, []);

  return { stars, award };
}
