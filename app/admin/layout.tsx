"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";
import {
  Home, ShoppingCart, QrCode, Users, Settings, BarChart, ShieldCheck, ArrowLeft, Ticket, Radar,
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
    items: [
      { name: "管理概览", href: "/admin", icon: Home },
      // 大屏放最上面：它要回答的是"此刻有没有人需要我动手"，
      // 而不是"上个月数据怎么样"。排在配置项里就没人会开了
      { name: "实时监控", href: "/admin/monitor", icon: Radar },
    ],
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

  /*
   * 整个管理后台固定深色，不跟随用户的浅色/深色偏好。
   *
   * 【为什么】监控大屏的背景是写死的 #05070d，而侧边栏和其他后台页
   * 原本跟随主题——用户切到浅色时，左边是浅灰侧栏、右边是近黑大屏，
   * 中间一道硬边，像两个产品拼在一起。
   *
   * 后台是运维控制台，深色本来就是这类界面的默认；与其让两套颜色
   * 在这里打架，不如整块定住。加 `dark` 类就能让子树用深色变量，
   * 不影响用户在工作台那边的主题选择。
   */
  return (
    <div className="dark flex h-full bg-[#070b12] text-slate-100">
      {/*
        必须有 relative：底部那个「返回工作台」是绝对定位的，
        没有定位祖先时它会以视口为基准，left-4 right-4 让它横跨整个屏幕底部，
        而不是待在这条 256px 宽的侧栏里。改造前就是这样。
        改为 flex 纵向布局 + mt-auto，不再依赖绝对定位。
      */}
      {/*
        侧边栏和监控大屏原本是两套视觉：大屏是青色霓虹的科幻风，
        侧栏是一块扁平的深灰面板，中间还有一条硬边——像两个产品拼在一起。
        现在统一成同一套语言：同样的网格底纹、同样的青色、
        选中态用 HUD 那种带辉光的指示条，右侧边缘做成渐隐而不是硬线。
      */}
      <aside className="admin-rail relative flex h-full w-64 shrink-0 flex-col">
        {/* 网格底纹，和大屏同一套 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(var(--rail-line) 1px,transparent 1px),linear-gradient(90deg,var(--rail-line) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
          }}
        />
        {/* 右边缘的发光细线，代替原来那条硬边框 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--rail-edge) 18%, var(--rail-edge) 72%, transparent)",
          }}
        />

        <div className="relative flex h-16 items-center gap-3 px-5">
          <span className="relative flex h-9 w-9 items-center justify-center">
            {/* 转动的外环：让这个标识"活着"，而不是一个静止色块 */}
            <span
              aria-hidden
              className="admin-anim absolute inset-0 rounded-xl border border-primary/40 border-t-primary"
              style={{ animation: "adminSpin 6s linear infinite" }}
            />
            <span className="absolute inset-[3px] rounded-lg bg-primary/12" />
            <BarChart className="relative h-4 w-4 text-primary" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold tracking-wide text-foreground">
              管理后台
            </span>
            <span className="block text-[10px] tracking-[0.18em] text-primary/60">
              CONSOLE
            </span>
          </span>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className={gi === 0 ? "" : "mt-5"}>
              {group.label && (
                // 分组标题配一条延伸出去的细线，比孤零零两个灰字有结构
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground/70">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13.5px] transition-all ${
                        isActive
                          ? "bg-primary/[0.10] font-medium text-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <>
                          {/* 左侧指示条带辉光，比一条纯色细杠有分量 */}
                          <span
                            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                            style={{ boxShadow: "0 0 10px 1px hsl(var(--primary)/.7)" }}
                          />
                          {/* 选中项向右淡出的光晕 */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(90deg, hsl(var(--primary)/.14), transparent 60%)",
                            }}
                          />
                        </>
                      )}
                      <item.icon
                        className={`relative h-[17px] w-[17px] shrink-0 transition-colors ${
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground/80 group-hover:text-foreground"
                        }`}
                      />
                      <span className="relative truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative shrink-0 p-3">
          <span
            aria-hidden
            className="mb-3 block h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
          />
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-xl border border-border/70 px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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
