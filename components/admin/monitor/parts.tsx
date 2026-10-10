"use client";

import { useEffect, useRef, useState } from "react";
import { Users, TrendingUp, ChevronDown } from "lucide-react";
import { relativeTime, ONLINE_WINDOW_MIN, type MonitorEvent, type ActiveUser, type RecordRef } from "@/lib/monitor";
import { useMonitorQuery } from '@/hooks/useRealtimeMonitor';


interface FunnelStepView {
  key: string;
  label: string;
  count: number;
  fromPrev: number | null;
}

/**
 * 转化漏斗（规则见 lib/funnel.ts）：首页 → 试用 → 注册页 → 注册 → 出第一条 → 付费。
 * 与主屏共用数据库变更通知，切时间范围后立即取最新统计。
 */
export function FunnelPanel({ revision }: { revision: number }) {
  const [days, setDays] = useState<1 | 7 | 30>(1);
  const { data, error } = useMonitorQuery<{ now: string; steps: FunnelStepView[]; anonymousReady: boolean }>(`/api/admin/funnel?days=${days}`, revision);

  const top = Math.max(1, ...(data?.steps ?? []).map((s) => s.count));

  return (
    <div className="mt-4">
      <Panel
        title="转化漏斗"
        icon={TrendingUp}
        right={
          <div className="flex gap-1">
            {([1, 7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${days === d ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground/85"}`}
              >
                {d === 1 ? '今天' : `近 ${d} 天`}
              </button>
            ))}
          </div>
        }
      >
        {error ? (
          <div className="text-[12.5px] text-rose-300">读取失败：{error}</div>
        ) : !data ? (
          <EmptyBox text="正在统计…" height={120} />
        ) : (
          <>
            <div className="space-y-2">
              {data.steps.map((s, i) => (
                <div key={s.key} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[8rem_1fr_7rem]">
                  <span className="truncate text-[12.5px] text-foreground/85">{s.label}</span>
                  <div className="h-5 overflow-hidden rounded-md bg-foreground/10">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${Math.max(s.count > 0 ? 2 : 0, (s.count / top) * 100)}%`,
                        background: i < 3 ? "hsl(var(--glow-primary) / .55)" : "linear-gradient(90deg,hsl(var(--glow-accent) / .85),hsl(var(--glow-primary) / .9))",
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-[12.5px] tabular-nums text-primary">
                    {s.count}
                    {s.fromPrev !== null && s.key !== 'signup' && <span className="ml-1.5 text-[11px] text-muted-foreground">{s.fromPrev}%</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              数据截至 {stamp(data.now)}:{new Date(data.now).getSeconds().toString().padStart(2, '0')}（北京时间）。前三步按所选时段的匿名访客去重；后三步按{days === 1 ? '今天' : `近 ${days} 天`}注册的同一批账号统计，首次创作不含自由对话和知识库查询，付费以审核通过时间为准。
              匿名访客与注册账号尚未关联，注册这一步不显示转化率；其余百分比为相邻阶段人数比。
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}

/** 「09-26 14:03」：相对时间旁边给个绝对时间，对账时用得上 */
export function stamp(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { timeZone: 'Asia/Shanghai', month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

const HIDDEN = "（已打码）";

/** 一个活跃用户：是谁、什么套餐、名下几个号、最后在做什么、今天用了多少 */
export function ActiveUserCard({
  u, email, hideContent, selected, onSelect,
}: {
  u: ActiveUser; email: string; hideContent: boolean; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-primary/60 bg-primary/[0.08]" : "border-border/60 bg-foreground/[0.03] hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              u.online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.9)]" : "bg-muted-foreground/50"
            }`}
            title={u.online ? `${ONLINE_WINDOW_MIN} 分钟内有操作` : ""}
          />
          <span className="break-all text-[13px] font-medium text-foreground">{email}</span>
        </span>
        <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
          {relativeTime(u.lastAt)}
          <br />
          <span className="text-muted-foreground/70">{stamp(u.lastAt)}</span>
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-violet-200">{u.plan}</span>
        {u.profiles.length ? (
          u.profiles.map((p, i) => (
            <span key={`${p}-${i}`} className="rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-primary/90">
              {p}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">还没建档案</span>
        )}
      </div>

      <div className="mt-1.5 break-all text-[12px] text-foreground/85">
        <span className="text-muted-foreground">最后：</span>
        {hideContent ? u.lastAction.split(" · ")[0] : u.lastAction}
      </div>

      <div className="mt-1 text-[11.5px] text-muted-foreground">
        <span className="text-muted-foreground">今天 </span>
        <span className="font-mono tabular-nums text-primary">{u.todayCount}</span>
        <span className="text-muted-foreground"> 次</span>
        {u.todayFeatures.length > 0 && (
          <span className="text-muted-foreground"> · {u.todayFeatures.map((f) => `${f.name}×${f.count}`).join("、")}</span>
        )}
        {u.registeredAt && <span className="text-muted-foreground/70"> · 注册于 {stamp(u.registeredAt)}</span>}
      </div>
    </button>
  );
}

type RecordDetail = {
  at: string;
  feature: string;
  user?: { email: string; plan: string };
  profiles: string[];
  profile: string;
  work: string;
  fields: { label: string; value: string }[];
  result: string;
  truncated: boolean;
  note?: string;
};

/** 一条动态：谁、哪个档案、用了什么、输入、结果开头；能点开看全文 */
export function EventCard({ e, email, hideContent }: { e: MonitorEvent; email: string; hideContent: boolean }) {
  const [open, setOpen] = useState(false);
  const tone =
    e.level === "urgent"
      ? "border-rose-400 bg-rose-500/[0.10]"
      : e.level === "good"
        ? "border-emerald-400 bg-emerald-500/[0.08]"
        : "border-primary/50 bg-foreground/[0.025]";
  const isUsage = e.type === "usage";
  // 下面一行已经写了是谁，标题里就不再重复邮箱（弹窗提示里的标题仍然带着）
  const heading = isUsage ? e.feature : e.user ? e.title.replace(`${e.user.email} `, "") : e.title;

  return (
    <div className={`rounded-xl border-l-2 px-3 py-2.5 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-all text-[13px] font-medium text-foreground">{heading}</span>
        <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
          {relativeTime(e.at)}
          <br />
          <span className="text-muted-foreground/70">{stamp(e.at)}</span>
        </span>
      </div>

      {(e.user || e.profile) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
          {e.user && <span className="break-all text-foreground">{email}</span>}
          {e.user && <span className="text-violet-300/90">{e.user.plan}</span>}
          {e.profile && (
            <span className="rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-primary/90">
              档案：{e.profile}
            </span>
          )}
          {e.work && !hideContent && <span className="text-muted-foreground">作品：{e.work}</span>}
        </div>
      )}

      {isUsage ? (
        hideContent ? (
          <div className="mt-1 text-[11.5px] text-muted-foreground">{HIDDEN}</div>
        ) : (
          <>
            {e.summary && <div className="mt-1 break-all text-[12px] text-foreground/85">{e.summary}</div>}
            {e.excerpt && (
              <div className="mt-1 line-clamp-2 break-all text-[11.5px] text-muted-foreground">
                <span className="text-muted-foreground">结果：</span>
                {e.excerpt}
              </div>
            )}
          </>
        )
      ) : (
        e.detail && !e.user?.email.includes(e.detail) && (
          <div className="mt-0.5 break-all text-[11.5px] text-muted-foreground">{e.detail}</div>
        )
      )}

      {e.ref && !hideContent && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1.5 flex items-center gap-1 text-[11.5px] text-primary hover:text-primary"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          {open ? "收起" : "看完整记录"}
        </button>
      )}
      {open && e.ref && !hideContent && <RecordView refInfo={e.ref} />}
    </div>
  );
}

/** 点开后才去取这一条的全文——列表每 5 秒轮询一次，不能每次都带几十条全文 */
export function RecordView({ refInfo }: { refInfo: RecordRef }) {
  const [rec, setRec] = useState<RecordDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/monitor/record?kind=${refInfo.kind}&id=${encodeURIComponent(refInfo.id)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `接口返回 ${r.status}`);
        if (alive) setRec(body);
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, [refInfo.kind, refInfo.id]);

  if (error) return <div className="mt-2 text-[12px] text-rose-300">{error}</div>;
  if (!rec) return <div className="mt-2 text-[12px] text-muted-foreground">正在取完整记录…</div>;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-foreground/[0.04] p-3 text-[12px]">
      {rec.note && <div className="text-amber-200/80">{rec.note}</div>}
      {rec.profiles.length > 0 && (
        <div className="text-muted-foreground">
          <span className="text-muted-foreground">他名下的档案：</span>
          {rec.profiles.join("、")}
        </div>
      )}
      {rec.fields.length > 0 && (
        <dl className="space-y-1">
          {rec.fields.map((f, i) => (
            <div key={`${f.label}-${i}`} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="whitespace-pre-wrap break-all text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {rec.result && (
        <div>
          <div className="mb-1 text-muted-foreground">生成结果{rec.truncated ? "（太长，只显示前 2 万字）" : ""}</div>
          <div className="whitespace-pre-wrap break-all leading-relaxed text-foreground">{rec.result}</div>
        </div>
      )}
    </div>
  );
}

/**
 * 数字变化时滚上去，而不是直接跳。
 *
 * 大屏的"活着"感很大一部分来自这个：一个静止的 47 和一个刚从 46 滚上来的 47
 * 给人的感觉完全不同。滚动只在**值真的变了**的时候发生，不是循环动画——
 * 循环的话就变成装饰了，反而分不清哪次是真有新数据。
 */
export function useCountUp(target: number, ms = 600) {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      // easeOutCubic：起步快、收尾稳，比线性自然
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}

export function Kpi({
  icon: Icon, label, value, hint, tone,
}: {
  icon: typeof Users; label: string; value: number | string; hint: string;
  tone: "cyan" | "violet" | "emerald" | "amber";
}) {
  const tones = {
    cyan: { text: "text-primary", border: "border-primary/25", rgb: "34,211,238" },
    violet: { text: "text-violet-300", border: "border-violet-400/25", rgb: "139,92,246" },
    emerald: { text: "text-emerald-300", border: "border-emerald-400/25", rgb: "52,211,153" },
    amber: { text: "text-amber-300", border: "border-amber-400/25", rgb: "251,191,36" },
  } as const;
  const t = tones[tone];

  /*
   * 数字才滚，带货币符号那种直接显示。
   * 硬凑一个通用解析器不值得——这里只有「¥123」一种带前缀的情况。
   */
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  const prefix = typeof value === "string" ? String(value).replace(/[\d.,-]+$/, "") : "";
  const animated = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const display = Number.isFinite(numeric) ? `${prefix}${animated.toLocaleString()}` : String(value);

  return (
    <div
      className={`admin-anim relative overflow-hidden rounded-2xl border bg-foreground/[0.025] p-4 backdrop-blur ${t.border} ${t.text}`}
      style={{ boxShadow: `0 0 28px rgba(${t.rgb},.09)` }}
    >
      {/* 顶边的一道亮线：给每张卡一个"通电"的起点 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,rgba(${t.rgb},.8),transparent)` }}
      />
      {/* 右上角的角标 */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 rounded-tr-2xl border-r border-t"
        style={{ borderColor: `rgba(${t.rgb},.45)` }}
      />

      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11.5px] tracking-[0.14em] text-muted-foreground">{label}</span>
      </div>
      <div className="font-mono text-[36px] leading-none tabular-nums">{display}</div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

/**
 * 空状态。
 *
 * 原来直接写一行灰字摆在大框正中间，越空越显得这块坏了。
 * 改成带网格底纹的占位——看得出"这里本来会有东西"，
 * 而不是"这里什么都没有"。
 */
export function EmptyBox({ text, height = 120 }: { text: string; height?: number }) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-xl"
      style={{ height }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground) / .10) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--foreground) / .10) 1px,transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />
      <span className="relative text-[12.5px] text-muted-foreground">{text}</span>
    </div>
  );
}

/**
 * HUD 面板。
 *
 * 四角的直角括号 + 缓慢扫过的光带，是这块屏"高级感"的来源——
 * 而且它们**不依赖数据**：最近一小时没人用的时候，原来的面板就是
 * 一个空框，现在它仍然在呼吸。真正的直播大屏在闲时也好看，
 * 靠的就是这类环境动效，不是靠把数据堆满。
 */
export function Panel({
  title, icon: Icon, children, right, className = "",
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`admin-anim relative overflow-hidden rounded-2xl border border-primary/15 bg-foreground/[0.02] p-4 backdrop-blur ${className}`}
    >
      {/* 四角括号 */}
      {[
        "left-0 top-0 border-l border-t rounded-tl-2xl",
        "right-0 top-0 border-r border-t rounded-tr-2xl",
        "left-0 bottom-0 border-l border-b rounded-bl-2xl",
        "right-0 bottom-0 border-r border-b rounded-br-2xl",
      ].map((c) => (
        <span
          key={c}
          aria-hidden
          className={`pointer-events-none absolute h-4 w-4 border-primary/45 ${c}`}
        />
      ))}

      {/* 缓慢扫过的光带 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(90deg,transparent,hsl(var(--glow-primary) / .055),transparent)",
          animation: "adminSweep 7s ease-in-out infinite",
        }}
      />

      <h2 className="relative mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] tracking-[0.12em] text-foreground/85">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </span>
        {right}
      </h2>
      <div className="relative">{children}</div>
    </section>
  );
}
