"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUPPORT_WECHAT } from "@/lib/config/contact";
import { FEATURE_NAMES, getPlan, quotaSummary } from "@/lib/config/plans";
import {
  GENERATED_EVENT, QUOTA_EXHAUSTED_EVENT, recommendPlan, shouldNudge, valueRecap,
} from "@/lib/upgrade";

interface FeatureRow {
  feature: string;
  featureName: string;
  total: number;
  remaining: number;
}

interface QuotaInfo {
  plan: string;
  planName: string;
  periodEnd?: string | null;
  features?: FeatureRow[];
}

async function loadQuota(): Promise<QuotaInfo | null> {
  try {
    const r = await fetch("/api/quota/check", { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** 同一个功能、同一期额度只提醒一次（存在本机） */
const nudgeKey = (feature: string, period?: string | null) => `kaiwu:nudged:${feature}:${period ?? "trial"}`;

/**
 * 全站付费引导，挂在工作台框架里。触发见 lib/upgrade：
 * - 收到"用完了" → 弹窗：回顾做过什么 + 推荐往上一档 + 一步去付款
 * - 收到"生成成功" → 查一下，剩 3 次以内的功能在右下角轻轻提醒一次
 */
export function UpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | undefined>();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [recap, setRecap] = useState<string[]>([]);
  const [nudge, setNudge] = useState<FeatureRow | null>(null);

  const onExhausted = useCallback(async (e: Event) => {
    setFeature((e as CustomEvent<{ feature?: string }>).detail?.feature);
    setNudge(null);
    setOpen(true);
    const [q, r] = await Promise.all([
      loadQuota(),
      fetch("/api/usage/recap", { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : { counts: {} }))
        .catch(() => ({ counts: {} })),
    ]);
    setQuota(q);
    setRecap(valueRecap(r.counts ?? {}));
  }, []);

  const onGenerated = useCallback(async () => {
    const q = await loadQuota();
    const hit = (q?.features ?? []).find((f) => {
      if (!shouldNudge(f.remaining, f.total)) return false;
      try {
        return !localStorage.getItem(nudgeKey(f.feature, q?.periodEnd));
      } catch {
        return true;
      }
    });
    if (!hit) return;
    try {
      localStorage.setItem(nudgeKey(hit.feature, q?.periodEnd), "1");
    } catch {}
    setQuota(q);
    setNudge(hit);
  }, []);

  useEffect(() => {
    window.addEventListener(QUOTA_EXHAUSTED_EVENT, onExhausted);
    window.addEventListener(GENERATED_EVENT, onGenerated);
    return () => {
      window.removeEventListener(QUOTA_EXHAUSTED_EVENT, onExhausted);
      window.removeEventListener(GENERATED_EVENT, onGenerated);
    };
  }, [onExhausted, onGenerated]);

  // 右下角的提醒 15 秒后自己收起
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(null), 15000);
    return () => clearTimeout(t);
  }, [nudge]);

  const planId = quota?.plan ?? "free";
  const isFree = planId === "free";
  const next = recommendPlan(planId);
  const nextPlan = next ? getPlan(next) : null;
  const featureName = feature ? FEATURE_NAMES[feature] ?? "这一项" : "这一项";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[18px]">{featureName}的次数用完了</DialogTitle>
            <DialogDescription>
              {isFree ? "免费体验就到这里。开通会员，接着把这条内容做完。" : `${quota?.planName ?? "当前套餐"}这一期的额度用完了。`}
            </DialogDescription>
          </DialogHeader>

          {/* 先让他看到自己已经得到了什么，再谈钱 */}
          {recap.length > 0 && (
            <div className="rounded-xl bg-foreground/[0.04] px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                你已经用开物做了
              </div>
              <div className="text-[15px] font-semibold leading-relaxed text-foreground">{recap.join(" · ")}</div>
            </div>
          )}

          {nextPlan ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/[0.05] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                  <Crown className="h-4 w-4 text-primary" />
                  {isFree ? "推荐" : "升级到"}{nextPlan.name}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  <span className="text-[22px] font-bold text-foreground">¥{nextPlan.price}</span>/月
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                {quotaSummary(nextPlan.id).map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
              <Link
                href={`/payment?plan=${nextPlan.id}`}
                onClick={() => setOpen(false)}
                className="brand-gradient mt-3 flex items-center justify-center gap-1.5 rounded-xl py-3 text-[15px] font-semibold text-white"
              >
                开通{nextPlan.name} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">你已经是最高一档了。额度不够用的话，加客服微信聊一聊。</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
            <Link href="/dashboard/membership" onClick={() => setOpen(false)} className="text-primary hover:underline">
              看全部套餐
            </Link>
            <span>有问题加客服微信 {SUPPORT_WECHAT}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* 快用完：右下角轻轻提醒一次，不打断 */}
      {nudge && !open && (
        <div className="glass-panel fixed inset-x-4 bottom-4 z-[60] rounded-2xl border border-primary/30 p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px]">
          <button
            type="button"
            onClick={() => setNudge(null)}
            aria-label="关闭"
            className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 text-[14px] font-semibold text-foreground">
            {nudge.featureName}还剩 {nudge.remaining} 次
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {isFree ? "免费体验的次数不按月重置，用完就没了。" : "这一期用完后要等下一期，或者升级套餐。"}
            {nextPlan && `${nextPlan.name} ¥${nextPlan.price}/月，${quotaSummary(nextPlan.id)[0]}。`}
          </p>
          {nextPlan && (
            <Link
              href={`/payment?plan=${nextPlan.id}`}
              onClick={() => setNudge(null)}
              className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
            >
              开通{nextPlan.name} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
