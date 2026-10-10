"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { FACTS, SHOWCASE_CARDS, SHOWCASE_STRUCTURES, SHOWCASE_TACTICS } from "@/lib/showcase";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";

/**
 * 登录页的几处小温度（2026-10-04 产品方：加点惊喜、温馨，让人更想点进去）：
 *   - 按时段问候；这台电脑上登录过的，叫得出名字（只存邮箱 @ 前面那段，在本机，「不是你？」一键清掉）
 *   - 今日一计：还没登录先送一招真编导方法（每天换，可「换一个」）
 *   - 注册时说清楚送什么（从套餐配置算，不手写）
 * 本机存储读写都包在 try 里：隐私模式、禁用存储时照常显示，只是不认人。
 */
const NAME_KEY = "kaiwu:login-name";

export function rememberLoginName(email: string) {
  const name = email.includes("@") ? email.split("@")[0].slice(0, 20) : "";
  try { if (name) window.localStorage.setItem(NAME_KEY, name); } catch { /* 存不了就下次不认人 */ }
}

/** 按小时问候。深夜那句是心疼，不是催 */
export function greetingFor(hour: number, isLogin: boolean): { title: string; sub: string } {
  if (!isLogin) return { title: "欢迎来到开物 👋", sub: "凭邀请码注册，即送免费体验额度，先写一条试试" };
  if (hour >= 5 && hour < 11) return { title: "早上好 ☀️", sub: "趁脑子清醒，先定今天拍什么" };
  if (hour >= 11 && hour < 14) return { title: "中午好 🍜", sub: "吃饭的空档，来一条选题" };
  if (hour >= 14 && hour < 18) return { title: "下午好 ☕", sub: "泡杯茶，把脚本打磨一下" };
  if (hour >= 18 && hour < 23) return { title: "晚上好 🌆", sub: "收工了？把明天要拍的准备好" };
  return { title: "夜深了 🌙", sub: "还在琢磨内容？辛苦了，弄完早点休息" };
}

export function LoginGreeting({ isLogin }: { isLogin: boolean }) {
  // 时间和名字只在浏览器里算：服务端渲染不知道访客几点、是谁，先渲染会对不上
  const [state, setState] = useState<{ hour: number; name: string } | null>(null);
  useEffect(() => {
    let name = "";
    try { name = window.localStorage.getItem(NAME_KEY) || ""; } catch { /* 读不到就不认人 */ }
    setState({ hour: new Date().getHours(), name });
  }, []);
  if (!state) return <div className="mb-5 h-[52px]" aria-hidden />;
  const g = greetingFor(state.hour, isLogin);
  const welcomeBack = isLogin && state.name;
  return (
    <div className="mb-5 text-center animate-in fade-in duration-500">
      <p className="text-lg font-semibold text-foreground">
        {welcomeBack ? <>欢迎回来，{state.name} 👋</> : g.title}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {welcomeBack ? g.title.replace(/\s.*$/, "，") + g.sub : g.sub}
        {welcomeBack && (
          <button
            type="button"
            onClick={() => { try { window.localStorage.removeItem(NAME_KEY); } catch { /* 无妨 */ } setState({ ...state, name: "" }); }}
            className="ml-2 text-xs text-muted-foreground/80 underline hover:text-foreground"
          >
            不是你？
          </button>
        )}
      </p>
    </div>
  );
}

/** 注册送什么：从免费版配置算（自由对话、知识库各几次，其余板块几到几次） */
export function freeTrialLine(): string {
  const q = SUBSCRIPTION_PLANS.free.quotas as Record<string, number>;
  const rest = Object.entries(q).filter(([k]) => k !== "freeChat" && k !== "knowledge").map(([, v]) => v).filter((v) => v > 0);
  const lo = Math.min(...rest), hi = Math.max(...rest);
  return `凭邀请码注册即送免费体验：自由对话 ${q.freeChat} 次、知识库 ${q.knowledge} 次，各创作板块 ${lo === hi ? lo : `${lo}～${hi}`} 次`;
}

type Tip = { kind: string; name: string; desc: string; formula: string };
const TIPS: Tip[] = [
  ...SHOWCASE_CARDS.map((c) => ({ kind: `开篇第 ${c.no} 计`, name: c.name, desc: c.psychology, formula: c.formula })),
  ...SHOWCASE_TACTICS.map((t) => ({ kind: `起号第 ${t.no} 计`, name: t.name, desc: t.mechanism, formula: t.formula })),
  ...SHOWCASE_STRUCTURES.map((s) => ({ kind: "脚本结构", name: s.name, desc: s.coreLogic, formula: s.formula })),
];

/** 今日一计：按日期每天换一招；「换一个」看下一招 */
export function DailyTip() {
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
    setI(day % TIPS.length);
  }, []);
  if (i === null || !TIPS.length) return null;
  const tip = TIPS[i];
  return (
    <div className="mt-6 glass-panel rounded-2xl p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />今日一计
          <span className="font-normal text-muted-foreground">· {tip.kind}「{tip.name}」</span>
        </p>
        <button type="button" onClick={() => setI((i + 1) % TIPS.length)} className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-xs text-primary hover:underline">
          <RefreshCw className="h-3 w-3" />换一个
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{tip.desc}</p>
      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2.5">
        <div className="mb-0.5 text-[11px] font-medium tracking-wider text-primary">公式</div>
        <div className="text-[13px] font-medium text-foreground">{tip.formula}</div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">这样的方法开物里有 {FACTS.methods} 条，登录后按你的账号直接套用。</p>
    </div>
  );
}
