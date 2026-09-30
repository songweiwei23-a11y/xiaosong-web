"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { extractTitle, splitQualityReport, formatRelativeTime } from "@/lib/script-result-utils";
import { listWorks, type Work } from "@/lib/works";
import { nextStage, workStageUrl } from "@/lib/resume";
import { getActiveProfileId, onActiveProfileChange } from '@/lib/active-profile';
import { setupSteps, nextSetupStep, setupProgress } from '@/lib/setup-progress';
import { TodayBoard } from '@/components/dashboard/TodayBoard';
import { LaunchPlanCard } from '@/components/dashboard/LaunchPlanCard';
import { CourseCard } from '@/components/dashboard/CourseCard';
import { ProfileQuickSwitch } from '@/components/dashboard/ProfileQuickSwitch';
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target, Award, BookOpen,
  MessagesSquare, ChevronRight, Clock, Crown, User, History,
  ClipboardList, Rocket, Wallet, LayoutList, Sparkles, FileSearch, Clapperboard, Shuffle,
  type LucideIcon,
} from "lucide-react";

/*
 * 工作台首页。
 *
 * 布局取「操作与上下文并置」：左边是开始创作，右边是最近在做什么。
 * 这样进来既能从头开一条新的，也能接着昨天没写完的那条——后者其实是
 * 日常更高频的动作，改版前首页完全没有入口，只能进到各功能页里翻历史。
 *
 * 颜色只给创作主线的三个图标，其余一律中性。有颜色的地方越少，
 * 有颜色的那个才越显眼。
 */

/** 创作主线：三步有先后，界面按顺序排并标出第几步 */
/**
 * 主流程。
 *
 * 原来是三步（选题→脚本→分镜），因为那时候各板块之间并没有真的打通，
 * 摆成流程只是好看。现在这几步是能一路点下去的：选题生成完能直接去设计
 * 开篇，开篇里每种开法各出一条、挑中一条带着那句话去写脚本，脚本写完去
 * 分镜、去起标题，内容一路跟着走，不用复制粘贴。
 *
 * 所以把开篇和标题从「更多工具」提上来——它们已经是流程里的一环，
 * 埋在工具堆里等于告诉用户这条链不存在。
 */
const MAIN_FLOW: { name: string; desc: string; icon: LucideIcon; href: string; accent: string }[] = [
  {
    name: "选题策划",
    desc: "先想清楚拍什么",
    icon: Lightbulb,
    href: "/dashboard/topic",
    accent: "bg-amber-500/12 text-amber-500",
  },
  {
    name: "开篇设计",
    desc: "每种开法各给一条，挑一条带走",
    icon: Sparkles,
    href: "/dashboard/growth?tab=opening",
    accent: "bg-rose-500/12 text-rose-500",
  },
  {
    name: "脚本生成",
    desc: "写成能照着念的口播稿",
    icon: FileText,
    href: "/dashboard/script",
    accent: "bg-sky-500/12 text-sky-500",
  },
  {
    name: "分镜脚本",
    desc: "拆成可执行的镜头表",
    icon: Film,
    href: "/dashboard/storyboard",
    accent: "bg-violet-500/12 text-violet-500",
  },
  {
    name: "标题封面",
    desc: "跟着开头的钩子起标题",
    icon: Tag,
    href: "/dashboard/title",
    accent: "bg-emerald-500/12 text-emerald-500",
  },
];

/**
 * 先把地基打好，后面所有产出才准。
 *
 * 单独成一组而不是混进「更多工具」里：这几项有明确的先后——
 * 档案 → 定位 → 简报，简报做完选题、脚本、分镜才真的用得上你的账号信息。
 * 混在工具堆里，用户不会意识到这是要先做的事。
 */
const FOUNDATION: { name: string; desc: string; icon: LucideIcon; href: string; step: string }[] = [
  {
    name: "个人档案",
    desc: "填一次，全站都用它",
    icon: User,
    href: "/dashboard/profiles",
    step: "1",
  },
  {
    name: "账号定位",
    desc: "这个号是什么、给谁、凭什么",
    icon: Target,
    href: "/dashboard/positioning",
    step: "2",
  },
  {
    name: "创作简报",
    desc: "把定位翻译成各板块能直接用的指令",
    icon: ClipboardList,
    href: "/dashboard/creative-brief",
    step: "3",
  },
];

const MORE_TOOLS: { name: string; icon: LucideIcon; href: string; tip?: string }[] = [
  { name: "审稿优化", icon: CheckCircle, href: "/dashboard/review" },
  { name: "拆解爆款", icon: Clapperboard, href: "/dashboard/breakdown", tip: "传视频，逐镜头拆" },
  { name: "跨行业二创", icon: Shuffle, href: "/dashboard/remix", tip: "借别的行业爆款拍成你的" },
  // 开篇那一半已经提到主流程里了，这里留的是「挑哪一计拍」这一半
  { name: "起号打法", icon: Rocket, href: "/dashboard/growth?tab=plan", tip: "37计，按你的条件推荐" },
  { name: "商业定位", icon: Wallet, href: "/dashboard/business-positioning", tip: "靠什么赚钱" },
  { name: "内容定位", icon: LayoutList, href: "/dashboard/content-positioning", tip: "长期发什么" },
  { name: "成交理由", icon: Award, href: "/dashboard/deal-reason" },
  { name: "高阶自由", icon: MessagesSquare, href: "/dashboard/free-chat" },
  { name: "知识库", icon: BookOpen, href: "/dashboard/knowledge" },
];

/** 历史记录点回它来自的功能页 */
const TASK_ROUTES: Record<string, string> = {
  脚本生成: "/dashboard/script",
  选题策划: "/dashboard/topic",
  分镜脚本: "/dashboard/storyboard",
  审稿优化: "/dashboard/review",
  标题封面: "/dashboard/title",
  账号定位: "/dashboard/positioning",
  成交理由: "/dashboard/deal-reason",
  知识库查询: "/dashboard/knowledge",
  // 新板块也要能点回去，否则历史里点一条会跳到 /history
  商业定位: "/dashboard/business-positioning",
  内容定位: "/dashboard/content-positioning",
  创作简报: "/dashboard/creative-brief",
  拆解爆款: "/dashboard/breakdown",
  跨行业二创: "/dashboard/remix",
  起号方案: "/dashboard/growth",
  开篇钩子: "/dashboard/growth",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/*
 * 作品该接着做哪一步。
 *
 * 这里原来自己写了一份"第一个没完成的环节"，而选题那一步从来不挂到作品上，
 * 于是永远是"下一步：选题策划"；链接也是光秃秃的页面地址，不带作品编号——
 * 点进去页面不知道要接着做哪一条。和侧边栏「进行中」是同一个毛病。
 * 现在统一用 lib/resume：选题永远算已做，链接带 ?work=。
 */
function nextStageHref(w: Work) {
  return workStageUrl(w.id, nextStage(w.stages) ?? "标题封面");
}

function nextStageLabel(w: Work) {
  const s = nextStage(w.stages);
  return s ? `下一步：${s}` : "各环节已完成";
}

interface RecentItem {
  id: string;
  title: string;
  taskType: string;
  createdAt: string;
  href: string;
}

export default function DashboardPage() {
  const [quota, setQuota] = useState<{
    /** 本月（北京时间自然月）实际生成了几次，按使用记录数，删历史记录也不会少 */
    monthUsed: number;
    /** 本期额度已用（跟着订阅周期滚，管限额） */
    used: number;
    limit: number;
    plan: string;
    /** 用得最紧的那个功能。按功能分别限额时由接口给出，总量制下为 null */
    tightest: {
      featureName: string;
      used: number;
      total: number;
      remaining: number;
      percentage: number;
    } | null;
  } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  /** 这个档案下已有的定位类型，用来算「先打地基」还差几步 */
  const [posTypes, setPosTypes] = useState<string[]>([]);
  const [profileCount, setProfileCount] = useState(0);

  const applyQuota = (d: any) =>
    setQuota({
      monthUsed: d.monthUsed ?? d.totalUsed ?? 0,
      used: d.totalUsed ?? 0,
      limit: d.totalLimit ?? 0,
      plan: d.planName || "免费版",
      tightest: d.tightest ?? null,
    });

  /*
   * 「本月已用」要跟得上：在别的板块生成完切回来、或者页面一直开着，都该是新数。
   * 切回这个标签页时刷一次，开着的时候每分钟刷一次；后台标签页不刷，省请求。
   */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/quota/check")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && !d.error && applyQuota(d))
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  /** 档案列表回来后：定出当前档案，再取它的定位进度 */
  const applyProfiles = (list: unknown) => {
    if (!Array.isArray(list)) return;
    setProfileCount(list.length);
    if (list.length === 0) {
      setProfile(null);
      setPosTypes([]);
      return;
    }
    const savedId = getActiveProfileId();
    const active = list.find((p: any) => p.id === savedId) || list[0];
    setProfile(active);

    /*
     * 顺带把这个档案的定位类型取回来，用于「先打地基」的进度。
     * 它依赖档案 id，必须等档案回来才能发；也刻意不 await 进主流程——
     * 地基进度晚一点出来无所谓，不该为它把整页的加载态拖长。
     */
    fetch(`/api/positioning?profileId=${active.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any) => {
        if (Array.isArray(rows)) setPosTypes(rows.map((x: any) => x.positioning_type ?? ""));
      })
      .catch(() => {});
  };

  /*
   * 在侧边栏切了档案，首页要跟着变。
   * 原来首页只在打开时读一次档案、从不听"档案切换了"的广播：侧边栏切过去了，
   * 首页的「当前档案」和「先打地基」还停在上一个号上，看着就是"点了没反应"。
   */
  useEffect(() => {
    return onActiveProfileChange(() => {
      fetch("/api/profiles")
        .then((r) => (r.ok ? r.json() : null))
        .then((list) => list && applyProfiles(list))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 四个请求互不依赖，并行发出；首页不该为此串行等待
        const [quotaRes, profileRes, historyRes, workList] = await Promise.all([
          fetch(`/api/quota/check?userId=${session.user.id}`).catch(() => null),
          fetch("/api/profiles").catch(() => null),
          fetch("/api/script-history?taskType=all&limit=6").catch(() => null),
          listWorks(5),
        ]);

        // 只展示还没做完的：做完的作品留在「全部」里，不占首页
        setWorks(workList.filter((w) => !w.is_done).slice(0, 4));

        if (quotaRes?.ok) applyQuota(await quotaRes.json());

        if (profileRes?.ok) applyProfiles(await profileRes.json());

        if (historyRes?.ok) {
          const list = await historyRes.json();
          if (Array.isArray(list)) {
            setRecent(
              list.slice(0, 5).map((x: any) => ({
                id: x.id,
                // 与历史列表同一套标题提取，避免首页显示成另一个样子
                title: extractTitle(splitQualityReport(x.result || "").body),
                taskType: x.task_type || "",
                createdAt: x.created_at,
                // 属于某个作品的，点进去带上作品编号，直接回到那一条；零散记录回到板块页
                href: x.work_id
                  ? workStageUrl(x.work_id, x.task_type)
                  : TASK_ROUTES[x.task_type] || "/history",
              }))
            );
          }
        }
      } catch {
        // 首页这些信息都不是必需的，取不到就少显示一块，不打断使用
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /*
   * 这里原本是 `if (loading) return <整屏转圈>`：四个接口全部回来之前，
   * 页面上什么都没有。
   *
   * 但左边那三组（开始创作 / 先打地基 / 更多工具）是纯静态的，
   * 一个字节的数据都不需要——用户最常做的事就是进来点「选题策划」，
   * 却要先陪着等 2 秒多（实测最慢的 /api/quota/check 要 2.3 秒）。
   *
   * 改成：静态部分立刻显示，只有真正依赖数据的那几块（档案名、额度、
   * 接着上次、最近记录）自己显示骨架。人一进来就能点，不用等。
   */

  const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  // 「先打地基」的进度。判断逻辑在 lib/setup-progress，
  // 引导页和这里共用一份，免得两处对不上
  const setupInput = { profileCount, positioningTypes: posTypes };
  const setupState = {
    steps: setupSteps(setupInput),
    next: nextSetupStep(setupInput),
    ...setupProgress(setupInput),
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{greeting()}</h1>
            {/* 档案名要等接口，没回来前占位，别闪一下「还没有档案」再变 */}
            {loading ? (
              <div className="mt-2.5 h-4 w-56 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                {profile
                  ? `当前档案：${profile.profile_name || "未命名档案"}`
                  : "还没有账号档案，建一个后生成会更贴合你的号"}
              </p>
            )}
          </div>

          <ProfileQuickSwitch loading={loading} hasProfile={!!profile} />
        </header>

        {/* 今日看板：时钟 + 待办，进来第一眼看到的就是现在几点、今天要做什么 */}
        <div className="mb-5">
          <TodayBoard />
        </div>

        {/* 先学后做：抖音新手课（懂道理）→ 7 天起号计划（动手）。两张都能折叠 */}
        <CourseCard className="mb-5" />

        {/* 7 天起号计划：给不知道从哪开始的新手一条照着走的路（表没建时整张卡不出现，间距也跟着没） */}
        <LaunchPlanCard className="mb-5" />

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* 左：开始创作 */}
          <section>
            <h2 className="mb-1 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
              开始创作
            </h2>
            {/* 这条链现在是真通的，但不说用户不会知道，还会继续复制粘贴 */}
            <p className="mb-3 text-[11.5px] text-muted-foreground">
              每一步做完都能直接带着内容进下一步，不用复制粘贴
            </p>
            <div className="space-y-2.5">
              {MAIN_FLOW.map((m, i) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="glass-panel glass-interactive group flex items-center gap-4 rounded-2xl p-4"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.accent}`}>
                    <m.icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">{m.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.desc}</span>
                  </span>
                  {/* 步骤号做成淡水印：点出顺序，又不抢视线 */}
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/50">
                    第 {i + 1} 步
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>

            {/* 地基单独成组：这三步有先后，做完简报后面所有产出才用得上账号信息。
                混进工具堆里用户不会意识到这是要先做的 */}
            <h2 className="mb-1 mt-7 flex items-center justify-between text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
              <span>先打地基</span>
              {!loading && (
                <span className="tabular-nums normal-case tracking-normal">
                  {setupState.done}/{setupState.total}
                </span>
              )}
            </h2>
            <p className="mb-3 text-[11.5px] text-muted-foreground">
              按顺序做完这三步，选题、脚本、分镜才会真的用上你的账号信息
            </p>

            {/*
              没打完就把清单入口摆出来。
              线上漏斗：100% 建了档案，40% 做完定位，只有 10% 做到简报——
              而简报是让整个产品真正生效的那一步。光列三个链接不够，
              得让人看见"我还差几步"。
            */}
            {!loading && setupState.done < setupState.total && (
              <Link
                href="/onboarding"
                className="mb-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-primary">
                    还差 {setupState.total - setupState.done} 步
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    下一步：{setupState.next?.title}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary/60" />
              </Link>
            )}

            <div className="space-y-2">
              {FOUNDATION.map((f, i) => {
                // 三步的顺序和 setup-progress 里一致，按下标取完成状态
                const isDone = !loading && setupState.steps[i]?.done;
                return (
                  <Link
                    key={f.href}
                    href={f.href}
                    className="glass-panel glass-interactive group flex items-center gap-3 rounded-xl px-3.5 py-3"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                        isDone ? "bg-primary/20 text-primary" : "bg-primary/12 text-primary"
                      }`}
                    >
                      {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : f.step}
                    </span>
                    <f.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[12.5px] ${isDone ? "text-muted-foreground" : "text-foreground"}`}>
                        {f.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{f.desc}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
            {/* 档案的快捷填法。不放进上面三步：那三步和 setup-progress 按下标一一对应 */}
            <Link
              href="/dashboard/interview"
              className="mt-2 flex items-center gap-1.5 px-1 text-[11.5px] text-muted-foreground transition-colors hover:text-primary"
            >
              <FileSearch className="h-3.5 w-3.5 shrink-0" />
              有前采资料？用「前采建档」一键填好档案
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </Link>

            <h2 className="mb-3 mt-7 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
              更多工具
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MORE_TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="glass-panel glass-interactive group flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                >
                  <t.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-foreground">{t.name}</span>
                    {t.tip && (
                      <span className="block truncate text-[10.5px] text-muted-foreground">{t.tip}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* 右：最近在做什么 + 用量 */}
          <aside className="space-y-5">
            {/* 进行中的作品：一条内容的各个环节串在一起，
                比一堆零散记录更接近「我做到哪了」这个真实问题 */}
            <section className="glass-panel rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  接着上次
                </h2>
                {/* 有作品时"全部"指向我的作品：每个环节都能点开接着做，比零散历史有用 */}
                <Link
                  href={works.length > 0 ? "/dashboard/works" : "/history"}
                  className="text-[11.5px] text-muted-foreground hover:text-foreground"
                >
                  全部
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : works.length > 0 ? (
                <div className="space-y-0.5">
                  {works.map((w) => (
                    <Link
                      key={w.id}
                      href={nextStageHref(w)}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.05]"
                    >
                      <p className="truncate text-[13px] text-foreground">{w.title}</p>

                      {/* 环节进度用小圆点表示：做完的填实，没做的空心。
                          比写一行「已完成 2/5」更快读懂卡在哪一步 */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          {w.stages.map((s) => (
                            <span
                              key={s.name}
                              title={`${s.name}${s.done ? "：已完成" : "：未开始"}`}
                              className={`h-1.5 w-1.5 rounded-full ${
                                s.done ? "bg-primary" : "bg-foreground/15"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {nextStageLabel(w)}
                          <span className="mx-1">·</span>
                          <span suppressHydrationWarning>{formatRelativeTime(w.updated_at)}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : recent.length > 0 ? (
                // 还没有作品但有旧记录时，先显示旧记录——
                // 作品是新引入的概念，改造前的几百条记录不该凭空消失
                <div className="space-y-0.5">
                  {recent.map((r) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.05]"
                    >
                      <p className="truncate text-[13px] text-foreground">{r.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.taskType}
                        <span className="mx-1">·</span>
                        <span suppressHydrationWarning>{formatRelativeTime(r.createdAt)}</span>
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-foreground/[0.04] px-4 py-6 text-center">
                  <History className="mx-auto h-5 w-5 text-muted-foreground/60" />
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    还没有生成记录，从左边挑一个开始
                  </p>
                </div>
              )}
            </section>

            <section className="glass-panel rounded-2xl p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted-foreground">本月已用</span>
                {/* 额度没回来前别显示 0——那会被当成"我一次都没用过" */}
                {loading ? (
                  <span className="h-6 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <span className="text-[22px] font-semibold tabular-nums text-foreground">
                    {quota?.monthUsed ?? 0}
                    <span className="ml-1 text-[12px] font-normal text-muted-foreground">次</span>
                  </span>
                )}
              </div>

              {/* 本月已用按自然月数；限额跟着订阅周期走，两个数说的不是一回事，分开写 */}
              {quota?.limit ? (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[12px] text-muted-foreground">
                    <span>本期额度</span>
                    <span className="tabular-nums">
                      {quota.used} / {quota.limit}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
                  </div>
                </div>
              ) : null}

              {/*
                套餐按功能分别限额时，总数没有分母可言——各功能额度加起来
                是个真实但会误导人的数字。这里改为点名用得最紧的那一个：
                「脚本生成 还剩 2 次」比「20 / 400」有用得多。
              */}
              {quota?.tightest ? (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-muted-foreground">{quota.tightest.featureName}</span>
                    <span
                      className={
                        quota.tightest.remaining === 0
                          ? "font-medium text-destructive"
                          : quota.tightest.percentage >= 80
                            ? "font-medium text-amber-500"
                            : "text-muted-foreground"
                      }
                    >
                      {quota.tightest.remaining === 0
                        ? "已用完"
                        : `还剩 ${quota.tightest.remaining} 次`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className={`h-full rounded-full ${
                        quota.tightest.remaining === 0 ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${quota.tightest.percentage}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Crown className="h-3.5 w-3.5" />
                  {quota?.plan ?? "免费版"}
                </span>
                <span className="flex items-center gap-3">
                  {/* 到期时间、订单审核结果都在账户页，从这里顺手就能进 */}
                  <Link href="/dashboard/account" className="text-[12px] text-muted-foreground hover:text-primary">
                    账户
                  </Link>
                  <Link href="/dashboard/membership" className="text-[12px] text-primary hover:opacity-80">
                    升级
                  </Link>
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
