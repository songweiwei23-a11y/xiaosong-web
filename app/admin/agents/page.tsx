"use client";

import { useState, useEffect, useCallback } from "react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { INPUT_CLS } from "@/components/form/controls";
import {
  AdminPage, AdminPanelHint, Badge, Button, DataTable, Panel, fieldLabel, type Column,
} from "@/components/admin/kit";

/*
 * 代理分成（2026-10-28）。管理员：开通代理（按邮箱）、停用或启用、设统一费率、每月结算一次。
 * 结算只记账，打款线下做；结算后的月份不再变。
 */

interface AgentRow {
  id: string;
  email: string;
  display_name: string;
  status: "active" | "paused";
  created_at: string;
  customers: number;
  payers: number;
  paidAmount: number;
  commissionAtCurrentRate: number;
}

interface SettlementRow {
  agent_id: string;
  display_name: string;
  order_count: number;
  paid_amount: number;
  commission_rate: number;
  commission_amount: number;
  settled_at: string;
}

const money = (n: number) => `¥${n.toFixed(2)}`;

/** 上一个月（北京时间）。默认结算的就是它 */
function previousPeriodBeijing(): string {
  const d = new Date(Date.now() + 8 * 3600_000);
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminAgentsPage() {
  const [rate, setRate] = useState<number | null>(null);
  const [percentDraft, setPercentDraft] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  const [period, setPeriod] = useState(previousPeriodBeijing);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [settling, setSettling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/agents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取失败");
      setRate(data.rate);
      setAgents(data.agents || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettlements = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/admin/agents/settle?period=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取结算失败");
      setSettlements(data.settlements || []);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSettlements(period);
  }, [period, loadSettlements]);

  async function saveRate() {
    const value = percentDraft.trim();
    if (!value) return notify("请填写费率（百分比，比如 20）", "warning");
    try {
      const res = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setRate", percent: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPercentDraft("");
      notify("统一费率已保存（只影响之后的结算）", "success");
      void load();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function createAgent() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "开通失败");
      setEmail("");
      setDisplayName("");
      notify("代理已开通", "success");
      void load();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(a: AgentRow) {
    const next = a.status === "active" ? "paused" : "active";
    const ok = await confirmDialog(
      next === "paused" ? `停用 ${a.display_name || a.email}？停用后它不能再进代理后台，它的邀请码也不能再用来注册。客户和账单保留。` : `启用 ${a.display_name || a.email}？启用后邀请码恢复可用。`,
      { confirmText: next === "paused" ? "停用" : "启用" }
    );
    if (!ok) return;
    try {
      const res = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setStatus", id: a.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "操作失败");
      notify(next === "paused" ? "已停用" : "已启用", "success");
      void load();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function settle() {
    const ok = await confirmDialog(
      `结算 ${period} 的分成？每个代理按这个月的会员订单各记一条快照，记完就不再变。同一个月只能结一次。`,
      { confirmText: "结算" }
    );
    if (!ok) return;
    setSettling(true);
    try {
      const res = await fetch("/api/admin/agents/settle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "结算失败");
      notify(`已结算 ${data.settled} 个代理，跳过 ${data.skipped} 个（之前已结过）`, "success");
      void loadSettlements(period);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSettling(false);
    }
  }

  const agentColumns: Column<AgentRow>[] = [
    { key: "name", header: "代理", render: (a) => (
      <div>
        <div className="font-medium">{a.display_name || "（未命名）"}</div>
        <div className="text-[12px] text-muted-foreground">{a.email}</div>
      </div>
    ) },
    { key: "status", header: "状态", render: (a) => (
      a.status === "active" ? <Badge tone="ok">启用</Badge> : <Badge tone="warn">已停用</Badge>
    ) },
    { key: "customers", header: "客户数", render: (a) => a.customers },
    { key: "payers", header: "充值人数", render: (a) => a.payers },
    { key: "paid", header: "累计充值", render: (a) => money(a.paidAmount) },
    { key: "commission", header: "累计分成（当前费率）", render: (a) => money(a.commissionAtCurrentRate) },
    { key: "actions", header: "", render: (a) => (
      <Button variant="ghost" size="sm" onClick={() => void toggleStatus(a)}>
        {a.status === "active" ? "停用" : "启用"}
      </Button>
    ) },
  ];

  const settlementColumns: Column<SettlementRow>[] = [
    { key: "name", header: "代理", render: (s) => s.display_name },
    { key: "orders", header: "会员单数", render: (s) => s.order_count },
    { key: "paid", header: "充值金额", render: (s) => money(s.paid_amount) },
    { key: "rate", header: "费率", render: (s) => `${(s.commission_rate * 100).toFixed(2)}%` },
    { key: "commission", header: "分成", render: (s) => money(s.commission_amount) },
  ];

  return (
    <AdminPage title="代理分成" subtitle="代理用自己生成的邀请码拉新用户；这些用户购买会员后，按统一费率计分成，每月结算一次。">
      <Panel title="统一费率" className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className={fieldLabel}>当前费率</span>
            <div className="text-[18px] font-medium">{rate === null ? "读取中…" : `${(rate * 100).toFixed(2)}%`}</div>
          </div>
          <div>
            <span className={fieldLabel}>新费率（百分比）</span>
            <input value={percentDraft} onChange={(e) => setPercentDraft(e.target.value)} placeholder="比如 20" className={INPUT_CLS} />
          </div>
          <Button variant="primary" onClick={() => void saveRate()}>保存费率</Button>
        </div>
        <div className="mt-3">
          <AdminPanelHint>所有代理统一一个比例。修改只影响之后的结算；已经结算的月份保留结算时的费率。</AdminPanelHint>
        </div>
      </Panel>

      <Panel title="开通代理" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className={fieldLabel}>代理的账号邮箱</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="对方注册时用的邮箱" className={INPUT_CLS} />
          </div>
          <div>
            <span className={fieldLabel}>显示名（可不填）</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="比如 小王团队" className={INPUT_CLS} />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={() => void createAgent()} busy={creating}>开通代理</Button>
          </div>
        </div>
        <div className="mt-3">
          <AdminPanelHint>对方要先自己注册账号，然后在这里填它的邮箱开通。开通后对方登录，点右上角头像菜单里的「代理后台」，就能看到自己的邀请码、客户和分成。</AdminPanelHint>
        </div>
      </Panel>

      <Panel title="代理列表" className="mb-5">
        <DataTable
          columns={agentColumns}
          rows={agents}
          rowKey={(a) => a.id}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty="还没有代理"
        />
      </Panel>

      <Panel title="月度结算" className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className={fieldLabel}>结算月份（北京时间，YYYY-MM）</span>
            <input value={period} onChange={(e) => setPeriod(e.target.value)} className={INPUT_CLS} />
          </div>
          <Button variant="primary" onClick={() => void settle()} busy={settling}>结算这个月</Button>
        </div>
        <div className="mt-3">
          <AdminPanelHint>只能结算已经过完的月份。每个代理按这个月的会员订单记一条快照；同一个月重复点不会重复记。打款线下做，系统只记账。</AdminPanelHint>
        </div>
        <div className="mt-4">
          <DataTable
            columns={settlementColumns}
            rows={settlements}
            rowKey={(s) => s.agent_id}
            empty="这个月还没有结算记录"
          />
        </div>
      </Panel>
    </AdminPage>
  );
}
