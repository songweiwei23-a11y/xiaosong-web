"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Activity, Wallet, TrendingUp, Gauge,
  FileText, Lightbulb, Target, MessageCircle, Film, CheckCircle, Tag, DollarSign,
  type LucideIcon,
} from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import { toneSoft, toneBar, PLAN_TONE, FEATURE_TONE } from "@/lib/ui-tokens";

/*
 * 数据分析。
 *
 * 重写而不是修补，因为改造前这一页大部分是假的：
 *   - 用户增长图是写死的数组，日期停在「07-20」，与真实时间无关；
 *   - 套餐分布里付费三档直接写 0，免费版写的是「总用户 - 活跃用户」，
 *     这个减法没有任何含义；
 *   - 营收硬编码 0；
 *   - 读的字段名（features / activeUsers / totalUsage）和接口返回的
 *     （featureUsage / activeToday / totalGenerations）对不上，
 *     `analyticsData.features.map` 直接在 undefined 上调用会抛错，
 *     被外层 catch 吞掉，页面于是一片空白。
 *
 * 现在只显示接口真的给得出来的数字。拿不到的（比如按日增长曲线，
 * 需要按天聚合的表，目前没有）就不显示——空着比编一条假曲线好。
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setData(json);
    } catch (e: any) {
      setError(e?.message || "读取失败");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="glass-panel rounded-2xl p-6 text-center">
          <p className="text-[13px] text-muted-foreground">{error || "暂无数据"}</p>
          <button onClick={load} className="mt-3 text-[13px] text-primary hover:opacity-80">
            重试
          </button>
        </div>
      </div>
    );
  }

  const s = data.stats;
  const maxUsage = Math.max(1, ...data.featureUsage.map((f) => f.usage));
  const totalPlanUsers = Object.values(data.planDistribution).reduce((a, b) => a + b, 0);

  const cards: { label: string; value: string; hint: string; icon: LucideIcon; tone: string }[] = [
    { label: "总用户", value: String(s.totalUsers), hint: "以认证系统为准", icon: Users, tone: "blue" },
    { label: "新增用户", value: String(s.newUsers), hint: RANGES.find((r) => r.value === range)!.label, icon: UserPlus, tone: "green" },
    { label: "活跃用户", value: String(s.activeUsers), hint: "区间内有过生成", icon: Activity, tone: "indigo" },
    { label: "营收", value: `¥${s.totalRevenue}`, hint: `${s.paidOrderCount} 笔已通过订单`, icon: Wallet, tone: "orange" },
    { label: "付费用户", value: String(s.paidUsers), hint: `转化率 ${s.conversionRate}%`, icon: TrendingUp, tone: "purple" },
    { label: "人均生成", value: String(s.avgUsagePerUser), hint: "累计次数 ÷ 总用户", icon: Gauge, tone: "pink" },
  ];

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">数据分析</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              用户、营收与各功能的真实使用情况
            </p>
          </div>
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`glass-interactive rounded-xl border px-3.5 py-2 text-[12.5px] ${
                  range === r.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <span className="text-[12.5px] text-muted-foreground">{c.label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneSoft(c.tone)}`}>
                  <c.icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-[24px] font-semibold tabular-nums text-foreground">{c.value}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">{c.hint}</div>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">各功能使用量</h2>
            {data.featureUsage.every((f) => f.usage === 0) ? (
              <p className="text-[12.5px] text-muted-foreground">还没有任何生成记录。</p>
            ) : (
              <div className="space-y-3">
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
                        <div
                          className={`h-full rounded-full ${toneBar(tone)}`}
                          style={{ width: `${(f.usage / maxUsage) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-foreground">套餐分布</h2>
            <div className="space-y-3">
              {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => {
                const count = data.planDistribution[id] ?? 0;
                const pct = totalPlanUsers ? Math.round((count / totalPlanUsers) * 100) : 0;
                return (
                  <div key={id}>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="text-foreground">{SUBSCRIPTION_PLANS[id].name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count} 人 · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                      <div
                        className={`h-full rounded-full ${toneBar(PLAN_TONE[id])}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
              没有订阅记录的用户按免费版计。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
