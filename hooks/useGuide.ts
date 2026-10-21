"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadSetupStepsStrict } from "@/hooks/useSetupProgress";
import { listWorksPage, type Work } from "@/lib/works";
import { onActiveProfileChange } from "@/lib/active-profile";
import { GENERATED_EVENT } from "@/lib/upgrade";
import { onProgressChanged } from "@/lib/progress-events";
import { buildGuide, type GuideOutput, type GuideInput } from "@/lib/guide";
import type { SetupStep } from "@/lib/setup-progress";

interface QuotaSnap {
  tightest?: { featureName: string; remaining: number } | null;
  packCredits?: number | null;
  error?: string;
}

/**
 * 实时引导：地基、作品、额度三份数据汇总成 buildGuide 的结果。
 *
 * 什么时候重新取：
 *   - 挂载时（首页大卡每次进首页都会挂载）
 *   - 路由变化（顶栏小条挂在布局里，不会因为换页面而重新挂载，所以要靠路由触发）
 *   - 生成完成、切换档案
 *   - 建档、定位、简报、作品有变化（lib/progress-events，同一页面里也马上更新）
 *   - 窗口重新获得焦点（比如在别的标签页里建了档案，切回来）
 *
 * 不做缓存：地基用的是严格版取数，失败就抛错，整块不显示，不拿旧数据或空数据猜。
 * 首页和顶栏各用一份，互不影响。
 */
export function useGuide(): { guide: GuideOutput | null; loading: boolean } {
  const pathname = usePathname();
  const [setup, setSetup] = useState<SetupStep[] | null>(null);
  const [works, setWorks] = useState<Work[] | null>(null);
  // 地基、作品各自记错误；取成功了就清掉，失败一次不会让引导永久消失
  const [setupError, setSetupError] = useState(false);
  const [worksError, setWorksError] = useState(false);
  const [quota, setQuota] = useState<QuotaSnap | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onActiveProfileChange(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(GENERATED_EVENT, bump);
    window.addEventListener("focus", bump);
    // 建档、定位、简报、作品有变化：同一页面里也要马上更新
    const offProgress = onProgressChanged(bump);
    return () => {
      window.removeEventListener(GENERATED_EVENT, bump);
      window.removeEventListener("focus", bump);
      offProgress();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadSetupStepsStrict()
      .then((steps) => {
        if (cancelled) return;
        setSetup(steps);
        setSetupError(false);
      })
      .catch(() => {
        if (!cancelled) setSetupError(true);
      });

    listWorksPage({ limit: 50 })
      .then((list) => {
        if (cancelled) return;
        setWorks(list);
        setWorksError(false);
        setNowMs(Date.now());
      })
      .catch(() => {
        if (!cancelled) setWorksError(true);
      });

    fetch("/api/quota/check", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<QuotaSnap>) : null))
      .then((d) => {
        if (!cancelled) setQuota(d && !d.error ? d : null);
      })
      .catch(() => {
        // 额度读不到就不给额度提醒，不影响下一步的建议
        if (!cancelled) setQuota(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tick, pathname]);

  // 地基或作品取失败：整块不显示。不拿旧数据或空数据去猜
  if (setupError || worksError) return { guide: null, loading: false };
  if (!setup || !works || nowMs === null) return { guide: null, loading: true };

  const exhausted = quota?.tightest && quota.tightest.remaining === 0 ? quota.tightest.featureName : null;
  const input: GuideInput = {
    setupSteps: setup,
    works,
    quota: quota ? { exhaustedFeature: exhausted, packCredits: quota.packCredits ?? null } : null,
    nowMs,
  };
  return { guide: buildGuide(input), loading: false };
}
