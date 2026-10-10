"use client";

import Link from "next/link";
import { useEffect, useId, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

/*
 * 后台共用的界面组件。所有后台页面都从这里取页头、面板、表格、弹窗，
 * 保证每一页的间距、字号、按钮、空状态、错误状态一致。
 * 颜色统一用主题变量（glass-panel、text-foreground、border-border），
 * 后台固定深色，这些变量在深色下自动取对应的值。
 */

export function AdminPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // 外层的滚动由 layout 的 main 负责，这里不再另开滚动区域（否则会出现两层滚动条）
  return (
    <div className="px-1 py-1 sm:py-2">
      <div className="mx-auto max-w-6xl">
        <header className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden className="mt-1.5 h-5 w-1 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <h1 className="text-[21px] font-semibold tracking-tight text-foreground">{title}</h1>
              {subtitle && <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`glass-panel rounded-2xl border border-border/60 ${padded ? "p-5" : ""} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const STAT_TONE = {
  default: "text-foreground",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-rose-400",
  muted: "text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONE;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold tabular-nums ${STAT_TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </>
  );
  const cls = "glass-panel block rounded-2xl border border-border/60 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-primary/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const BUTTON = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  default: "glass-panel glass-interactive border border-border text-foreground",
  danger: "border border-destructive/40 text-destructive hover:bg-destructive/10",
  ghost: "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
} as const;

export function Button({
  variant = "default",
  size = "md",
  busy = false,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON;
  size?: "sm" | "md";
  busy?: boolean;
}) {
  const sz = size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-2 text-[13px]";
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${BUTTON[variant]} ${className}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** 面板里的说明文字：告诉管理员这一块会做什么、有什么边界 */
export function AdminPanelHint({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-relaxed text-muted-foreground">{children}</p>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "accent";
  children: ReactNode;
}) {
  const cls = {
    neutral: "bg-foreground/[0.07] text-foreground/80",
    ok: "bg-emerald-500/15 text-emerald-400",
    warn: "bg-amber-500/15 text-amber-400",
    danger: "bg-rose-500/15 text-rose-400",
    info: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${cls}`}>{children}</span>;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  className?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty = "暂无数据",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty?: ReactNode;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const placeholder =
    loading && rows.length === 0 ? (
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
    ) : rows.length === 0 ? (
      empty
    ) : null;

  return (
    <>
      {/* 桌面：表格。小屏横向滚动会很难看，所以 md 以下改用卡片（见下） */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-[13px]">
          <thead className="border-b border-border/60 text-left text-[11.5px] text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 font-medium ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {placeholder ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  {placeholder}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="align-top transition-colors hover:bg-foreground/[0.03]">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-3 text-foreground ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 手机：每行一张卡。第一列（通常是用户/订单的标识）放最上面，操作列放卡底 */}
      <div className="md:hidden">
        {placeholder ? (
          <div className="px-3 py-10 text-center text-muted-foreground">{placeholder}</div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={rowKey(row)} className="rounded-2xl border border-border/60 bg-foreground/[0.02] p-3.5 text-[13px]">
                {columns.map((c, i) => {
                  if (c.key === "actions") {
                    return (
                      <div key={c.key} className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
                        {c.render(row)}
                      </div>
                    );
                  }
                  if (i === 0) {
                    return (
                      <div key={c.key} className="min-w-0 text-foreground">
                        {c.render(row)}
                      </div>
                    );
                  }
                  return (
                    <div key={c.key} className="mt-2 flex gap-3">
                      <span className="w-16 shrink-0 pt-0.5 text-[11.5px] text-muted-foreground">{c.header}</span>
                      <div className="min-w-0 flex-1 text-foreground">{c.render(row)}</div>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
      <span className="tabular-nums">
        第 {from}–{to} 条，共 {total} 条
      </span>
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="上一页">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="tabular-nums">
          {page} / {Math.max(1, pageCount)}
        </span>
        <Button variant="default" size="sm" onClick={() => onChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label="下一页">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">{text}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {message}
      </span>
      {onRetry && (
        <Button variant="default" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

/**
 * 弹窗。Esc 或点遮罩关闭；打开时焦点落在弹窗里，标题与 aria 关联。
 * busy 为真时禁止关闭，防止操作中途被误关。
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width = "max-w-md",
  busy = false,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  busy?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`glass-panel max-h-[90dvh] w-full ${width} overflow-y-auto rounded-2xl border border-border p-5 shadow-2xl sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-[16px] font-semibold text-foreground">
            {title}
          </h3>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 text-[13px] text-foreground/90">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** 读接口的错误文字：优先用服务端给的 error，取不到就给通用提示 */
export async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

export const fieldLabel = "mb-1.5 block text-[12px] text-muted-foreground";
