"use client";

import { Sidebar, SidebarProvider, useSidebar } from "@/components/dashboard/Sidebar";
import { UserProfile } from "@/components/auth/UserProfile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Menu } from "lucide-react";

function TopBar() {
  const { toggle } = useSidebar();
  return (
    // 真玻璃：常驻且高度固定，模糊开销可控；只留下边框，避免和侧边栏形成双线
    <div className="glass sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-x-0 border-t-0 px-4 md:justify-end md:px-8">
      <button
        type="button"
        onClick={toggle}
        className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserProfile />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/*
        容器必须保持透明。这里原本是 bg-background 实色，会把
        AmbientBackground 的光晕整个盖住——玻璃组件下面没有颜色可透，
        质感就无从谈起。背景由全站的氛围层统一提供。
      */}
      <div className="flex h-screen overflow-hidden text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
