"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

/*
 * 操作日志。
 *
 * 数据一直在记（lib/admin-logger.ts），但之前没有任何地方能看——后台首页的
 * 「操作日志」按钮只弹"开发中"。你问过"怎么保证永远能掌控全站"：
 * 能掌控的前提是能查到谁、什么时候、对谁、做了什么。
 *
 * 碰钱和权限的动作（开会员、改套餐、授权管理员、重置密码）标红，
 * 被人动了手脚时最先要看的就是这几类。
 */

interface Item {
  id: string;
  createdAt: string;
  action: string;
  label: string;
  sensitive: boolean;
  adminEmail: string;
  targetEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
}

interface Resp {
  page: number;
  pageSize: number;
  total: number;
  actions: Record<string, string>;
  items: Item[];
}

/** 细节里常见字段的中文名。认不出的原样显示，不丢信息 */
const DETAIL_LABELS: Record<string, string> = {
  plan: "套餐",
  plan_name: "套餐",
  planType: "套餐",
  endDate: "到期",
  expiresAt: "有效期至",
  order_amount: "金额",
  billing_cycle: "周期",
  note: "备注",
  notes: "备注",
  count: "数量",
  status: "状态",
  email: "邮箱",
  qrcode_url: "收款码",
};
// 目标用户已经单独一列显示了，细节里不再重复
const HIDDEN_DETAILS = new Set(["targetUserId"]);

function fmtValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "order_amount") return `¥${v}`;
  if (k === "billing_cycle") return v === "yearly" ? "年付" : "月付";
  if ((k === "endDate" || k === "expiresAt") && typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("zh-CN");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const fmtTime = (s: string) =>
  new Date(s).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminLogsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (action) qs.set("action", action);
      const res = await fetch(`/api/admin/logs?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setData(json);
    } catch (e: any) {
      setError(e?.message || "读取失败");
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-[22px] font-semibold text-foreground">
              <FileText className="h-5 w-5" />
              操作日志
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              所有管理员操作的记录{data ? `，共 ${data.total} 条` : ""}。红色标记的是碰钱和权限的操作
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
            >
              <option value="">全部操作</option>
              {data &&
                Object.entries(data.actions).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
            <button
              onClick={load}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="glass-panel overflow-hidden rounded-2xl border border-border">
          {loading && !data ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : data && data.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {action ? "这类操作还没有记录" : "还没有任何操作记录"}
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-border/60 text-left text-[11.5px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">时间</th>
                  <th className="px-4 py-2.5 font-medium">操作</th>
                  <th className="px-4 py-2.5 font-medium">操作人</th>
                  <th className="px-4 py-2.5 font-medium">对象</th>
                  <th className="px-4 py-2.5 font-medium">细节</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data?.items.map((it) => {
                  const details = Object.entries(it.details).filter(([k]) => !HIDDEN_DETAILS.has(k));
                  return (
                    <tr key={it.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {fmtTime(it.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium ${
                            it.sensitive ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
                          }`}
                        >
                          {it.sensitive && <ShieldAlert className="h-3 w-3" />}
                          {it.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{it.adminEmail}</td>
                      <td className="px-4 py-3 text-foreground">
                        {it.targetEmail ?? (
                          <span className="text-muted-foreground">
                            {it.targetType === "invitation_code"
                              ? "邀请码"
                              : it.targetType === "payment_qrcode"
                                ? `收款码（${it.targetId}）`
                                : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {details.length === 0
                          ? "—"
                          : details.map(([k, v]) => (
                              <span key={k} className="mr-3 inline-block">
                                {DETAIL_LABELS[k] ?? k}：<span className="text-foreground">{fmtValue(k, v)}</span>
                              </span>
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data && pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-[13px] text-muted-foreground">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            第 {page} / {pages} 页
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
