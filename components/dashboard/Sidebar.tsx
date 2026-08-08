"use client";

import ProfileSwitcher from '@/app/dashboard/components/ProfileSwitcher';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target,
  BookOpen, User, Home, Sparkles, Award, MessagesSquare, X,
} from "lucide-react";

const navigation = [
  { name: "工作台",   href: "/dashboard",              icon: Home },
  { name: "脚本生成", href: "/dashboard/script",       icon: FileText },
  { name: "高阶自由", href: "/dashboard/free-chat",    icon: MessagesSquare },
  { name: "选题策划", href: "/dashboard/topic",        icon: Lightbulb },
  { name: "分镜脚本", href: "/dashboard/storyboard",   icon: Film },
  { name: "审稿优化", href: "/dashboard/review",       icon: CheckCircle },
  { name: "标题封面", href: "/dashboard/title",        icon: Tag },
  { name: "账号定位", href: "/dashboard/positioning",  icon: Target },
  { name: "成交理由", href: "/dashboard/deal-reason",  icon: Award },
  { name: "知识库",   href: "/dashboard/knowledge",    icon: BookOpen },
];

interface SidebarCtx { open: boolean; setOpen: (v: boolean) => void; toggle: () => void; }
const SidebarContext = createContext<SidebarCtx | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle: () => setOpen(o => !o) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();

  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-300 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate text-lg font-semibold text-foreground">小宋编导工作台</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <ProfileSwitcher />
        </div>

        <div className="border-t border-border p-4">
          <Link
            href="/dashboard/membership"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <User className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-foreground">个人中心</div>
              <div className="text-xs text-muted-foreground">会员与配额</div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
