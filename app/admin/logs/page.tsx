"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { INPUT_CLS, SELECT_CLS } from "@/components/form/controls";
import { AdminPage, Badge, Button, DataTable, FilterBar, Pager, readError, type Column } from "@/components/admin/kit";

/*
 * 操作日志。谁、什么时候、对谁、做了什么，都能查，也能导出 CSV 留档。
 * 碰钱和权限的动作（开会员、延期、改套餐、授权管理员、重置密码）标红。
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
  newEnd: "新到期",
  previousEnd: "原到期",
  days: "天数",
  expiresAt: "有效期至",
  order_amount: "金额",
  billing_cycle: "周期",
  note: "备注",
  notes: "备注",
  count: "数量",
  status: "状态",
  email: "邮箱",
  qrcode_url: "收款码",
  isActive: "启用",
};
const HIDDEN_DETAILS = new Set(["targetUserId"]);

function fmtValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "order_amount") return `¥${v}`;
  if (k === "billing_cycle") return v === "yearly" ? "年付" : "月付";
  if (k === "isActive") return v ? "是" : "否";
  if ((k === "endDate" || k === "expiresAt" || k === "newEnd" || k === "previousEnd") && typeof v === "string") {
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const query = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (action) qs.set("action", action);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return qs;
  }, [page, action, from, to]);

  // 读取本身不同步改加载态（effect 里调用它，不会引起级联渲染）；加载态由 load 在触发前切换
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/logs?${query()}`);
      if (!res.ok) throw new Error(await readError(res, "读取失败"));
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = query();
      qs.set("format", "csv");
      const res = await fetch(`/api/admin/logs?${qs}`);
      if (!res.ok) throw new Error(await readError(res, "导出失败"));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `操作日志-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const columns: Column<Item>[] = [
    {
      key: "time",
      header: "时间",
      className: "whitespace-nowrap tabular-nums text-muted-foreground",
      render: (it) => fmtTime(it.createdAt),
    },
    {
      key: "action",
      header: "操作",
      render: (it) => (
        <Badge tone={it.sensitive ? "danger" : "neutral"}>
          {it.sensitive && <ShieldAlert className="mr-1 h-3 w-3" />}
          {it.label}
        </Badge>
      ),
    },
    { key: "admin", header: "操作人", className: "break-all", render: (it) => it.adminEmail },
    {
      key: "target",
      header: "对象",
      className: "break-all",
      render: (it) =>
        it.targetEmail ?? (
          <span className="text-muted-foreground">
            {it.targetType === "invitation_code" ? "邀请码" : it.targetType === "payment_qrcode" ? `收款码（${it.targetId}）` : "—"}
          </span>
        ),
    },
    {
      key: "details",
      header: "细节",
      render: (it) => {
        const details = Object.entries(it.details).filter(([k]) => !HIDDEN_DETAILS.has(k));
        if (details.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {details.map(([k, v]) => (
              <span key={k}>
                {DETAIL_LABELS[k] ?? k}：<span className="text-foreground">{fmtValue(k, v)}</span>
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <AdminPage
      title="操作日志"
      subtitle={data ? `所有管理员操作的记录，共 ${data.total} 条。红色标记的是碰钱和权限的操作` : "所有管理员操作的记录"}
      actions={
        <Button variant="default" onClick={() => void exportCsv()} busy={exporting}>
          <Download className="h-3.5 w-3.5" />导出 CSV
        </Button>
      }
    >
      <FilterBar>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          aria-label="按操作筛选"
          className={`${SELECT_CLS} w-auto py-2`}
        >
          <option value="">全部操作</option>
          {data && Object.entries(data.actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          从
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${INPUT_CLS} w-auto py-2`} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          到
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${INPUT_CLS} w-auto py-2`} />
        </label>
        {(action || from || to) && (
          <Button variant="ghost" onClick={() => { setAction(""); setFrom(""); setTo(""); setPage(1); }}>清空筛选</Button>
        )}
      </FilterBar>

      <div className="glass-panel rounded-2xl border border-border/60 p-2 sm:p-4">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(it) => it.id}
          loading={loading}
          error={error || undefined}
          onRetry={() => void load()}
          empty={action || from || to ? "这个条件下还没有操作记录" : "还没有任何操作记录"}
        />
        <Pager page={page} pageCount={pages} total={data?.total ?? 0} pageSize={data?.pageSize ?? 30} onChange={setPage} />
      </div>
    </AdminPage>
  );
}
