"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";
import {
  Home, ShoppingCart, QrCode, Users, Settings, BarChart, ShieldCheck, ArrowLeft, Ticket,
} from "lucide-react";

/*
 * 后台导航。
 *
 * 改造前有两处对不上：
 *   - /admin/analytics 有三百多行代码，导航里却没有入口，谁也点不到；
 *   - 「权限管理」页压根不存在，而接口早就写好了，被删掉的 admin-debug
 *     还提示过「请在权限管理页面设置管理员」——要加管理员只能手改数据库。
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
    label: "经营",
    items: [
      { name: "订单审核", href: "/admin/orders", icon: ShoppingCart },
      { name: "会员管理", href: "/admin/subscriptions", icon: Users },
      { name: "数据分析", href: "/admin/analytics", icon: BarChart },
    ],
  },
  {
    label: "配置",
    items: [
      { name: "邀请码", href: "/admin/invitations", icon: Ticket },
      { name: "收款二维码", href: "/admin/qrcodes", icon: QrCode },
      { name: "权限管理", href: "/admin/permissions", icon: ShieldCheck },
      { name: "系统设置", href: "/admin/settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/*
        必须有 relative：底部那个「返回工作台」是绝对定位的，
        没有定位祖先时它会以视口为基准，left-4 right-4 让它横跨整个屏幕底部，
        而不是待在这条 256px 宽的侧栏里。改造前就是这样。
        改为 flex 纵向布局 + mt-auto，不再依赖绝对定位。
      */}
      <aside className="glass relative flex h-full w-64 shrink-0 flex-col border-y-0 border-l-0">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl">
            <BarChart className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-foreground">管理后台</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className={gi === 0 ? "" : "mt-4"}>
              {group.label && (
                <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/12 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <span className="brand-gradient absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                      )}
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
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

        <div className="shrink-0 border-t border-border/60 p-3">
          <Link
            href="/dashboard"
            className="glass-panel glass-interactive flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工作台
          </Link>
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto">
        <FloatingThemeToggle />
        {children}
      </main>
    </div>
  );
}
