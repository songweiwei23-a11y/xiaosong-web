"use client";

import { Sidebar, SidebarProvider, useSidebar } from "@/components/dashboard/Sidebar";
import { UserProfile } from "@/components/auth/UserProfile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Menu } from "lucide-react";

function TopBar() {
  const { toggle } = useSidebar();
  return (
    <div className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur md:justify-end md:px-8">
      <button
        type="button"
        onClick={toggle}
        className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-4">
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
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
