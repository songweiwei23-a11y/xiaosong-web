"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, Search } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { INPUT_CLS } from "@/components/form/controls";
import { exportOrdersToCSV } from "@/lib/export-utils";
import {
  AdminPage, Badge, Button, DataTable, Dialog, FilterBar, Pager, fieldLabel, readError, type Column,
} from "@/components/admin/kit";

interface Order {
  id: string;
  user_id: string;
  user_email?: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  payment_method: string;
  status: string;
  proof_image_url?: string | null;
  review_note?: string | null;
  created_at: string;
  proof_uploaded_at?: string | null;
  reviewed_at?: string | null;
}

type Counts = Record<string, number>;

const TABS: { value: string; label: string }[] = [
  { value: "reviewing", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "pending", label: "待付款" },
  { value: "all", label: "全部" },
];

const STATUS_BADGE: Record<string, { label: string; tone: "warn" | "ok" | "danger" | "neutral" }> = {
  pending: { label: "待付款", tone: "neutral" },
  reviewing: { label: "待审核", tone: "warn" },
  approved: { label: "已通过", tone: "ok" },
  rejected: { label: "已拒绝", tone: "danger" },
};

const PAGE_SIZE = 30;
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("zh-CN") : "—");

export default function AdminOrdersPage() {
  const [tab, setTab] = useState("reviewing");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [review, setReview] = useState<{ order: Order; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<Order | null>(null);

  // 从概览页点进来时带着状态参数：/admin/orders?status=reviewing
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s && TABS.some((t) => t.value === s)) setTab(s);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ status: tab, offset: String((page - 1) * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (q) qs.set("q", q);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/admin/orders?${qs}`);
      if (!res.ok) throw new Error(await readError(res, "加载订单失败"));
      const data = await res.json();
      setOrders(data.items ?? []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, q, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(draftQ.trim());
  };

  const changeTab = (v: string) => {
    setTab(v);
    setPage(1);
  };

  const doReview = async () => {
    if (!review) return;
    if (review.action === "reject" && !note.trim()) {
      notify("驳回请写明原因，用户会在「我的账户」里看到", "warning");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: review.order.id,
          approved: review.action === "approve",
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "审核失败", "error");
        return;
      }
      notify(data.message || (review.action === "approve" ? "订单已通过，会员已开通" : "订单已驳回"), "success");
      setReview(null);
      setNote("");
      void load();
    } catch {
      notify("网络不稳，审核没有提交，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Order>[] = [
    {
      key: "order",
      header: "订单",
      render: (o) => (
        <div>
          <div className="font-medium text-foreground">{o.plan_name}</div>
          <div className="text-[12px] text-muted-foreground">¥{o.amount} · {o.billing_cycle === "yearly" ? "年付" : "月付"}</div>
          <div className="text-[11px] text-muted-foreground/70">单号 {o.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "user",
      header: "用户",
      render: (o) => <span className="break-all text-[12.5px]">{o.user_email ?? "—"}</span>,
    },
    {
      key: "method",
      header: "支付方式",
      render: (o) => <span className="text-[12.5px]">{o.payment_method === "alipay" ? "支付宝" : "微信"}</span>,
    },
    {
      key: "time",
      header: "提交 / 审核",
      render: (o) => (
        <div className="text-[12px] text-muted-foreground">
          <div>提交 {fmt(o.created_at)}</div>
          {o.reviewed_at && <div>审核 {fmt(o.reviewed_at)}</div>}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (o) => {
        const s = STATUS_BADGE[o.status] ?? { label: o.status, tone: "neutral" as const };
        return (
          <div>
            <Badge tone={s.tone}>{s.label}</Badge>
            {o.review_note && <div className="mt-1 max-w-[14rem] text-[11.5px] text-muted-foreground">备注：{o.review_note}</div>}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "操作",
      className: "text-right",
      render: (o) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {o.proof_image_url && (
            <Button size="sm" variant="default" onClick={() => setProof(o)}>
              <Eye className="h-3.5 w-3.5" />凭证
            </Button>
          )}
          {o.status === "reviewing" && (
            <>
              <Button size="sm" variant="primary" onClick={() => { setReview({ order: o, action: "approve" }); setNote(""); }}>通过</Button>
              <Button size="sm" variant="danger" onClick={() => { setReview({ order: o, action: "reject" }); setNote(""); }}>驳回</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminPage
      title="订单审核"
      subtitle="用户按收款码转账后上传凭证，你核对到账后在这里通过，会员自动开通"
      actions={
        <Button
          variant="default"
          onClick={() =>
            exportOrdersToCSV(
              orders.map((o) => ({
                ...o,
                proof_image_url: o.proof_image_url ?? undefined,
                review_note: o.review_note ?? undefined,
                reviewed_at: o.reviewed_at ?? undefined,
              })),
              `orders-${new Date().toISOString().split("T")[0]}.csv`
            )
          }
          disabled={orders.length === 0}
        >
          导出本页（{orders.length}）
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => changeTab(t.value)}
            className={`glass-interactive rounded-xl border px-3.5 py-2 text-[13px] ${
              tab === t.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
            }`}
          >
            {t.label}
            {counts[t.value] !== undefined && <span className="ml-1.5 tabular-nums text-[12px] opacity-70">{counts[t.value]}</span>}
          </button>
        ))}
      </div>

      <FilterBar>
        <form onSubmit={submitSearch} className="flex min-w-[16rem] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="订单号、用户邮箱或用户编号"
              aria-label="搜索订单"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>
          <Button type="submit" variant="primary">搜索</Button>
        </form>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          从
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${INPUT_CLS} w-auto py-2`} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          到
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${INPUT_CLS} w-auto py-2`} />
        </label>
        {(q || from || to) && (
          <Button variant="ghost" onClick={() => { setDraftQ(""); setQ(""); setFrom(""); setTo(""); setPage(1); }}>清空筛选</Button>
        )}
      </FilterBar>

      <div className="glass-panel rounded-2xl border border-border/60 p-2 sm:p-4">
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(o) => o.id}
          loading={loading}
          error={error || undefined}
          onRetry={() => void load()}
          empty={q || from || to ? "没有符合条件的订单" : "这个状态下还没有订单"}
        />
        <Pager page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* 凭证：普通图片标签显示，签名链接 30 分钟后失效 */}
      <Dialog open={!!proof} onClose={() => setProof(null)} title="支付凭证" width="max-w-3xl">
        {proof && (
          <div className="space-y-4">
            <p className="text-muted-foreground">{proof.user_email} · {proof.plan_name} · ¥{proof.amount}</p>
            {proof.proof_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- 签名链接不走图片优化
              <img src={proof.proof_image_url} alt="支付凭证" className="max-h-[60vh] w-full rounded-xl border border-border bg-white object-contain" />
            ) : (
              <p className="text-amber-400">凭证链接已经失效，请让用户重新上传</p>
            )}
            {proof.status === "reviewing" && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => { setProof(null); setReview({ order: proof, action: "reject" }); setNote(""); }}>驳回</Button>
                <Button variant="primary" onClick={() => { setProof(null); setReview({ order: proof, action: "approve" }); setNote(""); }}>通过审核</Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* 审核确认：驳回必须写原因 */}
      <Dialog
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.action === "approve" ? "通过审核" : "驳回订单"}
        busy={busy}
        footer={
          <>
            <Button variant="default" onClick={() => setReview(null)} disabled={busy}>取消</Button>
            <Button
              variant={review?.action === "approve" ? "primary" : "danger"}
              onClick={() => void doReview()}
              busy={busy}
            >
              {review?.action === "approve" ? "确认通过，开通会员" : "确认驳回"}
            </Button>
          </>
        }
      >
        {review && (
          <>
            <p className="text-muted-foreground">
              {review.order.user_email} · {review.order.plan_name} · ¥{review.order.amount}
            </p>
            {review.action === "approve" ? (
              <p className="text-[12.5px] text-muted-foreground">通过后会员立即开通。确认到账再通过，开通后无法自动撤回。</p>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">驳回后用户会在「我的账户」里看到下面这句原因，请写清楚（比如「金额不对」「凭证看不清」）。</p>
            )}
            <label className="block">
              <span className={fieldLabel}>
                {review.action === "approve" ? "备注（可不填）" : "驳回原因（必填）"}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={200}
                className={INPUT_CLS}
                placeholder={review.action === "approve" ? "例如：已核对到账" : "例如：转账金额与订单不符"}
              />
            </label>
          </>
        )}
      </Dialog>
    </AdminPage>
  );
}
