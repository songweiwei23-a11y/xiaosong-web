"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (value: boolean) => void;
}

type Listener = () => void;

let toasts: ToastItem[] = [];
let confirms: ConfirmRequest[] = [];
let seq = 1;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function detectType(message: string): ToastType {
  const m = message || "";
  if (/^\s*(❌|⛔|🚫)/.test(m) || /(失败|错误|异常|无法|不能|请先|请输入|请选择|请填写|用完|至少)/.test(m)) {
    if (/(失败|错误|异常|无法|不能|用完)/.test(m)) return "error";
    return "warning";
  }
  if (/^\s*(✅|🎉|✨|👍)/.test(m) || /(成功|已复制|已保存|已更新|已重置|完成)/.test(m)) return "success";
  return "info";
}

export function notify(message: string, type?: ToastType, duration = 3200) {
  const id = seq++;
  const resolvedType = type ?? detectType(message);
  toasts = [...toasts, { id, type: resolvedType, message, duration }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export const toast = {
  success: (m: string, d?: number) => notify(m, "success", d),
  error: (m: string, d?: number) => notify(m, "error", d),
  warning: (m: string, d?: number) => notify(m, "warning", d),
  info: (m: string, d?: number) => notify(m, "info", d),
};

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = seq++;
    confirms = [...confirms, { id, message, resolve, ...options }];
    emit();
  });
}

function resolveConfirm(id: number, value: boolean) {
  const req = confirms.find((c) => c.id === id);
  if (req) req.resolve(value);
  confirms = confirms.filter((c) => c.id !== id);
  emit();
}

const toastStyles: Record<ToastType, { wrap: string; icon: string; Icon: typeof CheckCircle }> = {
  success: {
    wrap: "border-green-500/50/25 bg-emerald-500/10 dark:border-green-500/50/30 dark:bg-emerald-500/10",
    icon: "text-green-500",
    Icon: CheckCircle,
  },
  error: {
    wrap: "border-destructive/25 bg-destructive/10 dark:border-destructive/40/30 dark:bg-destructive/100/10",
    icon: "text-destructive",
    Icon: XCircle,
  },
  warning: {
    wrap: "border-amber-500/50/25 bg-amber-500/10 dark:border-amber-500/50/30 dark:bg-amber-500/10",
    icon: "text-amber-500",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "border-primary/20 bg-primary/10 dark:border-primary/50/30 dark:bg-primary/10",
    icon: "text-primary",
    Icon: Info,
  },
};

export function FeedbackHost() {
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  useEffect(() => subscribe(rerender), [rerender]);

  const activeConfirm = confirms[0];

  useEffect(() => {
    if (!activeConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(activeConfirm.id, false);
      if (e.key === "Enter") resolveConfirm(activeConfirm.id, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeConfirm]);

  return (
    <>
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const s = toastStyles[t.type];
          const Icon = s.Icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-4 fade-in ${s.wrap}`}
              role="status"
            >
              <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`} />
              <p className="flex-1 whitespace-pre-line text-sm font-medium text-foreground dark:text-foreground">
                {t.message}
              </p>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-muted-foreground transition-colors hover:text-muted-foreground dark:hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {activeConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-muted/50 backdrop-blur-sm animate-in fade-in"
            onClick={() => resolveConfirm(activeConfirm.id, false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl animate-in zoom-in-95 fade-in dark:border-border dark:bg-muted">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${
                  activeConfirm.tone === "danger"
                    ? "bg-destructive/15 text-destructive dark:bg-destructive/100/15 dark:text-red-400"
                    : "bg-primary/15 text-primary dark:bg-primary/15 dark:text-primary"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {activeConfirm.title ?? "确认操作"}
                </h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground dark:text-foreground">
                  {activeConfirm.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => resolveConfirm(activeConfirm.id, false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] dark:text-foreground dark:hover:bg-muted"
              >
                {activeConfirm.cancelText ?? "取消"}
              </button>
              <button
                onClick={() => resolveConfirm(activeConfirm.id, true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  activeConfirm.tone === "danger"
                    ? "bg-destructive hover:opacity-90"
                    : "bg-primary hover:opacity-90"
                }`}
              >
                {activeConfirm.confirmText ?? "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
