"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Activity, Bell, BellOff, Users, Zap, Wallet, AlertTriangle,
  Wifi, WifiOff, TrendingUp,
} from "lucide-react";
import {
  relativeTime, soundFor, newEventsSince, rememberSeen,
  ONLINE_WINDOW_MIN,
  type MonitorEvent,
} from "@/lib/monitor";

/**
 * 实时监控大屏。
 *
 * 【为什么要有声音】管理员不会一直盯着屏幕。真正需要他立刻动手的只有一件事：
 * 有人传了转账凭证等着审核——用户已经把钱打过来了，晾着就是在赔信任。
 * 所以提示音分三级，充值类必须最响、最不一样。
 *
 * 【浏览器会拦截自动播放】没有用户手势之前，任何音频都出不来，而且是静默失败。
 * 所以必须有个显式的「开启声音」按钮，点过之后才解锁 AudioContext。
 * 不做这一步的话，界面看着一切正常，就是永远不响。
 *
 * 【首次加载不补响】进页面时会一次性拿到几十条历史事件，
 * 逐条响铃会炸出一串噪音。第一次只记下"这些我见过了"，之后才响。
 */

type Snapshot = {
  now: string;
  online: { name: string; minutesAgo: number }[];
  today: { generations: number; newUsers: number; orders: number; revenue: number };
  totals: { users: number; generations: number; pendingReview: number; pendingPay: number };
  pulse: number[];
  byFeature: { name: string; count: number }[];
  events: MonitorEvent[];
};

const POLL_MS = 5000;

/** 用 Web Audio 合成提示音，不引入任何音频文件 */
function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const unlock = useCallback(async () => {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;
      // Safari/Chrome 在没有手势时是 suspended 状态，必须显式 resume
      if (ctx.state === "suspended") await ctx.resume();
      setEnabled(true);
      return true;
    } catch {
      setEnabled(false);
      return false;
    }
  }, []);

  const play = useCallback(
    (kind: "ping" | "chime" | "alert") => {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;

      // 三种音色差别要足够大——隔着房间也能听出是不是"有人要付钱"
      const spec: Record<string, { notes: number[]; dur: number; gain: number; type: OscillatorType }> = {
        ping: { notes: [880], dur: 0.09, gain: 0.05, type: "sine" },
        chime: { notes: [660, 880], dur: 0.14, gain: 0.08, type: "triangle" },
        alert: { notes: [988, 1319, 988, 1319], dur: 0.16, gain: 0.13, type: "square" },
      };
      const s = spec[kind];

      s.notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = s.type;
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + i * s.dur;
        // 直接切断会有"咔哒"声，用包络淡入淡出
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(s.gain, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + s.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + s.dur + 0.02);
      });
    },
    []
  );

  const disable = useCallback(() => setEnabled(false), []);

  /*
   * 必须 memo。不 memo 的话每次渲染都是一个新对象，
   * 依赖它的 tick 跟着变 → 轮询的 effect 每渲染重建一次 → 立刻又拉一次
   * → setState → 再渲染，变成轮询风暴。实测时就是这个形态。
   */
  return useMemo(
    () => ({ enabled, unlock, play, disable }),
    [enabled, unlock, play, disable]
  );
}

export default function MonitorPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<MonitorEvent | null>(null);
  const [clock, setClock] = useState("");

  const sound = useSound();
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  /*
   * play 放进 ref 再用。tick 直接依赖 sound.play 的话，
   * 开关声音会让 tick 变身份、进而重建轮询 effect——
   * 点一下"开启声音"就多出一条定时器。
   */
  const playRef = useRef(sound.play);
  playRef.current = sound.play;

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("zh-CN", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const tick = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/monitor", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `接口返回 ${res.status}`);
      }
      const data: Snapshot = await res.json();
      setSnap(data);
      setErr("");
      setLive(true);

      const events = data.events ?? [];
      const wasFirst = firstLoadRef.current;
      const fresh = newEventsSince(events, seenRef.current, wasFirst);

      seenRef.current = rememberSeen(seenRef.current, events);
      firstLoadRef.current = false;

      if (fresh.length) {
        // 一轮里有多条时，只按最要紧的那条响一次，避免连珠炮
        const top =
          fresh.find((e) => e.level === "urgent") ??
          fresh.find((e) => e.level === "good") ??
          fresh[0];
        playRef.current(soundFor(top.type));
        setFlash(top);
        setTimeout(() => setFlash(null), 6000);
      }
    } catch (e: unknown) {
      setLive(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
    // 依赖为空：tick 的身份必须稳定，否则轮询 effect 会被反复重建
  }, []);

  useEffect(() => {
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [tick]);

  const pulse = snap?.pulse ?? [];
  const peak = Math.max(1, ...pulse);
  const needsAction = (snap?.totals.pendingReview ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      {/* 背景网格 + 光晕，纯 CSS，不引额外依赖 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.25) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle,rgba(34,211,238,.20),transparent 65%)" }}
      />

      <div className="relative mx-auto max-w-[1600px] px-6 py-6">
        {/* 顶栏 */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
              )}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${live ? "bg-cyan-400" : "bg-rose-500"}`} />
            </span>
            <h1 className="text-[22px] font-semibold tracking-[0.2em] text-cyan-300">
              实时监控中心
            </h1>
            <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-300">
              {live ? `每 ${POLL_MS / 1000} 秒刷新` : "连接中断"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[26px] tabular-nums tracking-wider text-cyan-200">{clock}</span>
            <button
              onClick={() => (sound.enabled ? sound.disable() : sound.unlock())}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] transition-colors ${
                sound.enabled
                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                  : "border-amber-400/50 bg-amber-400/10 text-amber-300"
              }`}
            >
              {sound.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {sound.enabled ? "声音已开" : "点击开启声音"}
            </button>
          </div>
        </header>

        {/* 浏览器拦截自动播放，不说清楚用户会以为坏了 */}
        {!sound.enabled && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-2.5 text-[12.5px] text-amber-200/90">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            浏览器规定：没有点击过页面就不允许播声音。点右上角那个按钮才会响。
          </div>
        )}

        {err && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-[12.5px] text-rose-200">
            <WifiOff className="h-4 w-4 shrink-0" />
            拉不到数据：{err}
          </div>
        )}

        {/* 待办横幅：有人把钱打过来了，这是唯一必须立刻处理的 */}
        {needsAction && (
          <a
            href="/admin/orders"
            className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-rose-400/50 bg-gradient-to-r from-rose-500/20 to-orange-500/10 px-5 py-4 transition-transform hover:scale-[1.005]"
          >
            <span className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
              </span>
              <span className="text-[15px] font-semibold text-rose-100">
                有 {snap!.totals.pendingReview} 笔转账凭证等你审核
              </span>
            </span>
            <span className="text-[13px] text-rose-200/80">点这里去处理 →</span>
          </a>
        )}

        {/* KPI */}
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Users} label="最近活跃" value={snap?.online.length ?? 0}
               hint={`${ONLINE_WINDOW_MIN} 分钟内登录过`} tone="cyan" />
          <Kpi icon={Zap} label="今日生成" value={snap?.today.generations ?? 0}
               hint={`累计 ${snap?.totals.generations ?? 0} 次`} tone="violet" />
          <Kpi icon={TrendingUp} label="今日新注册" value={snap?.today.newUsers ?? 0}
               hint={`总用户 ${snap?.totals.users ?? 0}`} tone="emerald" />
          <Kpi icon={Wallet} label="今日入账" value={`¥${snap?.today.revenue ?? 0}`}
               hint={`待付款 ${snap?.totals.pendingPay ?? 0} 笔`} tone="amber" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* 左：脉搏 + 功能分布 */}
          <div className="space-y-4">
            <Panel title="最近一小时活跃脉搏" icon={Activity}>
              <div className="flex h-[150px] items-end gap-[3px]">
                {pulse.map((v, i) => (
                  <div
                    key={i}
                    title={`${pulse.length - 1 - i} 分钟前：${v} 次`}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(2, (v / peak) * 100)}%`,
                      background:
                        v === 0
                          ? "rgba(148,163,184,.13)"
                          : "linear-gradient(to top,rgba(34,211,238,.35),rgba(34,211,238,.95))",
                      boxShadow: v > 0 ? "0 0 10px rgba(34,211,238,.45)" : "none",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>60 分钟前</span>
                <span>峰值 {peak} 次/分</span>
                <span>现在</span>
              </div>
            </Panel>

            <Panel title="今日各功能用量" icon={Zap}>
              {(snap?.byFeature ?? []).length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-500">今天还没有人生成内容</p>
              ) : (
                <div className="space-y-2.5">
                  {snap!.byFeature.slice(0, 8).map((f) => {
                    const max = snap!.byFeature[0].count || 1;
                    return (
                      <div key={f.name} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 truncate text-[12.5px] text-slate-300">{f.name}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-500/15">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(f.count / max) * 100}%`,
                              background: "linear-gradient(90deg,rgba(139,92,246,.85),rgba(34,211,238,.9))",
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-[12.5px] tabular-nums text-cyan-300">
                          {f.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* 右：在线 + 事件流 */}
          <div className="space-y-4">
            <Panel title={`最近活跃用户（${snap?.online.length ?? 0}）`} icon={Wifi}>
              {(snap?.online ?? []).length === 0 ? (
                <p className="py-4 text-center text-[13px] text-slate-500">
                  {ONLINE_WINDOW_MIN} 分钟内没有人登录
                </p>
              ) : (
                <div className="space-y-1.5">
                  {snap!.online.slice(0, 8).map((u) => (
                    <div key={u.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="flex items-center gap-2 text-[12.5px] text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.9)]" />
                        {u.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {u.minutesAgo < 1 ? "刚刚" : `${u.minutesAgo} 分钟前`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="实时动态" icon={Activity}>
              <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                {(snap?.events ?? []).length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-slate-500">暂无动态</p>
                ) : (
                  snap!.events.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded-lg border-l-2 px-3 py-2 ${
                        e.level === "urgent"
                          ? "border-rose-400 bg-rose-500/[0.10]"
                          : e.level === "good"
                            ? "border-emerald-400 bg-emerald-500/[0.08]"
                            : "border-cyan-400/50 bg-white/[0.025]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] text-slate-100">{e.title}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">{relativeTime(e.at)}</span>
                      </div>
                      {e.detail && <div className="mt-0.5 text-[11px] text-slate-400">{e.detail}</div>}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* 新事件弹一下，声音之外再给个眼睛能看到的信号 */}
      {flash && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur ${
            flash.level === "urgent"
              ? "border-rose-400/60 bg-rose-500/20"
              : flash.level === "good"
                ? "border-emerald-400/60 bg-emerald-500/20"
                : "border-cyan-400/50 bg-cyan-500/15"
          }`}
        >
          <div className="text-[14px] font-medium text-white">{flash.title}</div>
          {flash.detail && <div className="mt-1 text-[12px] text-white/75">{flash.detail}</div>}
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, hint, tone,
}: {
  icon: typeof Users; label: string; value: number | string; hint: string;
  tone: "cyan" | "violet" | "emerald" | "amber";
}) {
  const tones = {
    cyan: "text-cyan-300 border-cyan-400/25 shadow-[0_0_28px_rgba(34,211,238,.10)]",
    violet: "text-violet-300 border-violet-400/25 shadow-[0_0_28px_rgba(139,92,246,.10)]",
    emerald: "text-emerald-300 border-emerald-400/25 shadow-[0_0_28px_rgba(52,211,153,.10)]",
    amber: "text-amber-300 border-amber-400/25 shadow-[0_0_28px_rgba(251,191,36,.10)]",
  } as const;

  return (
    <div className={`rounded-2xl border bg-white/[0.025] p-4 backdrop-blur ${tones[tone]}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[12px] tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="font-mono text-[34px] leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function Panel({
  title, icon: Icon, children,
}: {
  title: string; icon: typeof Users; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] tracking-wider text-slate-300">
        <Icon className="h-4 w-4 text-cyan-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}
