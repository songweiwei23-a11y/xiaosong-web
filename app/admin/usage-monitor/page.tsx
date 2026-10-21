"use client";

import { useState, useEffect, useMemo } from "react";
import { Loading } from "@/components/ui/loading";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import {
  AdminPage,
  AdminPanelHint,
  Badge,
  Button,
  DataTable,
  ErrorState,
  Pager,
  Panel,
  StatCard,
  readError,
  type Column,
} from "@/components/admin/kit";
import type { MonitorFeatureRow, MonitorOutput, MonitorUserRow } from "@/lib/usage-monitor";

/*
 * 用户使用监控。所有数字都来自 /api/admin/usage-monitor，口径写在 lib/usage-monitor.ts 顶部。
 * 这里不再算新的数字，只负责展示和排序。
 */

type Report = MonitorOutput & { truncated: boolean };

const WINDOWS = [7, 30, 90];
const PAGE_SIZE = 20;

type SortKey = "creations" | "tokens" | "period" | "lastActive";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "creations", label: "按创作次数" },
  { value: "tokens", label: "按 Token" },
  { value: "period", label: "按会员额度已用" },
  { value: "lastActive", label: "按最近使用" },
];

const fmtInt = (n: number) => n.toLocaleString("zh-CN");
/** 大数字用「万 / 亿」，Token 动辄几百万，不这样写看不清 */
function fmtBig(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return fmtInt(n);
}
const fmtPct = (v: number | null) => (v === null ? "—" : `${v}%`);
const share = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}%` : "—");
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "—";
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
const planName = (id: string) => (SUBSCRIPTION_PLANS as Record<string, { name?: string } | undefined>)[id]?.name ?? id;

const USER_COLUMNS: Column<MonitorUserRow>[] = [
  {
    key: "user",
    header: "用户",
    render: (u) => (
      <div className="min-w-0">
        <div className="truncate">{u.email ?? "无邮箱"}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{u.userId.slice(0, 8)}</div>
      </div>
    ),
  },
  {
    key: "plan",
    header: "套餐",
    render: (u) => <Badge tone={u.plan === "free" ? "neutral" : "info"}>{planName(u.plan)}</Badge>,
  },
  { key: "registered", header: "注册", render: (u) => fmtDate(u.registeredAt) },
  { key: "lastActive", header: "最近使用", render: (u) => fmtDateTime(u.lastActiveAt) },
  {
    key: "creations",
    header: "窗口内次数",
    className: "text-right tabular-nums",
    render: (u) => (
      <>
        {fmtInt(u.creationsInWindow)}
        <span className="text-[11px] text-muted-foreground"> / {u.activeDaysInWindow} 天</span>
      </>
    ),
  },
  { key: "features", header: "用过功能", className: "text-right tabular-nums", render: (u) => u.featuresUsedInWindow },
  { key: "tokens", header: "Token", className: "text-right tabular-nums", render: (u) => fmtBig(u.tokensInWindow) },
  { key: "period", header: "会员额度已用", className: "text-right tabular-nums", render: (u) => fmtInt(u.periodUsed) },
  {
    key: "pack",
    header: "次数包 余额 / 批数",
    className: "text-right tabular-nums",
    render: (u) => `${fmtInt(u.packBalance)} / ${u.packPurchases}`,
  },
  { key: "paid", header: "已付订单", className: "text-right tabular-nums", render: (u) => u.paidOrders },
];

/** 功能表的一行：后端的数字加上页面算的占比 */
type FeatureView = MonitorFeatureRow & { creationShare: string; tokenShare: string };

const FEATURE_COLUMNS: Column<FeatureView>[] = [
  { key: "name", header: "功能", render: (f) => f.name },
  { key: "creations", header: "创作次数", className: "text-right tabular-nums", render: (f) => fmtInt(f.creations) },
  { key: "creationShare", header: "次数占比", className: "text-right tabular-nums", render: (f) => f.creationShare },
  { key: "tokens", header: "Token", className: "text-right tabular-nums", render: (f) => fmtBig(f.tokens) },
  { key: "tokenShare", header: "Token 占比", className: "text-right tabular-nums", render: (f) => f.tokenShare },
  { key: "users", header: "用户数", className: "text-right tabular-nums", render: (f) => fmtInt(f.users) },
];

/** 五维雷达图：五个顶点，每维 0–100 分。纯 SVG，颜色跟随主题 */
function RadarChart({ dimensions }: { dimensions: MonitorOutput["dimensions"] }) {
  const cx = 170;
  const cy = 128;
  const R = 88;
  const n = dimensions.length;
  const point = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), cos: Math.cos(a) };
  };
  const ringPoints = (level: number) =>
    dimensions.map((_, i) => point(i, (R * level) / 100)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const shape = dimensions.map((d, i) => point(i, (R * Math.max(0, Math.min(100, d.score))) / 100));

  return (
    <svg viewBox="0 0 340 262" className="mx-auto w-full max-w-[340px]" role="img" aria-label="五维雷达图">
      <g className="text-foreground/15" stroke="currentColor" fill="none">
        {[25, 50, 75, 100].map((level) => (
          <polygon key={level} points={ringPoints(level)} />
        ))}
        {dimensions.map((d, i) => {
          const p = point(i, R);
          return <line key={d.label} x1={cx} y1={cy} x2={p.x} y2={p.y} />;
        })}
      </g>
      <polygon
        points={shape.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        className="text-primary"
        fill="currentColor"
        fillOpacity={0.18}
        stroke="currentColor"
        strokeWidth={2}
      />
      {shape.map((p, i) => (
        <circle key={dimensions[i].label} cx={p.x} cy={p.y} r={3} className="text-primary" fill="currentColor" />
      ))}
      {dimensions.map((d, i) => {
        const p = point(i, R + 24);
        const anchor = p.cos > 0.3 ? "start" : p.cos < -0.3 ? "end" : "middle";
        return (
          <g key={d.label}>
            <text x={p.x} y={p.y} textAnchor={anchor} fontSize={12} className="text-muted-foreground" fill="currentColor">
              {d.label}
            </text>
            <text x={p.x} y={p.y + 15} textAnchor={anchor} fontSize={12} fontWeight={600} className="text-foreground" fill="currentColor">
              {d.score} 分
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 每日走势：次数 / Token 两种切换，柱子悬停显示当天的两个数 */
function DailyChart({ daily }: { daily: MonitorOutput["daily"] }) {
  const [metric, setMetric] = useState<"creations" | "tokens">("creations");
  const max = Math.max(1, ...daily.map((d) => d[metric]));
  const step = Math.max(1, Math.ceil(daily.length / 8));
  const toggles: { value: "creations" | "tokens"; label: string }[] = [
    { value: "creations", label: "创作次数" },
    { value: "tokens", label: "Token" },
  ];
  return (
    <Panel
      title="每日走势（上海时间）"
      action={
        <div className="flex gap-1.5">
          {toggles.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setMetric(t.value)}
              className={`glass-interactive rounded-xl border px-3 py-1.5 text-[12px] ${
                metric === t.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex h-44 items-end gap-[3px]">
        {daily.map((d) => {
          const v = d[metric];
          const h = v > 0 ? Math.max(3, (v / max) * 100) : 0;
          return (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${d.date}：${fmtInt(d.creations)} 次，${fmtInt(d.tokens)} tokens`}
            >
              <div className="w-full rounded-t bg-primary/70" style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10.5px] text-muted-foreground">
        {daily.map((d, i) => (
          <div key={d.date} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {i % step === 0 || i === daily.length - 1 ? d.date.slice(5) : ""}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function AdminUsageMonitorPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("creations");
  const [onlyActive, setOnlyActive] = useState(false);
  const [page, setPage] = useState(1);

  // 读取放在 effect 里；cancelled 防止快速切换窗口时旧的结果覆盖新的
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/usage-monitor?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "读取失败"));
        return (await res.json()) as Report;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError("");
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "读取失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, tick]);

  const pickDays = (d: number) => {
    setLoading(true);
    setPage(1);
    setDays(d);
  };
  const refresh = () => {
    setLoading(true);
    setTick((t) => t + 1);
  };

  const users = useMemo(() => {
    const list = data ? data.users.filter((u) => !onlyActive || u.creationsInWindow > 0) : [];
    const cmp: Record<SortKey, (a: MonitorUserRow, b: MonitorUserRow) => number> = {
      creations: (a, b) => b.creationsInWindow - a.creationsInWindow || b.tokensInWindow - a.tokensInWindow,
      tokens: (a, b) => b.tokensInWindow - a.tokensInWindow,
      period: (a, b) => b.periodUsed - a.periodUsed,
      lastActive: (a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""),
    };
    return [...list].sort(cmp[sortKey]);
  }, [data, onlyActive, sortKey]);

  const actions = (
    <div className="flex flex-wrap gap-1.5">
      {WINDOWS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => pickDays(d)}
          className={`glass-interactive rounded-xl border px-3.5 py-2 text-[12.5px] ${
            days === d ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
          }`}
        >
          近 {d} 天
        </button>
      ))}
      <Button variant="default" onClick={refresh} busy={loading}>
        刷新
      </Button>
    </div>
  );

  if (!data) {
    if (error) {
      return (
        <AdminPage title="用户使用监控" subtitle="所有用户的使用频率、次数、Token 与额度消耗" actions={actions}>
          <ErrorState message={error} onRetry={refresh} />
        </AdminPage>
      );
    }
    return <Loading />;
  }

  const s = data.summary;
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const periodUsedTotal = data.users.reduce((sum, u) => sum + u.periodUsed, 0);
  const features: FeatureView[] = data.features.map((f) => ({
    ...f,
    creationShare: share(f.creations, s.creations),
    tokenShare: share(f.tokens, s.tokens.total),
  }));
  const avgPerActive = s.activeInWindow > 0 ? (s.creations / s.activeInWindow).toFixed(1) : "—";

  return (
    <AdminPage
      title="用户使用监控"
      subtitle={`统计近 ${data.days} 天 · 数据生成于 ${fmtDateTime(data.generatedAt)}`}
      actions={actions}
    >
      {error && <div className="mb-4"><ErrorState message={`最新数据刷新失败：${error}，下面显示的是上一次的结果`} onRetry={refresh} /></div>}
      {data.truncated && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-400">
          数据量超过读取上限，部分数字可能偏少。
        </div>
      )}

      {/* 概览 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="注册用户" value={fmtInt(data.summary.registered)} hint={`窗口内新注册 ${fmtInt(s.newUsers)}`} />
        <StatCard label="窗口内活跃" value={fmtInt(s.activeInWindow)} hint={`占注册 ${share(s.activeInWindow, s.registered)}`} />
        <StatCard label="近 7 天活跃" value={fmtInt(s.active7)} hint={`近 30 天 ${fmtInt(s.active30)}`} />
        <StatCard label="窗口内创作次数" value={fmtInt(s.creations)} hint={`活跃用户人均 ${avgPerActive} 次`} />
        <StatCard label="窗口内 Token" value={fmtBig(s.tokens.total)} hint={s.tokens.perCreation !== null ? `每次创作约 ${fmtInt(s.tokens.perCreation)} tokens` : "窗口内没有创作"} />
        <StatCard label="付费用户" value={fmtInt(s.paidUsers)} hint="付过会员或次数包" />
      </div>

      {/* Token 与额度 */}
      <Panel title="Token 与额度消耗" className="mb-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="提示 Token" value={fmtBig(s.tokens.prompt)} hint={`占 ${share(s.tokens.prompt, s.tokens.total)}`} />
          <StatCard label="回复 Token" value={fmtBig(s.tokens.completion)} hint={`占 ${share(s.tokens.completion, s.tokens.total)}`} />
          <StatCard
            label="估算成本"
            value={s.estimatedCostCny === null ? "—" : `¥${s.estimatedCostCny}`}
            tone={s.estimatedCostCny === null ? "muted" : "default"}
            hint={s.estimatedCostCny === null ? "单价未配置，暂不估算" : "按已配置的单价估算"}
          />
          <StatCard label="会员额度已用（本周期）" value={fmtInt(periodUsedTotal)} hint="所有用户合计，来自 user_quotas" />
          <StatCard label="次数包剩余次数" value={fmtInt(s.packBalance)} hint={`已发放 ${fmtInt(s.packPurchases)} 批（不限购）`} />
        </div>
      </Panel>

      {/* 五维四率 */}
      <div className="mb-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="五维雷达">
          <RadarChart dimensions={data.dimensions} />
        </Panel>
        <Panel title="五维得分与口径">
          <ul className="space-y-3.5">
            {data.dimensions.map((d) => (
              <li key={d.label}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-foreground">{d.label}</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {d.score}
                    <span className="text-[11px] font-normal text-muted-foreground"> / 100</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${d.score}%` }} />
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  {d.raw} · {d.note}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.rates.map((r) => (
          <StatCard
            key={r.label}
            label={r.label}
            value={fmtPct(r.value)}
            hint={`${fmtInt(r.numerator)} / ${fmtInt(r.denominator)} · ${r.note}`}
          />
        ))}
      </div>

      <div className="mb-6">
        <DailyChart daily={data.daily} />
      </div>

      <Panel title="功能使用" className="mb-6">
        <DataTable<FeatureView>
          columns={FEATURE_COLUMNS}
          rows={features}
          rowKey={(f) => f.feature}
          empty="这段时间还没有创作记录"
        />
      </Panel>

      <Panel
        title="用户明细"
        className="mb-6"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="排序"
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setPage(1);
              }}
              className="glass-panel rounded-xl border border-border px-3 py-1.5 text-[12.5px] text-foreground"
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => {
                  setOnlyActive(e.target.checked);
                  setPage(1);
                }}
              />
              只看窗口内有使用的
            </label>
          </div>
        }
      >
        <DataTable<MonitorUserRow>
          columns={USER_COLUMNS}
          rows={pageRows}
          rowKey={(u) => u.userId}
          empty={onlyActive ? "窗口内没有使用记录的用户" : "暂无用户"}
        />
        <Pager page={safePage} pageCount={pageCount} total={users.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Panel title="口径说明">
        <AdminPanelHint>
          活跃指窗口内至少有一次创作；Token 来自创作完成记录的 usage_metadata；额度用量读取 user_quotas；
          次数包余额只计未过期的批次。邮箱已打码，页面不显示完整邮箱。成本单价未配置前不做估算。
        </AdminPanelHint>
      </Panel>
    </AdminPage>
  );
}
