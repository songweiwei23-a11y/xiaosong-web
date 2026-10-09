"use client";

import { useCallback, useEffect, useState } from "react";
import { clampPassed, passLevel } from "@/lib/newbie-course";
import { postSafely } from "@/lib/safe-post";

const LOCAL_KEY = "kaiwu:course-passed";

function readLocal(): number {
  try {
    return clampPassed(localStorage.getItem(LOCAL_KEY));
  } catch {
    return 0;
  }
}

function writeLocal(n: number) {
  try {
    localStorage.setItem(LOCAL_KEY, String(n));
  } catch {}
}

/**
 * 新手课的闯关进度。存数据库（换设备接着学）；表还没建时退回存本机，照样能学。
 * 过关先改界面再存——答对了立刻点亮下一关，不等网络。
 */
export function useCourseProgress() {
  const [passed, setPassed] = useState(0);
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    fetch("/api/course-progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d.unavailable) {
          setLocal(true);
          setPassed(readLocal());
        } else {
          // 表建好之前在本机学过的，别丢：取两边大的那个
          setPassed(Math.max(clampPassed(d.passed), readLocal()));
        }
      })
      .catch(() => {
        setLocal(true);
        setPassed(readLocal());
      })
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(
    async (body: object, next: number) => {
      setPassed(next);
      writeLocal(next);
      if (local) return;
      try {
        const r = await postSafely("/api/course-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json().catch(() => ({}));
        if (d.unavailable) setLocal(true);
      } catch {
        // 存不上就先留在本机，下次进来会取两边大的那个
      }
    },
    [local]
  );

  const pass = useCallback((no: number) => save({ action: "pass", no }, passLevel(passed, no)), [passed, save]);
  const reset = useCallback(() => save({ action: "reset" }, 0), [save]);

  return { passed, ready, pass, reset };
}
