"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { SELECT_CLS } from "@/components/form/controls";
import {
  AdminPage, AdminPanelHint, Badge, Button, DataTable, Panel, StatCard, fieldLabel, type Column,
} from "@/components/admin/kit";

/*
 * 代理后台（2026-10-28）。代理只能看到：自己生成的邀请码、用这些码注册的客户（邮箱脱敏）、
 * 这些客户购买会员的账单，以及按月的分成。所有数据由服务端按代理身份过滤。
 */

interface Summary {
  displayName: string;
  rate: number;
  currentPeriod: string;
  totals: { customers: number; payers: number; orderCount: number; paidAmount: number; commission: number };
  thisMonth: { period: string; paidAmount: number; commission: number; settled: boolean; rate: number };
  months: { period: string; orderCount: number; payerCount: number; paidAmount: number; rate: number; commission: number; settled: boolean }[];
}

interface CodeRow {
  id: string;
  code: string;
  status: string;
  use_count: number | null;
  max_uses: number | null;
  notes: string | null;
  created_at: string;
}

interface CustomerRow {
  user_id: string;
  email: string;
  invitation_code: string;
  bound_at: string;
  orderCount: number;
  paidAmount: number;
}

interface BillRow {
  id: string;
  email: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  reviewed_at: string;
  period: string;
  rate: number;
  commission: number;
  settled: boolean;
}

const money = (n: number) => `¥${n.toFixed(2)}`;
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;
const dateText = (s: string) => new Date(s).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
const CYCLE: Record<string, string> = { monthly: "月付", yearly: "年付" };

export default function AgentPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [codeCount, setCodeCount] = useState(1);
  const [generating, setGenerating] = useState(false);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  const [period, setPeriod] = useState("");
  const [bills, setBills] = useState<BillRow[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agent/summary");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取失败");
      setSummary(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      const res = await fetch("/api/agent/codes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取邀请码失败");
      setCodes(data.codes || []);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setCodesLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch("/api/agent/customers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取客户失败");
      setCustomers(data.customers || []);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadBills = useCallback(async (p: string) => {
    setBillsLoading(true);
    setBillsError("");
    try {
      const qs = p ? `?period=${encodeURIComponent(p)}` : "";
      const res = await fetch(`/api/agent/bills${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取账单失败");
      setBills(data.bills || []);
    } catch (e) {
      setBillsError((e as Error).message);
    } finally {
      setBillsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadCodes();
    void loadCustomers();
  }, [loadSummary, loadCodes, loadCustomers]);

  useEffect(() => {
    void loadBills(period);
  }, [period, loadBills]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/agent/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: codeCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      notify(`已生成 ${data.created} 个邀请码`, "success");
      void loadCodes();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      notify(`已复制 ${code}`, "success");
    } catch {
      notify("复制失败，请手动选中", "error");
    }
  }

  if (forbidden) {
    return (
      <AdminPage title="代理后台" subtitle="这里是代理分成的后台。">
        <Link href="/dashboard" className="mb-4 inline-block text-[13px] text-primary">← 返回工作台</Link>
        <Panel>
          <p className="text-[14px] leading-relaxed">这个账号暂时不能使用代理后台：要么还没有开通代理，要么已经被停用。请联系管理员确认。</p>
        </Panel>
      </AdminPage>
    );
  }

  const codeColumns: Column<CodeRow>[] = [
    { key: "code", header: "邀请码", render: (c) => <span className="font-mono">{c.code}</span> },
    { key: "used", header: "已注册", render: (c) => c.use_count ?? 0 },
    { key: "status", header: "状态", render: (c) => (c.status === "active" ? <Badge tone="ok">可用</Badge> : <Badge tone="neutral">已作废</Badge>) },
    { key: "created", header: "生成时间", render: (c) => dateText(c.created_at) },
    { key: "copy", header: "", render: (c) => (
      <Button variant="ghost" size="sm" onClick={() => void copy(c.code)} aria-label="复制">
        <Copy className="h-3.5 w-3.5" />
      </Button>
    ) },
  ];

  const customerColumns: Column<CustomerRow>[] = [
    { key: "email", header: "客户邮箱", render: (c) => c.email },
    { key: "bound", header: "注册时间", render: (c) => dateText(c.bound_at) },
    { key: "code", header: "用的邀请码", render: (c) => <span className="font-mono">{c.invitation_code}</span> },
    { key: "orders", header: "会员购买次数", render: (c) => c.orderCount },
    { key: "paid", header: "累计充值", render: (c) => money(c.paidAmount) },
  ];

  const billColumns: Column<BillRow>[] = [
    { key: "time", header: "付款时间", render: (b) => dateText(b.reviewed_at) },
    { key: "email", header: "客户", render: (b) => b.email },
    { key: "plan", header: "套餐", render: (b) => `${b.plan_name}（${CYCLE[b.billing_cycle] ?? b.billing_cycle}）` },
    { key: "amount", header: "金额", render: (b) => money(b.amount) },
    { key: "commission", header: "分成", render: (b) => (
      <span>
        {money(b.commission)} <span className="text-[12px] text-muted-foreground">（{pct(b.rate)}{b.settled ? "，已结算" : "，未结算"}）</span>
      </span>
    ) },
  ];

  const monthColumns: Column<NonNullable<Summary>["months"][number]>[] = [
    { key: "period", header: "月份", render: (m) => m.period },
    { key: "payers", header: "充值人数", render: (m) => m.payerCount },
    { key: "orders", header: "会员单数", render: (m) => m.orderCount },
    { key: "paid", header: "充值金额", render: (m) => money(m.paidAmount) },
    { key: "commission", header: "分成", render: (m) => money(m.commission) },
    { key: "state", header: "状态", render: (m) => (m.settled ? <Badge tone="ok">已结算</Badge> : <Badge tone="warn">未结算</Badge>) },
  ];

  const t = summary?.totals;
  const tm = summary?.thisMonth;

  return (
    <AdminPage
      title="代理后台"
      subtitle={summary ? `${summary.displayName || "代理"} · 费率 ${pct(summary.rate)}（统一）` : "你的客户、邀请码和分成"}
    >
      <Link href="/dashboard" className="mb-4 inline-block text-[13px] text-primary">← 返回工作台</Link>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="本月分成" value={tm ? money(tm.commission) : "—"} hint={tm ? (tm.settled ? "已结算" : "未结算，按当前费率") : undefined} />
        <StatCard label="本月充值" value={tm ? money(tm.paidAmount) : "—"} />
        <StatCard label="累计客户" value={t ? t.customers : "—"} hint={t ? `付费 ${t.payers} 人` : undefined} />
        <StatCard label="累计分成" value={t ? money(t.commission) : "—"} hint={t ? `充值 ${money(t.paidAmount)}` : undefined} />
      </div>
      {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}
      {loading && !summary && <p className="mb-4 text-[13px] text-muted-foreground">正在读取…</p>}

      <Panel title="我的邀请码" className="mb-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <span className={fieldLabel}>生成数量（1 到 20）</span>
            <select value={codeCount} onChange={(e) => setCodeCount(Number(e.target.value))} className={SELECT_CLS}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Button variant="primary" onClick={() => void generate()} busy={generating}>生成邀请码</Button>
        </div>
        <DataTable columns={codeColumns} rows={codes} rowKey={(c) => c.id} loading={codesLoading} empty="还没有邀请码，先生成一个发给客户" />
        <div className="mt-3">
          <AdminPanelHint>客户用这个码注册，就会记到你名下。一个码可以给多人用。</AdminPanelHint>
        </div>
      </Panel>

      <Panel title="我的客户" className="mb-5">
        <DataTable columns={customerColumns} rows={customers} rowKey={(c) => c.user_id} loading={customersLoading} empty="还没有客户" />
      </Panel>

      <Panel title="每月分成" className="mb-5">
        <DataTable columns={monthColumns} rows={summary?.months ?? []} rowKey={(m) => m.period} loading={loading && !summary} empty="还没有会员订单" />
        <div className="mt-3">
          <AdminPanelHint>每月结算一次。已结算的月份按结算时的费率；未结算的按当前费率，可能还会变。</AdminPanelHint>
        </div>
      </Panel>

      <Panel title="账单（客户购买会员）" className="mb-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <span className={fieldLabel}>月份</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={SELECT_CLS}>
              <option value="">全部</option>
              {(summary?.months ?? []).map((m) => <option key={m.period} value={m.period}>{m.period}</option>)}
            </select>
          </div>
        </div>
        {billsError && <p className="mb-3 text-[13px] text-destructive">{billsError}</p>}
        <DataTable columns={billColumns} rows={bills} rowKey={(b) => b.id} loading={billsLoading} empty="这个月份还没有会员账单" />
      </Panel>
    </AdminPage>
  );
}
