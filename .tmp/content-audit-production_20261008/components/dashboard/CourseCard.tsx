"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, GraduationCap } from "lucide-react";
import { COURSE_TOTAL, LESSONS, graduated } from "@/lib/newbie-course";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { useCollapsed } from "@/lib/home-prefs";

/**
 * 工作台首页的「抖音新手课」卡片：过了几关、下一关是什么、一键继续。
 * 可以折叠（和 7 天起号计划一样）；毕业后默认收起，只留一行。
 */
export function CourseCard({ className = "" }: { className?: string }) {
  const { passed, ready } = useCourseProgress();
  // 收没收按账号分开记（lib/home-prefs）；没记过的：毕业了默认收起
  const [collapsed, toggle] = useCollapsed("course", ready ? graduated(passed) : null);

  if (!ready || collapsed === null) return null;

  const done = graduated(passed);
  const next = LESSONS[passed];

  return (
    <section className={`glass-panel rounded-2xl p-5 ${className}`}>
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 text-[16px] font-semibold text-foreground">
          <GraduationCap className="h-5 w-5 text-primary" />
          抖音新手课
          <span className="text-[13px] font-normal text-muted-foreground">{done ? "· 已毕业" : passed === 0 ? "· 20 分钟学会拍抖音" : `· 下一关第 ${passed + 1} 关`}</span>
        </span>
        <span className="flex items-center gap-2 text-[12.5px] tabular-nums text-muted-foreground">
          {passed} / {COURSE_TOTAL} 关
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          <span className="sr-only">{collapsed ? "展开" : "收起"}</span>
        </span>
      </button>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${(passed / COURSE_TOTAL) * 100}%` }} />
      </div>

      {!collapsed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">
            {done
              ? "抖音怎么推荐、怎么拍、怎么发，你都学过了。随时可以回去翻复习目录。"
              : passed === 0
                ? "完全不了解抖音也没关系。6 关，每关读几条要点、答一道题，学会抖音怎么推荐、怎么拍、怎么发。"
                : `下一关：${next?.title}`}
          </p>
          <Link href="/dashboard/course" className="brand-gradient inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white">
            {done ? "复习目录" : passed === 0 ? "开始第 1 关" : "继续闯关"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
