"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target, Award, BookOpen,
  MessagesSquare, History, ArrowRight, ChevronRight, User, Crown, Loader2,
  type LucideIcon,
} from "lucide-react";

/*
 * 工作台首页。
 *
 * 首页的任务是让人尽快开始干活，所以按信息层级排：
 * 创作主线放最上且给足面积，次要功能收成一行小卡，用量这种偶尔看一眼的
 * 信息压到最后一行。改版前的做法是所有东西同等大小地平铺——档案库占一大块、
 * 三个统计数字各占一张大卡、七个功能等权排列，结果是进来之后不知道先看哪。
 *
 * 颜色同样克制：整页只有主线卡片的图标带身份色，其余一律中性。
 * 有颜色的地方越少，有颜色的那个才越显眼。
 */

/** 创作主线：这三步是有先后关系的，界面上也按顺序排并用箭头点出来 */
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

/** 次要功能：按使用频率排，不与主线争面积 */
const MORE_TOOLS: { name: string; desc: string; icon: LucideIcon; href: string }[] = [
  { name: "审稿优化", desc: "逐条指出问题并改写", icon: CheckCircle, href: "/dashboard/review" },
  { name: "标题封面", desc: "多个标题方案做对比", icon: Tag, href: "/dashboard/title" },
  { name: "账号定位", desc: "基于档案给定位方案", icon: Target, href: "/dashboard/positioning" },
  { name: "成交理由", desc: "17 个理由逐条打分", icon: Award, href: "/dashboard/deal-reason" },
  { name: "高阶自由", desc: "想到哪聊到哪", icon: MessagesSquare, href: "/dashboard/free-chat" },
  { name: "知识库", desc: "查编导方法与技巧", icon: BookOpen, href: "/dashboard/knowledge" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function DashboardPage() {
  const [quota, setQuota] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 用量与档案并行取，首页不该为了两个独立请求串行等待
        const [quotaRes, profileRes] = await Promise.all([
          fetch(`/api/quota/check?userId=${session.user.id}`).catch(() => null),
          fetch("/api/profiles").catch(() => null),
        ]);

        if (quotaRes?.ok) {
          const d = await quotaRes.json();
          setQuota({
            used: d.totalUsed ?? d.used ?? 0,
            limit: d.totalLimit ?? d.limit ?? 0,
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
      } catch {
        // 首页的这些信息都不是必需的，取不到就少显示一块，不打断使用
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

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-5xl">
        {/* 问候 + 当前档案 */}
        <header className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
              {greeting()}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">今天想做点什么？</p>
          </div>

          {profile && (
            <Link
              href="/dashboard/profiles"
              className="glass-panel glass-interactive flex items-center gap-3 rounded-2xl px-4 py-2.5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12">
                <User className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {profile.profile_name || "未命名档案"}
                </span>
                <span className="block text-[11px] text-muted-foreground">当前工作档案</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}
        </header>

        {/* 创作主线：三步有先后，用箭头点出关系 */}
        <section className="mb-10">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[15px] font-medium text-foreground">开始创作</h2>
            <span className="text-[12px] text-muted-foreground">按这个顺序走最顺</span>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {MAIN_FLOW.map((item, i) => (
              <div key={item.href} className="flex flex-1 items-center gap-3">
                <Link
                  href={item.href}
                  className="glass-panel glass-interactive group flex flex-1 flex-col rounded-2xl p-5"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.accent}`}>
                    <item.icon className="h-[22px] w-[22px]" />
                  </span>

                  <span className="mt-4 flex items-center gap-1.5">
                    <span className="text-[15px] font-medium text-foreground">{item.name}</span>
                    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {item.desc}
                  </span>

                  {/* 步骤号做成极淡的水印，点出顺序又不抢视线 */}
                  <span className="mt-4 text-[11px] font-medium tabular-nums text-muted-foreground/50">
                    第 {i + 1} 步
                  </span>
                </Link>

                {/* 箭头只在大屏出现：窄屏卡片是纵向排列的，横向箭头会指错方向 */}
                {i < MAIN_FLOW.length - 1 && (
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 lg:block" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 次要功能：小卡片，不与主线争面积 */}
        <section className="mb-10">
          <h2 className="mb-3 text-[15px] font-medium text-foreground">更多工具</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {MORE_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="glass-panel glass-interactive group flex items-center gap-3 rounded-xl px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] transition-colors group-hover:bg-primary/12">
                  <tool.icon className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{tool.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{tool.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 用量：偶尔看一眼的信息，一行带过，不占版面 */}
        <section className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-muted-foreground">本月已用</span>
              <span className="text-[17px] font-semibold tabular-nums text-foreground">
                {quota?.used ?? 0}
              </span>
              {quota?.limit ? (
                <span className="text-[12px] text-muted-foreground">/ {quota.limit} 次</span>
              ) : (
                <span className="text-[12px] text-muted-foreground">次</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px] text-foreground">{quota?.plan ?? "免费版"}</span>
            </div>

            <Link
              href="/history"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              全部生成记录
            </Link>
          </div>

          <Link href="/dashboard/membership" className="btn-brand rounded-xl px-4 py-2 text-[13px] font-medium">
            升级会员
          </Link>
        </section>
      </div>
    </div>
  );
}
