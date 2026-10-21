"use client";

import ProfileSwitcher from '@/app/dashboard/components/ProfileSwitcher';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { BrandSeal, BrandWordmark } from "@/components/brand/Brand";
import { useSetupProgress } from "@/hooks/useSetupProgress";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target,
  BookOpen, User, Home, Award, MessagesSquare, X, ChevronDown,
  Wallet, LayoutList, ClipboardList, Stethoscope, Rocket, UserCog, Crown, Bookmark, ListChecks, Compass, GraduationCap, FileSearch, Clapperboard, Shuffle, CalendarRange, CircleHelp, TrendingUp,
} from "lucide-react";

/*
 * 导航按「实际创作流程」分组并排序，而不是按功能上线的先后堆叠。
 *
 * 原先 11 项平铺成一长条，且顺序是乱的——脚本生成排在选题策划前面，
 * 但现实里先有选题才写脚本。分组后找功能从「扫一遍列表」变成
 * 「先定区域、再选功能」，功能越多这个差别越明显。
 */
const navGroups: {
  id: string;
  label: string | null;
  /** 组标题下面的一行提示（展开时才显示） */
  hint?: string;
  items: { name: string; href: string; icon: typeof Home; hint?: string }[];
}[] = [
  {
    id: "overview",
    label: null, // 总览不需要组标题，单独一项顶在最上面
    items: [
      { name: "工作台", href: "/dashboard", icon: Home },
      // 给压根不了解抖音的新手：6 关学会抖音怎么推荐、怎么拍、怎么发。放最上面，新人一眼能看到
      { name: "新手课堂", href: "/dashboard/course", icon: GraduationCap },
      /*
       * 原来这里是「我的作品」。产品方要求（2026-10-02）拆成两个：
       *   素材库：各板块收藏的好内容，按分类找、随时拿去继续创作
       *   创作进度：原「我的作品」，每条内容做到哪一步、拍没拍、发没发
       */
      { name: "素材库", href: "/dashboard/library", icon: Bookmark },
      { name: "创作进度", href: "/dashboard/works", icon: ListChecks },
      // 月报（体检 F3）：一个月发了什么、效果怎样、下个月计划，可以打印或存 PDF 发给客户
      { name: "月报", href: "/dashboard/report", icon: FileText },
      { name: "对标 & 热点", href: "/dashboard/benchmark", icon: TrendingUp },
    ],
  },
  {
    id: "create",
    label: "内容创作",
    items: [
      // 顺序即创作链路：先想清楚为了什么拍、往哪个方向 → 拆别人的爆款 → 定选题 → 写脚本 → 拆分镜 → 审稿 → 起标题
      // 当月内容规划（2026-10-09）：先定这个月发几条、怎么配比、分哪几个方向，再往下做方向和选题
      { name: "内容规划", href: "/dashboard/content-plan", icon: CalendarRange },
      { name: "创作方向", href: "/dashboard/direction", icon: Compass },
      { name: "拆解爆款", href: "/dashboard/breakdown", icon: Clapperboard },
      // 拆完别人的，借过来拍成自己的
      { name: "跨行业二创", href: "/dashboard/remix", icon: Shuffle },
      { name: "选题策划", href: "/dashboard/topic", icon: Lightbulb },
      { name: "脚本生成", href: "/dashboard/script", icon: FileText },
      { name: "分镜脚本", href: "/dashboard/storyboard", icon: Film },
      { name: "审稿优化", href: "/dashboard/review", icon: CheckCircle },
      { name: "标题封面", href: "/dashboard/title", icon: Tag },
    ],
  },
  {
    id: "operate",
    label: "账号运营",
    hint: "建议顺序：前采建档 → 账号定位 → 创作简报 → 起号",
    items: [
      // 定位的原料：编导的前采记录 → 档案。排在账号定位前面，先有准的档案再做定位
      { name: "前采建档", href: "/dashboard/interview", icon: FileSearch, hint: "把前采记录整理成账号档案，是定位的原料" },
      // 先定地基（六维），再按需深挖变现和内容两维
      { name: "账号定位", href: "/dashboard/positioning", icon: Target, hint: "从六个方面定下账号的地基" },
      { name: "商业定位", href: "/dashboard/business-positioning", icon: Wallet, hint: "账号靠什么赚钱（需要时再做）" },
      { name: "内容定位", href: "/dashboard/content-positioning", icon: LayoutList, hint: "账号长期拍什么内容（需要时再做）" },
      // 简报是把定位转译成各板块直接能用的指令，所以紧跟在定位后面
      { name: "创作简报", href: "/dashboard/creative-brief", icon: ClipboardList, hint: "把定位翻成各板块能直接用的写作指令" },
      // 药方：按目的和阶段给打法，存好后所有创作板块照它执行
      { name: "行业建议", href: "/dashboard/industry-advice", icon: Stethoscope, hint: "按你的行业和目标，给一套打法" },
      // 定位定完，起号决定"拍什么套路、前三秒怎么说"
      { name: "起号", href: "/dashboard/growth", icon: Rocket, hint: "新号前几条怎么拍、前三秒怎么说" },
      { name: "成交理由", href: "/dashboard/deal-reason", icon: Award },
      { name: "个人档案", href: "/dashboard/profiles", icon: User },
    ],
  },
  {
    id: "assist",
    label: "助手与资料",
    items: [
      // 原名「高阶自由」看不出是干什么的，改成直说的名字
      { name: "自由对话", href: "/dashboard/free-chat", icon: MessagesSquare, hint: "什么都能问：联网查资料、读图片和文档、出方案、深度研究" },
      { name: "知识库", href: "/dashboard/knowledge", icon: BookOpen },
    ],
  },
  {
    /*
     * 会员中心原来不在导航里，只能从工作台首页一个小字链接或额度弹窗进。
     * 付费用户想看自己还剩几天、订单审没审过，根本找不到地方。
     */
    id: "account",
    label: "账户",
    items: [
      { name: "我的账户", href: "/dashboard/account", icon: UserCog },
      { name: "会员中心", href: "/dashboard/membership", icon: Crown },
      // 参考资料：每个板块干什么、额度怎么算、常见问题（2026-10-17）
      { name: "使用说明", href: "/dashboard/help", icon: CircleHelp, hint: "每个板块干什么、额度怎么算、常见问题" },
    ],
  },
];

/** 「先打地基」每一步对应侧栏里的哪一项（体检 P1-2：下一步在侧栏上标出来） */
const NEXT_NAV: Record<"profile" | "positioning" | "brief", string> = {
  profile: "/dashboard/profiles",
  positioning: "/dashboard/positioning",
  brief: "/dashboard/creative-brief",
};

const COLLAPSE_KEY = "xiaosong-sidebar-collapsed";

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
  // 下一步该做的那一项，侧栏上标「下一步」；三步全做完就不标
  const { steps: setup } = useSetupProgress();
  const nextStep = setup.find((s) => !s.done);
  const nextNavHref = nextStep ? NEXT_NAV[nextStep.key as keyof typeof NEXT_NAV] : null;

  /** 哪些分组被收起来了。记在本地，下次进来保持上次的样子 */
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCollapsed(arr);
      }
    } catch {
      // 读不到就全部展开，不影响使用
    }
  }, []);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        // 存不下就只在本次会话生效
      }
      return next;
    });
  };

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
      {/*
        手机上整个抽屉一起滚：菜单加上底部的档案切换比矮屏还高，
        原来只有中间的菜单能滚，被挤得只剩两三项；电脑上照旧只滚菜单。
      */}
      <aside
        className={`glass fixed inset-y-0 left-0 z-40 flex h-screen h-dvh w-[272px] flex-col overflow-y-auto overscroll-contain border-y-0 border-l-0 transition-transform duration-300 md:static md:self-start md:m-3 md:h-[calc(100dvh-1.5rem)] md:rounded-[20px] md:border md:overflow-visible md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 品牌区 */}
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <BrandSeal size={36} />
            <div className="min-w-0">
              <div className="text-[19px] text-foreground">
                <BrandWordmark />
              </div>
              <div className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">
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

        <nav className="flex-[1_0_auto] px-3 pb-4 md:flex-1 md:overflow-y-auto">
          {navGroups.map((group, gi) => {
            const isCollapsed = group.label !== null && collapsed.includes(group.id);
            return (
              <div key={group.id} className={gi === 0 ? "" : "mt-4"}>
                {group.label && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!isCollapsed}
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 opacity-0 transition-all group-hover:opacity-100 ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                )}

                {!isCollapsed && group.hint && (
                  <p className="px-3 pt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">{group.hint}</p>
                )}

                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.hint}
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
                          {item.href === nextNavHref && (
                            <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-medium text-primary">下一步</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 底部只放档案切换。额度不放在侧边栏（占地方）：会员额度看首页，次数包在会员中心 */}
        <div className="shrink-0 border-t border-border/60 p-3">
          <ProfileSwitcher />
        </div>
      </aside>
    </>
  );
}
