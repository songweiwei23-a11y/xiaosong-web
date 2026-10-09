"use client";

import { Sidebar, SidebarProvider, useSidebar } from "@/components/dashboard/Sidebar";
import { UserProfile } from "@/components/auth/UserProfile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AmbientPill } from "@/components/ambient/AmbientPill";
import { UpgradePrompt } from "@/components/upgrade/UpgradePrompt";
import { Menu } from "lucide-react";
import { Suspense } from 'react';
import { TopBarSlotProvider, TopBarSlotTarget, useTopBarSlotClaimed } from '@/components/dashboard/TopBarSlot';
import { InProgressStrip } from '@/components/dashboard/InProgressStrip';
import { CreationRestoreGate } from '@/components/workspace/CreationRestoreGate';
import { ConnectionKeepAlive } from '@/components/dashboard/ConnectionKeepAlive';

function TopBar() {
  const { toggle } = useSidebar();
  const slotClaimed = useTopBarSlotClaimed();
  return (
    // 真玻璃：常驻；电脑上一行 72px，手机上「进行中」换到第二行，顶栏随之变高
    <div className="glass sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-x-0 border-t-0 px-3 py-2.5 sm:gap-x-4 sm:px-4 md:h-[72px] md:flex-nowrap md:justify-end md:px-8 md:py-0">
      <button
        type="button"
        onClick={toggle}
        className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* 中间空位：自由对话页把标题行放在这里（components/dashboard/TopBarSlot），别的页面空着 */}
      <TopBarSlotTarget />
      <InProgressStrip
        className={
          slotClaimed
            ? "order-last basis-full md:hidden"
            : "order-last basis-full md:order-none md:basis-auto md:flex-1"
        }
      />
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3 md:ml-0">
        <AmbientPill />
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
      <TopBarSlotProvider>
      {/*
        容器必须保持透明。这里原本是 bg-background 实色，会把
        AmbientBackground 的光晕整个盖住——玻璃组件下面没有颜色可透，
        质感就无从谈起。背景由全站的氛围层统一提供。
      */}
      <div className="flex h-screen h-dvh overflow-hidden text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">正在恢复创作…</p>}><CreationRestoreGate>{children}</CreationRestoreGate></Suspense>
          </main>
          {/* 全站付费引导：任何板块额度用完 / 快用完都由它接（见 lib/upgrade） */}
          <UpgradePrompt />
          {/* 连接保活：闲几分钟后线路掐掉空闲连接，再点保存、带去下一步就发不出去 */}
          <ConnectionKeepAlive />
        </div>
      </div>
      </TopBarSlotProvider>
    </SidebarProvider>
  );
}
