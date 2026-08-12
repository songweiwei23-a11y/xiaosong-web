"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";
import { Home, ShoppingCart, QrCode, Users, Settings, BarChart, Ticket } from "lucide-react";

const adminNavigation = [
  { name: "管理概览", href: "/admin", icon: Home },
  { name: "订单审核", href: "/admin/orders", icon: ShoppingCart },
  { name: "收款二维码", href: "/admin/qrcodes", icon: QrCode },
  { name: "用户管理", href: "/admin/users", icon: Users },
  { name: "会员管理", href: "/admin/subscriptions", icon: BarChart },
  { name: "邀请码管理", href: "/admin/invitations", icon: Ticket },
  { name: "系统设置", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <BarChart className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">管理后台</span>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
                           (item.href !== "/admin" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80"
          >
            返回工作台
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <FloatingThemeToggle />
        {children}
      </main>
    </div>
  );
}
