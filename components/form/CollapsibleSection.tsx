"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * 可折叠的字段分组。
 *
 * 视觉上与 Field.tsx 里的 FieldGroup 保持一致——组标题是一行小号大写字，
 * 不带图标底座、不画分隔线。早先这里是「彩色图标 + 15px 标题 + 横线」的重头部，
 * 光标题区就占掉 56px，八个分组叠起来，视线全被标题栏切碎，内容反而显得局促。
 *
 * 折叠能力保留：专业控制、账号定位这些进阶项默认收起，不占视线。
 */
export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** 仅在折叠状态下作为小提示显示，展开后不出现，避免与标题争夺注意力 */
  icon?: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    // p-5 与 FieldGroup 一致：内边距是「不紧凑」最直接的来源
    <div className="glass-panel rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="group flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors group-hover:text-muted-foreground">
          {Icon && <Icon className="h-3 w-3" />}
          {title}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 字段间距 20px。原先是 16px，配合 16px 的内边距，整块看起来是压实的 */}
      {isOpen && <div className="mt-4 space-y-5">{children}</div>}
    </div>
  );
}
