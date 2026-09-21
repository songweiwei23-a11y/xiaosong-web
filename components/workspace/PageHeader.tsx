"use client";

/**
 * 工作区页面的标题头。
 *
 * 统一成一种写法，是因为改版前每个页面各写各的：有的带 emoji、有的配彩色
 * 图标底座、字号从 20px 到 24px 不等、颜色各用各的主题色（分镜绿、
 * 成交理由橙、标题封面蓝）。八个页面切换时像进了八个不同的产品。
 *
 * 这里的取舍：标题不上色、不加图标。标题是结构不是强调——一屏之内
 * 有颜色的地方越少，有颜色的那个才越突出。
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  /** 右侧操作区，例如「一键示例」这类次要按钮 */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
