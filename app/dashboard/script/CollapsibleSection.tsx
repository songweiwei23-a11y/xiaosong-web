"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children
}: {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    // 玻璃卡片 + 大圆角。原先是 border-2 的实心卡片，多个叠在一起时
    // 满屏都是粗边框，视觉上像表格而不像面板
    <div className="glass-panel overflow-hidden rounded-2xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-foreground/[0.04]"
      >
        <div className="flex items-center gap-3">
          {/* 图标放进品牌色底座，替代原来孤零零的蓝色线性图标 */}
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          <span className="text-[15px] font-medium text-foreground">{title}</span>
        </div>
        {/* 单个图标旋转，比上下两个图标来回切换更连贯 */}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="space-y-4 border-t border-border/60 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
