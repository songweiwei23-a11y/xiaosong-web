"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { SUBSCRIPTION_PLANS, quotaSummary } from "@/lib/config/plans";
import { beijingDate } from "@/lib/admin-dates";
import { INPUT_CLS, SELECT_CLS } from "@/components/form/controls";
import {
  AdminPage, Badge, Button, DataTable, Dialog, FilterBar, Pager, StatCard, fieldLabel, readError, type Column,
} from "@/components/admin/kit";
import { QuotaReconcilePanel } from "@/components/admin/QuotaReconcilePanel";

interface Sub {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  quota: { used: number; total: number };
  startDate: string | null;
  endDate: string | null;
}

interface Counts {
  all: number;
  expiringSoon: number;
  free: number;
  basic: number;
  pro: number;
  enterprise: number;
}

const PLAN_TONE: Record<string, "neutral" | "info" | "accent" | "warn"> = {
  free: "neutral",
  basic: "info",
  pro: "accent",
  enterprise: "warn",
};

const PAGE_SIZE = 30;
const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[];
const DAYS_PRESETS = [7, 30, 90, 365];
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("zh-CN") : "永久");

function daysLeft(end: string | null): string {
  if (!end) return "";
  const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400_000);
  if (d < 0) return "已到期";
  if (d === 0) return "今天到期";
  return `还剩 ${d} 天`;
}

export default function SubscriptionsManagement() {
  const [tab, setTab] = useState<"all" | "expiring" | keyof typeof SUBSCRIPTION_PLANS>("all");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);

  // 概览页「7 天内到期」点进来：/admin/subscriptions?expiringDays=7
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expiringDays")) setTab("expiring");
  }, []);
  const [items, setItems] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState<Sub | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const [extending, setExtending] = useState<Sub | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendBusy, setExtendBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ offset: String((page - 1) * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (tab === "expiring") qs.set("expiringDays", "7");
      else if (tab !== "all") qs.set("plan", tab);
      if (q) qs.set("q", q);
      const res = await fetch(`/api/admin/subscriptions?${qs}`);
      if (!res.ok) throw new Error(await readError(res, "加载会员列表失败"));
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(draftQ.trim());
  };

  const openEdit = (s: Sub) => {
    setEditing(s);
    setEditPlan(s.plan);
    setEditEnd(beijingDate(s.endDate));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const ok = await confirmDialog(
      `把 ${editing.email} 的会员改为「${SUBSCRIPTION_PLANS[editPlan as keyof typeof SUBSCRIPTION_PLANS]?.name ?? editPlan}」，${editEnd ? `到期日改为 ${editEnd}（北京时间当天结束）` : "到期日不变"}？`,
      { tone: "danger", confirmText: "确定修改", title: "修改会员" }
    );
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editing.user_id, plan: editPlan, endDate: editEnd || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "更新失败", "error");
        return;
      }
      notify(data.message || "会员信息已更新", "success");
      setEditing(null);
      void load();
    } catch {
      notify("网络不稳，没有保存，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitExtend = async () => {
    if (!extending) return;
    if (!Number.isInteger(extendDays) || extendDays < 1 || extendDays > 3650) {
      notify("延长天数要在 1 到 3650 之间", "warning");
      return;
    }
    setExtendBusy(true);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: extending.user_id, action: "extend", days: extendDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "延期失败", "error");
        return;
      }
      notify(data.message || "已延期", "success");
      setExtending(null);
      void load();
    } catch {
      notify("网络不稳，没有延期，请重试", "error");
    } finally {
      setExtendBusy(false);
    }
  };

  const resetQuota = async (s: Sub) => {
    const ok = await confirmDialog(`把 ${s.email} 的本期额度清零？`, { tone: "danger", confirmText: "确定重置", title: "重置额度" });
    if (!ok) return;
    const res = await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.user_id, action: "reset_quota" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify(data.message || "额度已重置", "success");
      void load();
    } else notify(data.error || "重置失败", "error");
  };

  const columns: Column<Sub>[] = [
    {
      key: "user",
      header: "用户",
      render: (s) => (
        <div className="min-w-0">
          <div className="break-all font-medium">{s.email}</div>
          <div className="text-[11px] text-muted-foreground/70">编号 {s.user_id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "套餐",
      render: (s) => (
        <div>
          <Badge tone={PLAN_TONE[s.plan] ?? "neutral"}>{SUBSCRIPTION_PLANS[s.plan as keyof typeof SUBSCRIPTION_PLANS]?.name ?? s.plan}</Badge>
          <div className="mt-1 max-w-[16rem] text-[11px] text-muted-foreground">{quotaSummary(s.plan)[0]}</div>
        </div>
      ),
    },
    {
      key: "quota",
      header: "本期额度",
      render: (s) => {
        const unlimited = s.quota.total === -1;
        const pct = unlimited || s.quota.total === 0 ? 0 : Math.min(100, (s.quota.used / s.quota.total) * 100);
        return (
          <div className="min-w-[8rem]">
            <div className="tabular-nums">{s.quota.used} / {unlimited ? "无限" : s.quota.total}</div>
            {!unlimited && (
              <div className="mt-1 h-1.5 w-full max-w-[8rem] rounded-full bg-foreground/[0.08]">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "end",
      header: "到期",
      render: (s) => (
        <div>
          <div>{fmtDate(s.endDate)}</div>
          {s.endDate && <div className="text-[11.5px] text-muted-foreground">{daysLeft(s.endDate)}</div>}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (s) => (
        <Badge tone={s.status === "active" ? "ok" : "danger"}>{s.status === "active" ? "生效中" : "未生效"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "操作",
      className: "text-right",
      render: (s) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="default" onClick={() => { setExtending(s); setExtendDays(30); }} disabled={s.plan === "free"}>延期</Button>
          <Button size="sm" variant="default" onClick={() => openEdit(s)}>改套餐</Button>
          <Button size="sm" variant="default" onClick={() => void resetQuota(s)}>清额度</Button>
        </div>
      ),
    },
  ];

  const tabs: { value: typeof tab; label: string; count?: number }[] = [
    { value: "all", label: "全部", count: counts?.all },
    { value: "expiring", label: "7 天内到期", count: counts?.expiringSoon },
    ...PLAN_IDS.map((id) => ({ value: id as typeof tab, label: SUBSCRIPTION_PLANS[id].name, count: counts?.[id] })),
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extendUntil = extending?.endDate && new Date(extending.endDate).getTime() > Date.now() ? extending.endDate : null;

  return (
    <AdminPage title="会员管理" subtitle="看每个会员的套餐、额度和到期时间；可以延期、改套餐、清零额度">
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="全部会员" value={counts?.all ?? "—"} />
        <StatCard label="7 天内到期" value={counts?.expiringSoon ?? "—"} tone={counts && counts.expiringSoon > 0 ? "warn" : "default"} href="/admin/subscriptions?expiringDays=7" hint="可以提前提醒续费" />
        <StatCard label="基础会员" value={counts?.basic ?? "—"} />
        <StatCard label="专业会员" value={counts?.pro ?? "—"} />
        <StatCard label="企业版" value={counts?.enterprise ?? "—"} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTab(t.value); setPage(1); }}
            className={`glass-interactive rounded-xl border px-3.5 py-2 text-[13px] ${
              tab === t.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 tabular-nums text-[12px] opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      <FilterBar>
        <form onSubmit={submitSearch} className="flex min-w-[16rem] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="搜索邮箱或用户编号" aria-label="搜索会员" className={`${INPUT_CLS} pl-9`} />
          </div>
          <Button type="submit" variant="primary">搜索</Button>
          {q && <Button variant="default" onClick={() => { setDraftQ(""); setQ(""); setPage(1); }}>清空</Button>}
        </form>
      </FilterBar>

      <div className="glass-panel rounded-2xl border border-border/60 p-2 sm:p-4">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(s) => s.id}
          loading={loading}
          error={error || undefined}
          onRetry={() => void load()}
          empty={q ? "没有找到匹配的会员" : tab === "expiring" ? "7 天内没有即将到期的付费会员" : "这里还没有会员记录"}
        />
        <Pager page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      <div className="mt-5">
        <QuotaReconcilePanel />
      </div>

      {/* 延期：在原到期日上加天数；永久会员不能延期 */}
      <Dialog
        open={!!extending}
        onClose={() => setExtending(null)}
        title="延长会员天数"
        busy={extendBusy}
        footer={
          <>
            <Button variant="default" onClick={() => setExtending(null)} disabled={extendBusy}>取消</Button>
            <Button variant="primary" onClick={() => void submitExtend()} busy={extendBusy}>确定延长</Button>
          </>
        }
      >
        {extending && (
          <>
            <p className="text-muted-foreground">{extending.email}</p>
            <p className="text-[12.5px] text-muted-foreground">
              当前到期：{extending.endDate ? fmtDate(extending.endDate) : "永久有效（永久会员不需要延期）"}
              {extendUntil && <> · 延长后将在 {new Date(new Date(extendUntil).getTime() + extendDays * 86400_000).toLocaleDateString("zh-CN")} 到期</>}
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExtendDays(d)}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] ${extendDays === d ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"}`}
                >
                  {d === 365 ? "一年" : `${d} 天`}
                </button>
              ))}
            </div>
            <label className="block">
              <span className={fieldLabel}>自定义天数（1–3650）</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                className={INPUT_CLS}
              />
            </label>
            <p className="text-[12px] text-muted-foreground">延期不改套餐，也不动本期额度；延期记录会写进操作日志。</p>
          </>
        )}
      </Dialog>

      {/* 改套餐和到期日 */}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="修改套餐"
        busy={saving}
        footer={
          <>
            <Button variant="default" onClick={() => setEditing(null)} disabled={saving}>取消</Button>
            <Button variant="primary" onClick={() => void saveEdit()} busy={saving}>保存</Button>
          </>
        }
      >
        {editing && (
          <>
            <p className="text-muted-foreground">{editing.email}</p>
            <label className="block">
              <span className={fieldLabel}>套餐</span>
              <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className={SELECT_CLS}>
                {PLAN_IDS.map((id) => (
                  <option key={id} value={id}>{SUBSCRIPTION_PLANS[id].name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>到期日期（不填就是永久）</span>
              <div className="flex gap-2">
                <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={INPUT_CLS} />
                <Button variant="default" onClick={() => setEditEnd("")}>设为永久</Button>
              </div>
            </label>
          </>
        )}
      </Dialog>

    </AdminPage>
  );
}
