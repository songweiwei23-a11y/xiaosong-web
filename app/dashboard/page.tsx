"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { extractTitle, splitQualityReport, formatRelativeTime } from "@/lib/script-result-utils";
import { listWorks, type Work } from "@/lib/works";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target, Award, BookOpen,
  MessagesSquare, ChevronRight, Clock, Crown, User, Loader2, History,
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
const MAIN_FLOW: { name: string; desc: string; icon: LucideIcon; href: string; accent: string }[] = [
  {
    name: "选题策划",
    desc: "先想清楚拍什么",
    icon: Lightbulb,
    href: "/dashboard/topic",
    accent: "bg-amber-500/12 text-amber-500",
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
];

const MORE_TOOLS: { name: string; icon: LucideIcon; href: string }[] = [
  { name: "审稿优化", icon: CheckCircle, href: "/dashboard/review" },
  { name: "标题封面", icon: Tag, href: "/dashboard/title" },
  { name: "账号定位", icon: Target, href: "/dashboard/positioning" },
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
};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

/** 作品该接着做哪一步：第一个没完成的环节 */
function nextStage(w: Work) {
  return w.stages.find((s) => !s.done);
}

function nextStageHref(w: Work) {
  const s = nextStage(w);
  return s ? TASK_ROUTES[s.name] ?? "/history" : "/history";
}

function nextStageLabel(w: Work) {
  const s = nextStage(w);
  return s ? `下一步：${s.name}` : "各环节已完成";
}

interface RecentItem {
  id: string;
  title: string;
  taskType: string;
  createdAt: string;
  href: string;
}

export default function DashboardPage() {
  const [quota, setQuota] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

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

        if (quotaRes?.ok) {
          const d = await quotaRes.json();
          setQuota({
            used: d.totalUsed ?? 0,
            limit: d.totalLimit ?? 0,
            plan: d.planName || "免费版",
          });
        }

        if (profileRes?.ok) {
          const list = await profileRes.json();
          if (Array.isArray(list) && list.length > 0) {
            const savedId = localStorage.getItem("activeProfileId");
            setProfile(list.find((p: any) => p.id === savedId) || list[0]);
          }
        }

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
                href: TASK_ROUTES[x.task_type] || "/history",
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-[13px] text-muted-foreground">正在准备工作台…</p>
        </div>
      </div>
    );
  }

  const usedPct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{greeting()}</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              {profile
                ? `当前档案：${profile.profile_name || "未命名档案"}`
                : "还没有账号档案，建一个后生成会更贴合你的号"}
            </p>
          </div>

          <Link
            href="/dashboard/profiles"
            className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-[13px]"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            {profile ? "切换档案" : "创建档案"}
          </Link>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* 左：开始创作 */}
          <section>
            <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/70">
              开始创作
            </h2>
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
                  <span className="truncate text-[12.5px] text-foreground">{t.name}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* 右：最近在做什么 + 用量 */}
          <aside className="space-y-5">
            {/* 进行中的作品：一条内容的各个环节串在一起，
                比一堆零散记录更接近「我做到哪了」这个真实问题 */}
            <section className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  接着上次
                </h2>
                <Link href="/history" className="text-[11.5px] text-muted-foreground hover:text-foreground">
                  全部
                </Link>
              </div>

              {works.length > 0 ? (
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

            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-muted-foreground">本月已用</span>
                <span className="text-[22px] font-semibold tabular-nums text-foreground">
                  {quota?.used ?? 0}
                  {quota?.limit ? (
                    <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                      / {quota.limit}
                    </span>
                  ) : null}
                </span>
              </div>

              {quota?.limit ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Crown className="h-3.5 w-3.5" />
                  {quota?.plan ?? "免费版"}
                </span>
                <Link href="/dashboard/membership" className="text-[12px] text-primary hover:opacity-80">
                  升级
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
