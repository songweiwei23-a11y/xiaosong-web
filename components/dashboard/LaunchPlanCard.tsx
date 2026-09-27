"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Flag, PartyPopper, Rocket } from "lucide-react";
import { LAUNCH_DAYS, LAUNCH_TOTAL, currentLaunchDay } from "@/lib/launch-plan";
import { confirmDialog, notify } from "@/components/ui/feedback";

interface Plan {
  startedAt: string;
  doneDays: number[];
}

const COLLAPSE_KEY = "kaiwu:launch-plan-collapsed";

async function post(body: object): Promise<Plan | null | undefined> {
  const r = await fetch("/api/launch-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "操作失败");
  return d.plan;
}

/**
 * 工作台首页的「7 天起号计划」卡片（规则见 lib/launch-plan.ts）。
 * 没开始：一句话说清是什么 + 开始按钮；进行中：今天这件事放最大，一键直达对应板块；
 * 走完了：告诉他接下来怎么做。
 */
export function LaunchPlanCard({ className = "" }: { className?: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  /*
   * 可以折叠（产品方要的）：展开时整张卡占首页一大块，天天看的人会嫌挡路。
   * 收起后只剩一行"第几天 · 完成几天"和进度条；收没收记在本机，下次进来保持原样。
   */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  useEffect(() => {
    fetch("/api/launch-plan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // 表还没建或接口出错：整张卡不出现，不摆一张点了会报错的卡
        if (!d || d.unavailable) return;
        setPlan(d.plan);
        setReady(true);
      })
      .catch(() => {});
  }, []);

  if (!ready) return null;

  const run = async (body: object, done?: string) => {
    setBusy(true);
    try {
      const next = await post(body);
      setPlan(next ?? null);
      if (done) notify(done);
    } catch (e) {
      notify(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  // 勾选先改界面再存，存失败了退回来——打勾这种小事不该等网络
  const toggle = async (day: number) => {
    if (!plan) return;
    const prev = plan;
    const has = plan.doneDays.includes(day);
    setPlan({ ...plan, doneDays: has ? plan.doneDays.filter((d) => d !== day) : [...plan.doneDays, day].sort((a, b) => a - b) });
    try {
      const next = await post({ action: "toggle", day });
      if (next) setPlan(next);
    } catch (e) {
      setPlan(prev);
      notify(e instanceof Error ? e.message : "保存失败");
    }
  };

  if (!plan) {
    return (
      <section id="launch-plan" className={`scroll-mt-4 glass-panel rounded-2xl p-5 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              className="flex items-center gap-2 text-left text-[16px] font-semibold text-foreground"
            >
              <Rocket className="h-5 w-5 text-primary" />7 天起号计划
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`} />
              <span className="sr-only">{collapsed ? "展开" : "收起"}</span>
            </button>
            {!collapsed && (
              <>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  不知道从哪开始？每天做一件小事，7 天发出 7 条视频。不考核播放量，做完就打勾。
                </p>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {LAUNCH_DAYS.map((d) => (
                    <span key={d.day} className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-[11px] text-muted-foreground">
                      {d.day}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "start" }, "开始了！今天是第 1 天")}
            className="brand-gradient flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            开始第 1 天 <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  const today = currentLaunchDay(plan.startedAt);
  const doneCount = plan.doneDays.length;
  const allDone = doneCount >= LAUNCH_TOTAL;
  const over = today > LAUNCH_TOTAL;
  // 今天该做的：计划期内就是今天那天；过期了就是第一件没做的
  const focusDay = over ? LAUNCH_DAYS.find((d) => !plan.doneDays.includes(d.day)) : LAUNCH_DAYS[today - 1];

  return (
    <section id="launch-plan" className={`scroll-mt-4 glass-panel rounded-2xl p-5 ${className}`}>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-[16px] font-semibold text-foreground">
          <Rocket className="h-5 w-5 text-primary" />7 天起号计划
          {!allDone && !over && <span className="text-[13px] font-normal text-muted-foreground">· 今天第 {today} 天</span>}
        </span>
        <span className="flex items-center gap-2 text-[12.5px] tabular-nums text-muted-foreground">
          已完成 {doneCount} / {LAUNCH_TOTAL}
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          <span className="sr-only">{collapsed ? "展开" : "收起"}</span>
        </span>
      </button>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${(doneCount / LAUNCH_TOTAL) * 100}%` }} />
      </div>

      {!collapsed && (<>
      {allDone ? (
        <div className="mt-4 rounded-xl bg-primary/[0.07] p-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <PartyPopper className="h-5 w-5 text-primary" />7 天走完了，你已经发了 7 条
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            接下来：每周固定拍 3 条，把数据最好那条的打法多拍几次。想再跟一轮，就从头再来。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run({ action: "start" }, "新一轮开始了")} className="rounded-xl border border-primary/50 px-4 py-2 text-[13px] text-foreground hover:bg-primary/10">
              再来一轮
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await confirmDialog("收起起号计划？完成记录会清掉，以后可以重新开始。", { confirmText: "收起", title: "收起计划" })) run({ action: "quit" });
              }}
              className="rounded-xl px-4 py-2 text-[13px] text-muted-foreground hover:bg-foreground/[0.06]"
            >
              收起
            </button>
          </div>
        </div>
      ) : (
        focusDay && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
            <div className="text-[12px] text-primary">
              {over ? `计划已过 ${LAUNCH_TOTAL} 天，接着把没做的补上` : `第 ${focusDay.day} 天`}
            </div>
            <div className="mt-1 text-[16px] font-semibold leading-snug text-foreground">{focusDay.title}</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{focusDay.why}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={focusDay.href} className="brand-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white">
                {focusDay.cta} <ArrowRight className="h-4 w-4" />
              </Link>
              {!plan.doneDays.includes(focusDay.day) && (
                <button type="button" onClick={() => toggle(focusDay.day)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13px] text-foreground hover:bg-foreground/[0.06]">
                  <Check className="h-4 w-4" />
                  这件做完了
                </button>
              )}
            </div>
          </div>
        )
      )}

      <ol className="mt-3 space-y-1">
        {LAUNCH_DAYS.map((d) => {
          const done = plan.doneDays.includes(d.day);
          const isToday = !over && d.day === today;
          const missed = !done && d.day < today;
          return (
            <li key={d.day} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isToday ? "bg-foreground/[0.04]" : ""}`}>
              <button
                type="button"
                onClick={() => toggle(d.day)}
                aria-pressed={done}
                aria-label={`第 ${d.day} 天：${done ? "已完成，点一下取消" : "标记为完成"}`}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors ${
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : d.day}
              </button>
              <Link href={d.href} className={`min-w-0 flex-1 truncate text-[13px] hover:text-primary ${done ? "text-muted-foreground line-through" : d.day > today ? "text-muted-foreground" : "text-foreground"}`}>
                {d.title}
              </Link>
              {isToday && !done && (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-primary">
                  <Flag className="h-3 w-3" />今天
                </span>
              )}
              {missed && <span className="shrink-0 text-[11px] text-amber-500">可以补上</span>}
            </li>
          );
        })}
      </ol>
      </>)}
    </section>
  );
}
