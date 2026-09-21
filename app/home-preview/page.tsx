"use client";

/**
 * 首页设计方案对比页（选型用，定稿后删除）。
 *
 * 四个方案用真实组件与真实样式渲染，不画线框——首页的好坏很大程度取决于
 * 字号、留白、颜色出现的位置，线框恰恰把这些信息全抹掉了。
 */

import { useState } from "react";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target, Award, BookOpen,
  MessagesSquare, History, ArrowRight, ChevronRight, Crown, User, Search,
  Sparkles, Clock, type LucideIcon,
} from "lucide-react";

type PlanId = "focus" | "overview" | "gallery" | "list" | "timeline" | "console" | "reader" | "spatial";

const PLANS: { id: PlanId; name: string; tagline: string; note: string }[] = [
  {
    id: "focus",
    name: "A · 聚焦",
    tagline: "一句话 + 一个入口，其余全部让位",
    note: "最接近 Apple 官网的做法：一屏只讲一件事。适合每天目标明确、进来就是要干活的人。",
  },
  {
    id: "overview",
    name: "B · 概览",
    tagline: "左边开始创作，右边最近在做什么",
    note: "像 macOS 的「访达」：操作与上下文并置。适合手上同时有几个账号、需要随时接着上次做的人。",
  },
  {
    id: "gallery",
    name: "C · 画廊",
    tagline: "大卡片铺开，每个功能都看得见",
    note: "像 Keynote 选模板：所有可能性一次摊开。适合功能还在探索期、或给新人看的场景。",
  },
  {
    id: "list",
    name: "D · 清单",
    tagline: "分组列表，没有任何装饰",
    note: "像 macOS 系统设置：极致的克制与密度。适合已经熟到不用看图标、只想最快点中目标的人。",
  },
  {
    id: "timeline",
    name: "E · 时间线",
    tagline: "以「最近在做什么」为主轴",
    note: "像 Notion 的首页：进来先看到未完成的东西，而不是从零开始。适合同一条内容要跨几天打磨的节奏。",
  },
  {
    id: "console",
    name: "F · 驾驶舱",
    tagline: "数据在上，入口在下",
    note: "像 Vercel 的控制台：先看状态再决定做什么。适合关心产出节奏、想用数据驱动排期的人。",
  },
  {
    id: "reader",
    name: "G · 单栏",
    tagline: "一条竖线走到底，宽屏也不铺满",
    note: "像 Things 3：内容居中收窄，两侧留白。屏幕再宽也不会让视线来回横扫，读起来最省力。",
  },
  {
    id: "spatial",
    name: "H · 留白",
    tagline: "只放三张大卡，其余靠滚动",
    note: "把 Apple「一屏一件事」推到极致：首屏只有创作主线，其余功能滚动后才出现。最有设计感，也最需要习惯。",
  },
];

const MAIN = [
  { name: "选题策划", desc: "先想清楚拍什么", icon: Lightbulb, accent: "bg-amber-500/12 text-amber-500" },
  { name: "脚本生成", desc: "写成能照着念的口播稿", icon: FileText, accent: "bg-sky-500/12 text-sky-500" },
  { name: "分镜脚本", desc: "拆成可执行的镜头表", icon: Film, accent: "bg-violet-500/12 text-violet-500" },
];

const MORE = [
  { name: "审稿优化", desc: "逐条指出问题并改写", icon: CheckCircle },
  { name: "标题封面", desc: "多个标题方案做对比", icon: Tag },
  { name: "账号定位", desc: "基于档案给定位方案", icon: Target },
  { name: "成交理由", desc: "17 个理由逐条打分", icon: Award },
  { name: "高阶自由", desc: "想到哪聊到哪", icon: MessagesSquare },
  { name: "知识库", desc: "查编导方法与技巧", icon: BookOpen },
];

const RECENT = [
  { title: "普通人做短视频最容易踩的3个坑", type: "脚本", time: "20 分钟前" },
  { title: "20条大流量选题方案", type: "选题", time: "2 小时前" },
  { title: "实体店老板自己拍视频的三个误区", type: "脚本", time: "昨天" },
  { title: "账号定位分析报告", type: "定位", time: "3 天前" },
];

/* ───────────── A · 聚焦 ───────────── */
function FocusHome() {
  return (
    <div className="px-8 py-16">
      <div className="mx-auto max-w-3xl">
        {/* 一屏一个焦点：标题敢用大字号，下面直接给入口 */}
        <div className="text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            下午好，宋威威
          </p>
          <h1 className="mt-4 text-[40px] font-semibold leading-tight tracking-tight text-foreground">
            今天想拍什么？
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            写下一个想法，从选题到分镜一路做完
          </p>
        </div>

        {/* 主入口：一个大输入框，回车即进入脚本生成 */}
        <div className="glass-panel mx-auto mt-9 flex items-center gap-3 rounded-2xl px-5 py-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <input
            placeholder="例如：实体店老板怎么用手机拍探店视频"
            className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button className="btn-brand shrink-0 rounded-xl px-4 py-2 text-[13px] font-medium">
            开始
          </button>
        </div>

        {/* 三条主线做成横排文字链，不与输入框争视觉重量 */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {MAIN.map((m) => (
            <button
              key={m.name}
              className="group flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <m.icon className="h-4 w-4" />
              {m.name}
              <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>

        {/* 其余功能压到很下面，用极淡的分隔线隔开 */}
        <div className="mt-20 border-t border-border/60 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
            {MORE.map((t) => (
              <button
                key={t.name}
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.name}
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-[12px] text-muted-foreground/70">
            本月已用 63 次 · 免费版
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────── B · 概览 ───────────── */
function OverviewHome() {
  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">下午好</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              当前档案：实体获客编导 · 抖音 · 0-1万
            </p>
          </div>
          <button className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-[13px]">
            <User className="h-4 w-4 text-muted-foreground" />
            切换档案
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* 左：开始创作 */}
          <section>
            <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-muted-foreground/70">
              开始创作
            </h2>
            <div className="space-y-2.5">
              {MAIN.map((m, i) => (
                <button
                  key={m.name}
                  className="glass-panel glass-interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.accent}`}>
                    <m.icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">{m.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.desc}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/50">
                    第 {i + 1} 步
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>

            <h2 className="mb-3 mt-7 text-[13px] font-medium uppercase tracking-wider text-muted-foreground/70">
              更多工具
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MORE.map((t) => (
                <button
                  key={t.name}
                  className="glass-panel glass-interactive group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
                >
                  <t.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="truncate text-[12.5px] text-foreground">{t.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 右：最近在做什么 */}
          <aside className="space-y-5">
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                接着上次
              </h2>
              <div className="space-y-1">
                {RECENT.map((r) => (
                  <button
                    key={r.title}
                    className="group w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.05]"
                  >
                    <p className="truncate text-[13px] text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.type} · {r.time}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted-foreground">本月已用</span>
                <span className="text-[22px] font-semibold tabular-nums text-foreground">63</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div className="h-full w-[6%] rounded-full bg-primary" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Crown className="h-3.5 w-3.5" />
                  免费版
                </span>
                <button className="text-[12px] text-primary hover:opacity-80">升级</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ───────────── C · 画廊 ───────────── */
function GalleryHome() {
  const all = [
    ...MAIN.map((m) => ({ ...m, main: true })),
    ...MORE.map((m) => ({ ...m, accent: "bg-foreground/[0.06] text-muted-foreground", main: false })),
  ];
  return (
    <div className="px-8 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">开始创作</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            九个工具，从找选题到出分镜，挑一个开始
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((item) => (
            <button
              key={item.name}
              className="glass-panel glass-interactive group flex flex-col items-start rounded-2xl p-6 text-left"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}>
                <item.icon className="h-6 w-6" />
              </span>
              <span className="mt-5 text-[16px] font-medium text-foreground">{item.name}</span>
              <span className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {item.desc}
              </span>
              <span className="mt-4 flex items-center gap-1 text-[12px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                开始
                <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>

        <p className="mt-10 text-center text-[12px] text-muted-foreground/70">
          本月已用 63 次 · 免费版 · 查看全部生成记录
        </p>
      </div>
    </div>
  );
}

/* ───────────── D · 清单 ───────────── */
function ListHome() {
  const groups: { label: string; items: { name: string; desc: string; icon: LucideIcon }[] }[] = [
    { label: "内容创作", items: MAIN.map(({ name, desc, icon }) => ({ name, desc, icon })) },
    { label: "打磨与优化", items: MORE.slice(0, 2) },
    { label: "账号运营", items: MORE.slice(2, 4) },
    { label: "助手与资料", items: MORE.slice(4) },
  ];

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">工作台</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            实体获客编导 · 本月已用 63 次
          </p>
        </header>

        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {g.label}
              </h2>
              {/* 整组一张卡，内部用分隔线——像 macOS 设置里的分组列表 */}
              <div className="glass-panel overflow-hidden rounded-2xl">
                {g.items.map((item, i) => (
                  <button
                    key={item.name}
                    className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] ${
                      i > 0 ? "border-t border-border/50" : ""
                    }`}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-foreground">{item.name}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {item.desc}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── E · 时间线 ───────────── */
function TimelineHome() {
  const groups = [
    { label: "今天", items: RECENT.slice(0, 2) },
    { label: "昨天", items: RECENT.slice(2, 3) },
    { label: "更早", items: RECENT.slice(3) },
  ];
  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">继续工作</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">实体获客编导 · 本月已用 63 次</p>
        </header>

        {/* 快捷入口收成一行按钮，主角让给下面的时间线 */}
        <div className="mb-8 flex flex-wrap gap-2">
          {MAIN.map((m) => (
            <button
              key={m.name}
              className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-3.5 py-2"
            >
              <m.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] text-foreground">{m.name}</span>
            </button>
          ))}
          <button className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] text-muted-foreground">
            更多
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 时间线：左侧一条竖线串起全部记录 */}
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {g.label}
              </h2>
              <div className="relative space-y-2 border-l border-border/70 pl-5">
                {g.items.map((r) => (
                  <button
                    key={r.title}
                    className="group relative w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]"
                  >
                    {/* 圆点压在竖线上，标出这条记录的位置 */}
                    <span className="absolute -left-[26px] top-4 h-1.5 w-1.5 rounded-full bg-border transition-colors group-hover:bg-primary" />
                    <p className="truncate text-[14px] text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {r.type} · {r.time}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── F · 驾驶舱 ───────────── */
function ConsoleHome() {
  const stats = [
    { label: "本月产出", value: "63", unit: "条" },
    { label: "档案完整度", value: "90", unit: "%" },
    { label: "最近一次", value: "20", unit: "分钟前" },
  ];
  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground">工作台</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">实体获客编导 · 抖音 · 0-1万</p>
          </div>
          <button className="btn-brand rounded-xl px-4 py-2 text-[13px] font-medium">升级会员</button>
        </header>

        {/* 状态条：三个数放一张卡里用分隔线隔开，比三张卡更整 */}
        <div className="glass-panel mb-8 grid grid-cols-3 rounded-2xl">
          {stats.map((s, i) => (
            <div key={s.label} className={`px-5 py-4 ${i > 0 ? "border-l border-border/60" : ""}`}>
              <p className="text-[12px] text-muted-foreground">{s.label}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-[24px] font-semibold tabular-nums text-foreground">{s.value}</span>
                <span className="text-[12px] text-muted-foreground">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-muted-foreground/70">
          开始创作
        </h2>
        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          {MAIN.map((m) => (
            <button
              key={m.name}
              className="glass-panel glass-interactive group flex items-center gap-3 rounded-2xl p-4 text-left"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.accent}`}>
                <m.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-foreground">{m.name}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-muted-foreground/70">
          更多工具
        </h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {MORE.map((t) => (
            <button
              key={t.name}
              className="glass-panel glass-interactive flex flex-col items-center gap-2 rounded-xl px-3 py-4"
            >
              <t.icon className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="text-[12px] text-foreground">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── G · 单栏 ───────────── */
function ReaderHome() {
  return (
    <div className="px-8 py-12">
      {/* 收到 620px：宽屏下视线不用横扫，读起来最省力 */}
      <div className="mx-auto max-w-[620px]">
        <header className="mb-9">
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground">下午好</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            实体获客编导 · 本月已用 63 次
          </p>
        </header>

        <section className="mb-9">
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
            开始创作
          </h2>
          <div className="space-y-2">
            {MAIN.map((m, i) => (
              <button
                key={m.name}
                className="glass-panel glass-interactive group flex w-full items-center gap-4 rounded-2xl p-4 text-left"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.accent}`}>
                  <m.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-foreground">{m.name}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.desc}</span>
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground/50">0{i + 1}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-9">
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
            接着上次
          </h2>
          <div className="glass-panel overflow-hidden rounded-2xl">
            {RECENT.slice(0, 3).map((r, i) => (
              <button
                key={r.title}
                className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] ${
                  i > 0 ? "border-t border-border/50" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-foreground">{r.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {r.type} · {r.time}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
            更多工具
          </h2>
          <div className="flex flex-wrap gap-2">
            {MORE.map((t) => (
              <button
                key={t.name}
                className="glass-panel glass-interactive flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] text-foreground"
              >
                <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {t.name}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ───────────── H · 留白 ───────────── */
function SpatialHome() {
  return (
    <div>
      {/* 首屏只有创作主线，高度按视口算，强制「一屏一件事」 */}
      <div className="flex min-h-[78vh] items-center px-8">
        <div className="mx-auto w-full max-w-4xl">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            下午好，宋威威
          </p>
          <h1 className="mb-12 text-[44px] font-semibold leading-[1.15] tracking-tight text-foreground">
            从一个想法
            <br />
            到一条能拍的片子
          </h1>

          <div className="grid gap-4 sm:grid-cols-3">
            {MAIN.map((m, i) => (
              <button
                key={m.name}
                className="glass-panel glass-interactive group flex flex-col items-start rounded-[20px] p-6 text-left"
              >
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground/50">
                  0{i + 1}
                </span>
                <span className={`mt-5 flex h-12 w-12 items-center justify-center rounded-2xl ${m.accent}`}>
                  <m.icon className="h-6 w-6" />
                </span>
                <span className="mt-5 text-[17px] font-medium text-foreground">{m.name}</span>
                <span className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {m.desc}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-10 flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
            向下滚动查看其余工具
            <ChevronRight className="h-3 w-3 rotate-90" />
          </p>
        </div>
      </div>

      {/* 第二屏：其余功能 */}
      <div className="border-t border-border/60 px-8 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-[15px] font-medium text-foreground">其余工具</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map((t) => (
              <button
                key={t.name}
                className="glass-panel glass-interactive flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
              >
                <t.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] text-foreground">{t.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-8 text-[12px] text-muted-foreground/70">本月已用 63 次 · 免费版</p>
        </div>
      </div>
    </div>
  );
}

const VIEWS: Record<PlanId, () => JSX.Element> = {
  focus: FocusHome,
  overview: OverviewHome,
  gallery: GalleryHome,
  list: ListHome,
  timeline: TimelineHome,
  console: ConsoleHome,
  reader: ReaderHome,
  spatial: SpatialHome,
};

export default function HomePreviewPage() {
  const [active, setActive] = useState<PlanId>("focus");
  const View = VIEWS[active];
  const plan = PLANS.find((p) => p.id === active)!;

  return (
    <div className="min-h-screen">
      {/* 选型工具条 */}
      <div className="glass sticky top-0 z-30 border-x-0 border-t-0 px-6 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-foreground">首页方案</span>
          <div className="glass-panel flex flex-wrap gap-1 rounded-xl p-1">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  active === p.id
                    ? "bg-primary/20 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-muted-foreground">{plan.tagline}</span>
        </div>
      </div>

      <View />

      {/* 方案说明放最下面，不干扰对布局本身的判断 */}
      <div className="px-8 pb-12">
        <div className="glass-panel mx-auto max-w-3xl rounded-2xl p-5">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium text-foreground">{plan.name}</span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{plan.note}</p>
        </div>
      </div>
    </div>
  );
}
