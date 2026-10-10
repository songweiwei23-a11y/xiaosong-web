"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";
import { BrandSeal, BrandWordmark } from "@/components/brand/Brand";
import {
  Home, ShoppingCart, QrCode, Users, Settings, BarChart, ShieldCheck, ArrowLeft, Ticket, Radar,
  UserCog, ScrollText, Menu, ClipboardCheck, KeyRound, Globe,
} from "lucide-react";

/*
 * 后台导航。
 *
 * 外观和主页统一：跟随全站的浅色 / 深色主题，侧栏是悬浮的玻璃面板，品牌标识用主页同款的「开」印章。
 * 之前后台强制深色、写死了背景色，和主页是两套产品的样子（2026-10-10 设计统一）。
 *
 * 分组是因为六七项平铺时，「订单审核」和「系统设置」看起来同等重要，
 * 而实际上前者是每天要看的，后者一个月碰一次。
 */
const navGroups: {
  label: string | null;
  items: { name: string; href: string; icon: typeof Home }[];
}[] = [
  {
    label: null,
    items: [{ name: "管理概览", href: "/admin", icon: Home }],
  },
  {
    label: "用户与会员",
    items: [
      { name: "用户管理", href: "/admin/users", icon: UserCog },
      { name: "会员管理", href: "/admin/subscriptions", icon: Users },
      { name: "邀请码", href: "/admin/invitations", icon: Ticket },
    ],
  },
  {
    label: "订单与收款",
    items: [
      { name: "订单审核", href: "/admin/orders", icon: ShoppingCart },
      { name: "收款二维码", href: "/admin/qrcodes", icon: QrCode },
    ],
  },
  {
    label: "内容质量",
    items: [
      // 自动质检（2026-10-03）：生成结果有没有踩禁忌、配比对不对、年限写没写错
      { name: "质检看板", href: "/admin/quality", icon: ClipboardCheck },
      // 数据分析页里有结果反馈（有用 / 没用）的汇总
      { name: "数据分析", href: "/admin/analytics", icon: BarChart },
    ],
  },
  {
    label: "系统",
    items: [
      // 大屏：回答"此刻有没有人需要我动手"
      { name: "实时监控", href: "/admin/monitor", icon: Radar },
      { name: "操作日志", href: "/admin/logs", icon: ScrollText },
      { name: "权限管理", href: "/admin/permissions", icon: KeyRound },
      { name: "账号安全", href: "/admin/security", icon: ShieldCheck },
      { name: "系统设置", href: "/admin/settings", icon: Settings },
      { name: "联网搜索密钥", href: "/admin/search-key", icon: Globe },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // 点了菜单项跳过去，菜单自己收起
  useEffect(() => setMenuOpen(false), [pathname]);
  const currentName =
    navGroups
      .flatMap((g) => g.items)
      .filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.name ?? "管理后台";

  return (
    <div className="flex min-h-screen gap-3 p-3 md:p-4">
      {/* 手机上侧栏收起，从左上角的按钮滑出来：原来固定 256px 宽，手机屏幕才 375，内容只剩一百来像素 */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      <aside
        className={`glass-panel fixed inset-y-3 left-3 z-40 flex w-64 flex-col rounded-3xl p-3 transition-transform duration-300 md:sticky md:top-4 md:z-auto md:h-[calc(100dvh-2rem)] md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"
        }`}
      >
        <div className="flex h-16 items-center gap-3 px-2">
          <BrandSeal size={38} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-semibold tracking-wide text-foreground">管理后台</span>
            <span className="block text-[10px] font-medium tracking-[0.22em] text-muted-foreground/80">CONSOLE</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-1 pb-3">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className={gi === 0 ? "" : "mt-5"}>
              {group.label && (
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="text-[10.5px] font-medium tracking-[0.18em] text-muted-foreground/75">{group.label}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13.5px] transition-colors ${
                        isActive
                          ? "bg-primary/12 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                        />
                      )}
                      <item.icon
                        className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                          isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border/60 pt-3">
          <Link
            href="/dashboard"
            className="glass-panel glass-interactive flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工作台
          </Link>
          <p className="mt-3 text-center text-[10.5px] text-muted-foreground/60">
            <BrandWordmark className="text-[11px]" /> · 管理后台
          </p>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-auto rounded-3xl">
        {/* 手机上的顶栏：打开菜单 + 当前是哪一页 */}
        <div className="glass-panel sticky top-0 z-20 mb-2 flex h-14 items-center gap-3 rounded-2xl px-3 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="打开菜单"
            className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-[14px] font-medium text-foreground">{currentName}</span>
        </div>
        <FloatingThemeToggle />
        {children}
      </main>
    </div>
  );
}
