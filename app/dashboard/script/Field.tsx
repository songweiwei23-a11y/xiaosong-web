"use client";

/**
 * 表单字段：标签左置、内容右置。
 *
 * 原先是「标签在上、控件在下」的垂直堆叠，一个字段占两行，十几个字段堆起来
 * 就是长长一条，而且每行的起始位置都不一样，视觉上很散。
 *
 * 改成标签左置有两个收益：
 * - 纵向高度直接省掉近一半；
 * - 右侧内容的起始位置全部对齐，形成一条垂直基准线。人眼对这种对齐极敏感，
 *   有没有这条线，观感差别很大。
 *
 * 窄屏（<640px）退回上下堆叠：手机上标签列会把内容挤到没法用。
 */

export function Field({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  /** 显示「必填」徽章 */
  required?: boolean;
  /** 显示「可选」徽章 */
  optional?: boolean;
  /** 控件下方的补充说明 */
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {/* 标签列定宽：不定宽的话每个字段的内容起点都不同，对齐轴就没了。
          88px 足够放下四个汉字加一个徽章，是这批标签里最长的情况 */}
      <div className="flex shrink-0 items-start gap-1.5 pt-2 sm:w-[88px] sm:justify-end">
        <span className="text-[13px] leading-5 text-muted-foreground">{label}</span>
        {(required || optional) && <Badge kind={required ? "required" : "optional"} />}
      </div>

      <div className="min-w-0 flex-1">
        {children}
        {hint && <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * 必填 / 可选徽章。
 * 取代原来的红色星号——星号在中文界面里更像报错标记，
 * 灰底小徽章既说明了规则，又不抢视线。
 */
function Badge({ kind }: { kind: "required" | "optional" }) {
  const isRequired = kind === "required";
  return (
    <span
      className={`shrink-0 rounded px-1 py-px text-[10px] leading-4 ${
        isRequired
          ? "bg-primary/15 text-primary"
          : "bg-foreground/[0.08] text-muted-foreground"
      }`}
    >
      {isRequired ? "必填" : "可选"}
    </span>
  );
}

/**
 * 带图标底座的选项卡片，用于脚本类型这类需要快速扫读的多选一。
 *
 * 纯文字卡片在四个并排时几乎分辨不出差异，得逐个读标题；
 * 加一个带身份色的图标方块后，扫一眼就能定位，这也是竞品界面
 * 看起来"精致"的一个重要来源。
 */
export function OptionCard({
  icon: Icon,
  title,
  desc,
  selected,
  accent = "primary",
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  selected: boolean;
  /** 图标底座的身份色 */
  accent?: "primary" | "amber" | "rose" | "emerald" | "violet" | "sky";
  onClick: () => void;
}) {
  const accents: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    amber: "bg-amber-500/15 text-amber-500",
    rose: "bg-rose-500/15 text-rose-500",
    emerald: "bg-emerald-500/15 text-emerald-500",
    violet: "bg-violet-500/15 text-violet-500",
    sky: "bg-sky-500/15 text-sky-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`glass-interactive flex items-start gap-3 rounded-xl border p-3.5 text-left ${
        selected ? "glass-selected" : "glass-panel"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5 text-foreground">{title}</span>
        {desc && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {desc}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * 分组卡片。取代原先一条到底的折叠面板串，
 * 每组自成一张卡片，块面清晰，扫读时能一眼分出段落。
 */
export function FieldGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      {title && (
        <div className="mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {title}
        </div>
      )}
      {/* 字段间距 20px：原先是 8–16px，挤在一起没有节奏 */}
      <div className="space-y-5">{children}</div>
    </div>
  );
}
