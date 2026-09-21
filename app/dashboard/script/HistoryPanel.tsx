"use client";

import { useState } from "react";
import { History, MessageCircle, Trash2, ChevronDown, Type, Clock } from "lucide-react";
import {
  extractTitle,
  splitQualityReport,
  estimateSpeechStats,
  formatDuration,
  formatRelativeTime,
  parseQualitySummary,
} from "@/lib/script-result-utils";

/**
 * 历史脚本列表。
 *
 * 原先每条只显示「去掉格式符号后的前 80 字」，几条记录看上去几乎一样，
 * 根本认不出谁是谁；而且点进去只能「继续对话」，没有办法把旧脚本重新
 * 调回结果区查看——这是最影响日常使用的一处缺失。
 *
 * 现在每条给出：可辨识的标题、相对时间、字数与口播时长、质量分；
 * 点击整条即可载入结果区，操作按钮在悬停时才出现，平时不干扰阅读。
 */

export interface HistoryItem {
  id: string;
  result: string;
  created_at: string;
}

const COLLAPSED_COUNT = 4;

export function HistoryPanel({
  items,
  activeId,
  onLoad,
  onContinue,
  onDelete,
}: {
  items: HistoryItem[];
  /** 当前正在结果区展示的那条，用于高亮 */
  activeId?: string | null;
  onLoad: (item: HistoryItem) => void;
  onContinue: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  // 默认只露 4 条：历史通常几十条，全铺出来会把结果区挤到屏幕外
  const shown = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const rest = items.length - shown.length;

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13px] font-medium text-foreground">历史脚本</h3>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
      </div>

      <div className="space-y-1.5">
        {shown.map((item) => (
          <HistoryRow
            key={item.id}
            item={item}
            active={item.id === activeId}
            onLoad={() => onLoad(item)}
            onContinue={() => onContinue(item)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>

      {rest > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          展开其余 {rest} 条
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      {expanded && items.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          收起
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
        </button>
      )}
    </section>
  );
}

function HistoryRow({
  item,
  active,
  onLoad,
  onContinue,
  onDelete,
}: {
  item: HistoryItem;
  active: boolean;
  onLoad: () => void;
  onContinue: () => void;
  onDelete: () => void;
}) {
  const { body, report } = splitQualityReport(item.result || "");
  const title = extractTitle(body);
  const stats = estimateSpeechStats(body);
  const quality = parseQualitySummary(report);

  return (
    // 整行可点击载入。用 div + role 而非 button，因为内部还嵌着操作按钮，
    // button 里套 button 是非法结构，浏览器会把内层按钮的点击行为弄乱。
    <div
      role="button"
      tabIndex={0}
      onClick={onLoad}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLoad();
        }
      }}
      aria-label={`载入脚本：${title}`}
      className={`group cursor-pointer rounded-xl border p-3 transition-colors ${
        active
          ? "border-primary/50 bg-primary/[0.08]"
          : "border-transparent hover:border-border hover:bg-foreground/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{title}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            {/*
              相对时间在服务端与客户端必然算出不同的值：服务端渲染时是
              「3 分钟前」，等浏览器接手可能已经是「4 分钟前」，React 会判定
              hydration 不一致并报错。这类由时间流逝造成的差异正是
              suppressHydrationWarning 的用途——以客户端的值为准即可。
            */}
            <span suppressHydrationWarning>{formatRelativeTime(item.created_at)}</span>
            {stats.chars > 0 && (
              <>
                <span className="flex items-center gap-0.5">
                  <Type className="h-3 w-3" />
                  {stats.chars}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDuration(stats.seconds)}
                </span>
              </>
            )}
            {quality.score !== null && (
              <span
                className={
                  quality.score >= 9
                    ? "text-emerald-500"
                    : quality.score >= 8
                      ? "text-amber-500"
                      : "text-rose-500"
                }
              >
                {quality.score.toFixed(1)} 分
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮悬停才显形：平时露着会让列表显得吵，
            但键盘聚焦时必须可见，否则纯键盘用户无从操作 */}
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            label="继续对话"
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="删除"
            danger
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition-colors ${
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
