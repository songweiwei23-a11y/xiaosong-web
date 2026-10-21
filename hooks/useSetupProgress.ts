"use client";

import { useEffect, useState } from "react";
import { pickProfileForSetup, setupSteps, type SetupStep } from "@/lib/setup-progress";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { onProgressChanged } from "@/lib/progress-events";

/**
 * 「先打地基」三步的进度（建档 / 定位 / 简报），侧栏、首页、实时引导共用。
 *
 * 看的是「当前档案」的定位（和作品、创作板块是同一个档案）。
 * 同一个标签页 60 秒内只取一次；但建档、定位、简报、作品有变化，或者切换了档案，
 * 缓存立刻作废、马上重取——同一页面里保存了也要马上看到变化。
 */
const TTL_MS = 60_000;
let cache: { at: number; steps: SetupStep[] } | null = null;
let inflight: Promise<SetupStep[]> | null = null;
/** 每次作废缓存加一。旧请求回来时如果代数已经变了，就不写缓存，免得旧数据盖住新数据 */
let generation = 0;

/**
 * 读一遍地基。strict 为假时取不到就按「一步都没做」算（侧栏和首页宁可多提示一次）；
 * strict 为真时取不到就抛错（实时引导用，不拿空数据去猜）。
 */
async function readSetup(strict: boolean): Promise<SetupStep[]> {
  let profiles: Array<{ id: string }> = [];
  let types: string[] = [];
  try {
    const res = await fetch("/api/profiles", { cache: "no-store" });
    if (!res.ok) throw new Error("档案没取到");
    const raw = await res.json();
    profiles = Array.isArray(raw) ? raw : [];
    const current = pickProfileForSetup(profiles, getActiveProfileId());
    if (current) {
      const pos = await fetch(`/api/positioning?profileId=${encodeURIComponent(current.id)}`, { cache: "no-store" });
      if (!pos.ok) throw new Error("定位没取到");
      const rows = await pos.json();
      if (Array.isArray(rows)) types = rows.map((r: { positioning_type?: string }) => r.positioning_type ?? "");
    }
  } catch (error) {
    if (strict) throw error;
    return setupSteps({ profileCount: 0, positioningTypes: [] });
  }
  return setupSteps({ profileCount: profiles.length, positioningTypes: types });
}

/** 严格版：取不到就抛错。实时引导（hooks/useGuide）用这个：网络一抖就把老用户当成新用户，比不显示更糟 */
export async function loadSetupStepsStrict(): Promise<SetupStep[]> {
  return readSetup(true);
}

export function useSetupProgress(): { steps: SetupStep[]; loading: boolean } {
  const [steps, setSteps] = useState<SetupStep[]>(() => cache?.steps ?? []);
  const [loading, setLoading] = useState(!cache);
  const [tick, setTick] = useState(0);

  // 进度变了（建档、定位、简报、作品）或者切换了档案：作废缓存，马上重取
  useEffect(() => {
    const bump = () => {
      cache = null;
      inflight = null;
      generation += 1;
      setTick((n) => n + 1);
    };
    const offProgress = onProgressChanged(bump);
    const offProfile = onActiveProfileChange(bump);
    return () => {
      offProgress();
      offProfile();
    };
  }, []);

  useEffect(() => {
    let off = false;
    if (cache && Date.now() - cache.at < TTL_MS) {
      return;
    }
    if (!inflight) {
      const gen = generation;
      inflight = readSetup(false).then((s) => {
        if (gen === generation) {
          cache = { at: Date.now(), steps: s };
          inflight = null;
        }
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
  }, [tick]);

  return { steps, loading };
}

/** 测试和退出登录时用：清掉缓存 */
export function clearSetupProgressCache() {
  cache = null;
  inflight = null;
  generation += 1;
}
