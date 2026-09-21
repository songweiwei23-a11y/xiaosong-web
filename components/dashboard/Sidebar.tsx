"use client";

import ProfileSwitcher from '@/app/dashboard/components/ProfileSwitcher';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target,
  BookOpen, User, Home, Sparkles, Award, MessagesSquare, X,
} from "lucide-react";

/*
 * 导航按「实际创作流程」分组并排序，而不是按功能上线的先后堆叠。
 *
 * 原先 11 项平铺成一长条，且顺序是乱的——脚本生成排在选题策划前面，
 * 但现实里先有选题才写脚本。改成分组后，找功能从「扫一遍列表」
 * 变成「先定区域、再选功能」，功能越多这个差别越明显。
 */
const navGroups: {
  label: string | null;
  items: { name: string; href: string; icon: typeof Home }[];
}[] = [
  {
    label: null, // 总览不需要组标题，单独一项顶在最上面
    items: [{ name: "工作台", href: "/dashboard", icon: Home }],
  },
  {
    label: "内容创作",
    items: [
      // 顺序即创作链路：定选题 → 写脚本 → 拆分镜 → 审稿 → 起标题
      { name: "选题策划", href: "/dashboard/topic", icon: Lightbulb },
      { name: "脚本生成", href: "/dashboard/script", icon: FileText },
      { name: "分镜脚本", href: "/dashboard/storyboard", icon: Film },
      { name: "审稿优化", href: "/dashboard/review", icon: CheckCircle },
      { name: "标题封面", href: "/dashboard/title", icon: Tag },
    ],
  },
  {
    label: "账号运营",
    items: [
      { name: "账号定位", href: "/dashboard/positioning", icon: Target },
      { name: "成交理由", href: "/dashboard/deal-reason", icon: Award },
      { name: "个人档案", href: "/dashboard/profiles", icon: User },
    ],
  },
  {
    label: "助手与资料",
    items: [
      { name: "高阶自由", href: "/dashboard/free-chat", icon: MessagesSquare },
      { name: "知识库", href: "/dashboard/knowledge", icon: BookOpen },
    ],
  },
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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      {/*
        侧边栏用真玻璃（.glass 带模糊）：它常驻、面积固定，模糊开销可控，
        且背景光晕正好从它下面透上来，是最能体现质感的位置。
      */}
      <aside
        className={`glass fixed inset-y-0 left-0 z-40 flex h-screen w-[272px] flex-col border-y-0 border-l-0 transition-transform duration-300 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 品牌区 */}
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-primary/25">
              <Sparkles className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight text-foreground">
                小宋编导工作台
              </div>
              <div className="truncate text-[11px] leading-tight text-muted-foreground">
                AI 短视频创作智能体
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className={gi === 0 ? "" : "mt-5"}>
              {group.label && (
                <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
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
                      {/* 激活指示条。比整块实心填充更克制，也不会把图标文字压成反白 */}
                      {isActive && (
                        <span className="brand-gradient absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                      )}
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
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
          <ProfileSwitcher />
        </div>
      </aside>
    </>
  );
}
