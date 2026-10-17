"use client";

import { useEffect, useState } from "react";
import { setupSteps, type SetupStep } from "@/lib/setup-progress";

/**
 * 「先打地基」三步的进度（建档 / 定位 / 简报），侧栏和首页共用（体检 P1-2）。
 * 同一个标签页 60 秒内只取一次，切页面不会每次都重新请求。
 */
const TTL_MS = 60_000;
let cache: { at: number; steps: SetupStep[] } | null = null;
let inflight: Promise<SetupStep[]> | null = null;

async function load(): Promise<SetupStep[]> {
  let profiles: Array<{ id: string }> = [];
  let types: string[] = [];
  try {
    const res = await fetch("/api/profiles", { cache: "no-store" });
    const raw = res.ok ? await res.json() : [];
    profiles = Array.isArray(raw) ? raw : [];
    if (profiles.length) {
      const pos = await fetch(`/api/positioning?profileId=${encodeURIComponent(profiles[0].id)}`, { cache: "no-store" });
      const rows = pos.ok ? await pos.json() : [];
      if (Array.isArray(rows)) types = rows.map((r: { positioning_type?: string }) => r.positioning_type ?? "");
    }
  } catch {
    // 查不到就按「一步都没做」算：宁可多提示一次，也不要因为请求失败漏掉提示
  }
  return setupSteps({ profileCount: profiles.length, positioningTypes: types });
}

export function useSetupProgress(): { steps: SetupStep[]; loading: boolean } {
  const [steps, setSteps] = useState<SetupStep[]>(() => cache?.steps ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let off = false;
    if (cache && Date.now() - cache.at < TTL_MS) {
      return;
    }
    if (!inflight) {
      inflight = load().then((s) => {
        cache = { at: Date.now(), steps: s };
        inflight = null;
        return s;
      });
    }
    inflight.then((s) => {
      if (!off) {
        setSteps(s);
        setLoading(false);
      }
    });
    return () => { off = true; };
  }, []);

  return { steps, loading };
}

/** 测试和退出登录时用：清掉缓存 */
export function clearSetupProgressCache() {
  cache = null;
  inflight = null;
}
