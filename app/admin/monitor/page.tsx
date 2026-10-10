"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Activity, Bell, BellOff, Users, Zap, Wallet, AlertTriangle, Wifi, WifiOff, TrendingUp, Eye, EyeOff, X } from "lucide-react";
import { soundFor, newEventsSince, rememberSeen, maskEmail, ONLINE_WINDOW_MIN, ACTIVE_WINDOW_HOURS, type MonitorEvent, type ActiveUser } from "@/lib/monitor";
import { useMonitorQuery, useRealtimeMonitor } from '@/hooks/useRealtimeMonitor';
import { scheduleSound, createOutput, DEFAULT_VOLUME, type SoundKind } from "@/lib/monitor-sound";
import { FunnelPanel, ActiveUserCard, EventCard, Kpi, EmptyBox, Panel } from '@/components/admin/monitor/parts';

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
  /** 24 小时内有动静的人，带完整邮箱、档案、最后做了什么、今天用了几次 */
  active: ActiveUser[];
  onlineCount: number;
  today: { generations: number; newUsers: number; orders: number; revenue: number };
  totals: { users: number; generations: number; pendingReview: number; pendingPay: number };
  pulse: number[];
  byFeature: { name: string; count: number }[];
  events: MonitorEvent[];
};

/** 用 Web Audio 合成提示音，不引入任何音频文件 */
const VOLUME_KEY = "kaiwu-monitor-volume";

function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const outRef = useRef<GainNode | null>(null);
  const [enabled, setEnabled] = useState(false);
  // 音量记在本机浏览器里；读不到（隐私模式等）就用默认
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(VOLUME_KEY));
      if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v)) setVolumeState(Math.min(1, Math.max(0, v)));
    } catch {}
  }, []);

  const unlock = useCallback(async () => {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;
      if (!outRef.current) outRef.current = createOutput(ctx, volume);
      // Safari/Chrome 在没有手势时是 suspended 状态，必须显式 resume
      if (ctx.state === "suspended") await ctx.resume();
      setEnabled(true);
      // 开声音时响一下"叮咚"：既确认真的能响，也让人知道现在多大声
      scheduleSound(ctx, outRef.current, "chime");
      return true;
    } catch {
      setEnabled(false);
      return false;
    }
  }, [volume]);

  const play = useCallback((kind: SoundKind) => {
    const ctx = ctxRef.current;
    const out = outRef.current;
    if (!ctx || !out || ctx.state !== "running") return;
    // 三种音色差别要足够大——隔着房间也能听出是不是"有人要付钱"（音色见 lib/monitor-sound）
    scheduleSound(ctx, out, kind);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    const ctx = ctxRef.current;
    if (ctx && outRef.current) outRef.current.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch {}
  }, []);

  const disable = useCallback(() => setEnabled(false), []);

  // 声音状态保持独立，不重建实时通知源或数据请求。
  return useMemo(
    () => ({ enabled, unlock, play, disable, volume, setVolume }),
    [enabled, unlock, play, disable, volume, setVolume]
  );
}

export default function MonitorPage() {
  const { revision, mode, connectionError } = useRealtimeMonitor();
  const { data: snap, error } = useMonitorQuery<Snapshot>('/api/admin/monitor', revision);
  const err = error || connectionError;
  const live = !!snap && !error;
  const [flash, setFlash] = useState<MonitorEvent | null>(null);
  const [clock, setClock] = useState("");
  /*
   * 投屏打码。默认不打——管理员要看清是谁、做了什么；
   * 大屏投到会议室或要截图外发时，自己点一下遮住邮箱和内容。记在本机。
   */
  const [privacy, setPrivacy] = useState(false);
  /** 点了某个活跃用户：动态只看他的 */
  const [focusUser, setFocusUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    try {
      setPrivacy(localStorage.getItem("monitor-privacy") === "1");
    } catch {}
  }, []);
  const togglePrivacy = () => {
    setPrivacy((p) => {
      try {
        localStorage.setItem("monitor-privacy", p ? "0" : "1");
      } catch {}
      return !p;
    });
  };
  const showEmail = (email: string) => (privacy ? maskEmail(email) : email);

  const sound = useSound();
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  /*
   * 通过 ref 读取当前播放函数；开关声音不触发历史事件重新播放。
   */
  const playRef = useRef(sound.play);
  playRef.current = sound.play;

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("zh-CN", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
      if (!snap) return;
      const events = snap.events ?? [];
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
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 6000);
      }
  }, [snap]);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const pulse = snap?.pulse ?? [];
  const peak = Math.max(1, ...pulse);

  /*
   * 把 60 个分钟桶画成心电图的路径。
   *
   * 留 12px 的底边：全是 0 的时候线才不会贴着边框，
   * 看起来像"基线"而不是"图没画出来"。
   */
  const { pulseLine, pulseArea } = (() => {
    const W = 600, H = 168, PAD = 12;
    const pts = (pulse.length ? pulse : new Array(60).fill(0)).map((v, i, arr) => {
      const x = (i / Math.max(1, arr.length - 1)) * W;
      const y = H - PAD - (v / peak) * (H - PAD * 2);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return {
      pulseLine: line,
      pulseArea: `${line} L${W},${H} L0,${H} Z`,
    };
  })();
  const needsAction = (snap?.totals.pendingReview ?? 0) > 0;

  return (
    <div className="relative min-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl text-foreground">
      {/* 背景网格 + 光晕，纯 CSS，不引额外依赖 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--glow-primary) / .25) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--glow-primary) / .25) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle,hsl(var(--glow-primary) / .20),transparent 65%)" }}
      />

      <div className="relative mx-auto max-w-[1600px] px-6 py-6">
        {/*
          顶栏。做成仪表台的样子：标题下面带一行英文代号和状态，
          时间用大字号等宽——这两样是"大屏感"最便宜也最有效的来源。
        */}
        <header className="admin-anim relative mb-5 overflow-hidden rounded-2xl border border-primary/15 bg-foreground/[0.02] px-5 py-4 backdrop-blur">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg,transparent,hsl(var(--glow-primary) / .75),transparent)" }}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="relative flex h-3 w-3">
                {live && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                )}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${live ? "bg-primary" : "bg-rose-500"}`} />
              </span>
              <div>
                <h1 className="text-[21px] font-semibold leading-none tracking-[0.22em] text-primary">
                  实时监控中心
                </h1>
                <p className="mt-1.5 flex items-center gap-2 text-[10px] tracking-[0.22em] text-primary/60">
                  <span>LIVE OPS MONITOR</span>
                  <span className="h-2.5 w-px bg-primary/25" />
                  <span>{live ? mode === 'realtime' ? 'LIVE PUSH' : '1S REFRESH' : "DISCONNECTED"}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="text-right">
                <div className="font-mono text-[28px] leading-none tabular-nums tracking-[0.08em] text-primary">
                  {clock || "--:--:--"}
                </div>
                <div className="mt-1 text-[10px] tracking-[0.2em] text-primary/50">
                  {new Date().toLocaleDateString("zh-CN")}
                </div>
              </div>
              <button
                onClick={togglePrivacy}
                title="投屏或截图外发前点一下：遮住邮箱和生成内容"
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] transition-colors ${
                  privacy
                    ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                    : "border-border bg-foreground/[0.03] text-foreground/85"
                }`}
              >
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {privacy ? "已打码" : "投屏打码"}
              </button>
              <button
                onClick={() => (sound.enabled ? sound.disable() : sound.unlock())}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] transition-colors ${
                  sound.enabled
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-amber-400/50 bg-amber-400/10 text-amber-300"
                }`}
              >
                {sound.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                {sound.enabled ? "声音已开" : "点击开启声音"}
              </button>
              {sound.enabled && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-foreground/[0.03] px-3 py-1.5 text-[12px] text-primary">
                  <span className="shrink-0">音量</span>
                  <input
                    type="range"
                    aria-label="提示音音量"
                    min={0}
                    max={1}
                    step={0.05}
                    value={sound.volume}
                    onChange={(e) => sound.setVolume(Number(e.target.value))}
                    className="w-20 accent-primary"
                  />
                  {([
                    ["ping", "使用"],
                    ["chime", "上线"],
                    ["alert", "付款"],
                  ] as const).map(([kind, label]) => (
                    <button
                      key={kind}
                      onClick={() => sound.play(kind)}
                      title={`试听「${label}」提示音`}
                      className="rounded-md border border-primary/30 px-1.5 py-0.5 hover:bg-primary/10"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 浏览器拦截自动播放，不说清楚用户会以为坏了。
              并进顶栏而不是单占一行——它是常驻提示，不该每次都抢一整条版面 */}
          {!sound.enabled && (
            <div className="mt-3 flex items-center gap-2 border-t border-amber-400/15 pt-3 text-[11.5px] text-amber-200/80">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              浏览器规定：没有点击过页面就不允许播声音。点上面那个按钮才会响。
            </div>
          )}
        </header>

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
          <Kpi icon={Users} label="正在用" value={snap?.onlineCount ?? 0}
               hint={`${ONLINE_WINDOW_MIN} 分钟内有操作 · ${ACTIVE_WINDOW_HOURS} 小时内 ${snap?.active.length ?? 0} 人`} tone="cyan" />
          <Kpi icon={Zap} label="今日生成" value={snap?.today.generations ?? 0}
               hint={`累计 ${snap?.totals.generations ?? 0} 次`} tone="violet" />
          <Kpi icon={TrendingUp} label="今日新注册" value={snap?.today.newUsers ?? 0}
               hint={`总用户 ${snap?.totals.users ?? 0}`} tone="emerald" />
          <Kpi icon={Wallet} label="今日入账" value={`¥${snap?.today.revenue ?? 0}`}
               hint={`待付款 ${snap?.totals.pendingPay ?? 0} 笔`} tone="amber" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* 上排：脉搏 + 功能分布 */}
            <Panel
              title="最近一小时活跃脉搏"
              icon={Activity}
              right={
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                    style={{ animation: "adminFlicker 1.6s ease-in-out infinite" }}
                  />
                  {pulse.some((v) => v > 0) ? `峰值 ${peak} 次/分` : "静默"}
                </span>
              }
            >
              {/*
                原来这里只有 60 根柱子。最近一小时没人用的时候（线上常态），
                所有柱子都贴底，整块就是一个空框——截图里就是这样。
                改成心电图式：底纹网格 + 基线 + 面积填充 + 一个来回扫的光标。
                数据为零时它是一条平线，但仍然在动——不假装有活动，
                只是让"没有活动"这件事也有个像样的呈现。
              */}
              <div className="relative h-[168px] w-full">
                {/*
                  横向刻度线 + 刻度值。
                  加数值是为了让"线贴在底部"读成"当前是 0"，
                  而不是"这个图没画出来"——没有刻度的话，
                  空白区域就只是空白。
                */}
                {[0, 0.5, 1].map((r) => (
                  <div key={r} className="pointer-events-none absolute inset-x-0" style={{ bottom: `${r * 100}%` }}>
                    <span
                      aria-hidden
                      className="absolute inset-x-0 h-px"
                      style={{ background: "hsl(var(--foreground) / .13)" }}
                    />
                    {/* z-10：后面那个 <svg> 是兄弟元素，不加的话发光的折线会压在刻度值上 */}
                    <span className="absolute -top-2 left-0 z-10 bg-background pr-1.5 font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                      {Math.round(peak * r)}
                    </span>
                  </div>
                ))}

                <svg
                  viewBox="0 0 600 168"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                >
                  <defs>
                    <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={pulseArea} fill="url(#pulseFill)" />
                  <path
                    d={pulseLine}
                    fill="none"
                    stroke="rgb(34,211,238)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 6px hsl(var(--glow-primary) / .75))" }}
                  />
                </svg>

                {/* 来回扫的光标。不依赖数据，静默时这块也不会死掉 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-px bg-primary/50"
                  style={{
                    animation: "adminScanX 5.5s ease-in-out infinite",
                    boxShadow: "0 0 12px 2px hsl(var(--glow-primary) / .4)",
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>60 分钟前</span>
                <span className="tabular-nums">
                  合计 {pulse.reduce((a, b) => a + b, 0)} 次
                </span>
                <span>现在</span>
              </div>
            </Panel>

            <Panel title="今日各功能用量" icon={Zap}>
              {(snap?.byFeature ?? []).length === 0 ? (
                <EmptyBox text="今天还没有人生成内容" height={140} />
              ) : (
                <div className="space-y-2.5">
                  {snap!.byFeature.slice(0, 8).map((f) => {
                    const max = snap!.byFeature[0].count || 1;
                    return (
                      <div key={f.name} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 truncate text-[12.5px] text-foreground/85">{f.name}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(f.count / max) * 100}%`,
                              background: "linear-gradient(90deg,hsl(var(--glow-accent) / .85),hsl(var(--glow-primary) / .9))",
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-[12.5px] tabular-nums text-primary">
                          {f.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
        </div>

        {/*
          下排：谁在用、做了什么。
          原来挤在右边窄栏里，只有打了码的邮箱和"有人在用「脚本生成」"——
          看不出是谁、哪个号、写的什么，管理员没法据此判断产品的真实状况。
          现在单独一整排，写全：完整邮箱、套餐、档案、输入、结果，点开看全文。
        */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <Panel
            title={`最近活跃用户（${snap?.active.length ?? 0}）`}
            icon={Wifi}
            right={<span className="text-[11px] text-muted-foreground">{ACTIVE_WINDOW_HOURS} 小时内 · 点一个人只看他的动态</span>}
          >
            {(snap?.active ?? []).length === 0 ? (
              <EmptyBox text={`${ACTIVE_WINDOW_HOURS} 小时内没有人用过`} height={120} />
            ) : (
              <div className="space-y-2 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
                {snap!.active.map((u) => (
                  <ActiveUserCard
                    key={u.id}
                    u={u}
                    email={showEmail(u.email)}
                    hideContent={privacy}
                    selected={focusUser?.id === u.id}
                    onSelect={() => setFocusUser(focusUser?.id === u.id ? null : { id: u.id, email: u.email })}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="实时动态"
            icon={Activity}
            right={
              focusUser ? (
                <button
                  onClick={() => setFocusUser(null)}
                  className="flex min-w-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                >
                  <span className="truncate">只看 {showEmail(focusUser.email)}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">谁 · 哪个档案 · 输入了什么 · 生成了什么</span>
              )
            }
          >
            {(() => {
              const list = (snap?.events ?? []).filter((e) => !focusUser || e.user?.id === focusUser.id);
              if (list.length === 0) {
                return <EmptyBox text={focusUser ? "最近的动态里没有这个人的记录" : "暂无动态"} height={120} />;
              }
              return (
                <div className="space-y-2 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
                  {list.map((e) => (
                    <EventCard key={e.id} e={e} email={e.user ? showEmail(e.user.email) : ""} hideContent={privacy} />
                  ))}
                </div>
              );
            })()}
          </Panel>
        </div>

        {/* 转化漏斗：每次改首页、改引导，看这里知道有没有用 */}
        <FunnelPanel revision={revision} />

        {/*
          底部状态条。
          原来页面下半屏是一大片空白——不是因为没东西可放，
          而是这些数字散落在各处没人汇总。放成一条等宽的状态带，
          既填了版面，也回答了"整体什么情况"这个问题。
        */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-primary/15 bg-primary/10 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: "数据链路", v: live ? mode === 'realtime' ? '实时推送' : '秒级更新' : "中断", ok: live },
            { k: "刷新间隔", v: mode === 'realtime' ? '变更即刷新' : '1 秒', ok: live },
            { k: "声音提醒", v: sound.enabled ? "已开" : "未开", ok: sound.enabled },
            { k: "待审订单", v: String(snap?.totals.pendingReview ?? 0), ok: (snap?.totals.pendingReview ?? 0) === 0 },
            { k: "待付款", v: String(snap?.totals.pendingPay ?? 0), ok: true },
            { k: "累计生成", v: String(snap?.totals.generations ?? 0), ok: true },
          ].map((x) => (
            <div key={x.k} className="bg-card px-4 py-3">
              <div className="text-[10.5px] tracking-[0.16em] text-muted-foreground">{x.k}</div>
              <div
                className={`mt-1 font-mono text-[15px] tabular-nums ${
                  x.ok ? "text-primary" : "text-rose-400"
                }`}
              >
                {x.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 新事件弹一下，声音之外再给个眼睛能看到的信号 */}
      {flash && (
        <div
          className={`fixed inset-x-4 bottom-4 z-50 rounded-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm border px-5 py-4 shadow-2xl backdrop-blur ${
            flash.level === "urgent"
              ? "border-rose-400/60 bg-rose-500/20"
              : flash.level === "good"
                ? "border-emerald-400/60 bg-emerald-500/20"
                : "border-primary/50 bg-primary/15"
          }`}
        >
          <div className="break-all text-[14px] font-medium text-white">
            {privacy && flash.user ? flash.title.replace(flash.user.email, maskEmail(flash.user.email)) : flash.title}
          </div>
          {flash.detail && !(privacy && flash.type === "usage") && (
            <div className="mt-1 line-clamp-2 break-all text-[12px] text-white/75">
              {privacy && flash.user ? flash.detail.replace(flash.user.email, maskEmail(flash.user.email)) : flash.detail}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
