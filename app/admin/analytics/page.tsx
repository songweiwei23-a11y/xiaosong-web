"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Lightbulb, Target, MessageCircle, Film, CheckCircle, Tag, DollarSign, Activity, type LucideIcon } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import { toneSoft, toneBar, PLAN_TONE, FEATURE_TONE } from "@/lib/ui-tokens";
import { FeedbackSummary } from "@/components/admin/FeedbackSummary";
import { AdminPage, Button, ErrorState, Panel, StatCard, readError } from "@/components/admin/kit";

/*
 * 数据分析。只显示接口真的给得出来的数字；拿不到的（比如按日增长曲线）就不显示，
 * 空着比编一条假曲线好。
 */

const FEATURE_ICONS: Record<string, LucideIcon> = {
  script: FileText,
  topic: Lightbulb,
  positioning: Target,
  freeChat: MessageCircle,
  storyboard: Film,
  review: CheckCircle,
  title: Tag,
  dealReason: DollarSign,
};

interface Analytics {
  stats: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    totalRevenue: number;
    paidOrderCount: number;
    paidUsers: number;
    conversionRate: number;
    avgUsagePerUser: number;
  };
  featureUsage: { name: string; key: string; usage: number }[];
  planDistribution: Record<string, number>;
}

const RANGES = [
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "90d", label: "近 90 天" },
];

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/analytics?timeRange=${range}`);
      if (!res.ok) throw new Error(await readError(res, "读取失败"));
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message || "读取失败");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "";

  const actions = (
    <div className="flex gap-1.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => setRange(r.value)}
          className={`glass-interactive rounded-xl border px-3.5 py-2 text-[12.5px] ${
            range === r.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (loading && !data) {
    return <Loading />;
  }

  if (error || !data) {
    return (
      <AdminPage title="数据分析" actions={actions}>
        <ErrorState message={error || "暂无数据"} onRetry={() => void load()} />
      </AdminPage>
    );
  }

  const s = data.stats;
  const maxUsage = Math.max(1, ...data.featureUsage.map((f) => f.usage));
  const totalPlanUsers = Object.values(data.planDistribution).reduce((a, b) => a + b, 0);

  return (
    <AdminPage title="数据分析" subtitle="用户、营收与各功能的真实使用情况" actions={<>{actions}<Button variant="default" onClick={() => void load()} busy={loading}>刷新</Button></>}>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="总用户" value={s.totalUsers} hint="以认证系统为准" />
        <StatCard label="新增用户" value={s.newUsers} hint={rangeLabel} />
        <StatCard label="活跃用户" value={s.activeUsers} hint="区间内有过生成" />
        <StatCard label="营收" value={`¥${s.totalRevenue}`} hint={`${s.paidOrderCount} 笔已通过订单`} tone="ok" />
        <StatCard label="付费用户" value={s.paidUsers} hint={`转化率 ${s.conversionRate}%`} />
        <StatCard label="人均生成" value={s.avgUsagePerUser} hint="累计次数 ÷ 总用户" />
      </div>

      <div className="mb-5">
        <FeedbackSummary />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="各功能使用量">
          {data.featureUsage.every((f) => f.usage === 0) ? (
            <p className="text-[13px] text-muted-foreground">{rangeLabel}还没有任何生成记录</p>
          ) : (
            <div className="space-y-3.5">
              {data.featureUsage.map((f) => {
                const Icon = FEATURE_ICONS[f.key] ?? Activity;
                const tone = FEATURE_TONE[f.key] ?? "gray";
                return (
                  <div key={f.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${toneSoft(tone)}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {f.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{f.usage} 次</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                      <div className={`h-full rounded-full ${toneBar(tone)}`} style={{ width: `${(f.usage / maxUsage) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="套餐分布"
          action={<span className="text-[11.5px] text-muted-foreground">没有订阅记录的用户按免费版计</span>}
        >
          <div className="space-y-3.5">
            {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => {
              const count = data.planDistribution[id] ?? 0;
              const pct = totalPlanUsers ? Math.round((count / totalPlanUsers) * 100) : 0;
              return (
                <div key={id}>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-foreground">{SUBSCRIPTION_PLANS[id].name}</span>
                    <span className="tabular-nums text-muted-foreground">{count} 人 · {pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div className={`h-full rounded-full ${toneBar(PLAN_TONE[id])}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
