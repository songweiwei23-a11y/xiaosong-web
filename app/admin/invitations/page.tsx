"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Ban, RotateCcw, Download, Search } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import { formatRelativeTime } from "@/lib/script-result-utils";
import { INPUT_CLS, SELECT_CLS } from "@/components/form/controls";
import {
  AdminPage, AdminPanelHint, Badge, Button, DataTable, FilterBar, Panel, StatCard, fieldLabel, type Column,
} from "@/components/admin/kit";

/*
 * 邀请码管理。注册是邀请制：没有有效邀请码无法注册（数据库触发器强制）。
 * 生成后自动复制到剪贴板，直接粘贴发给对方即可。
 */

interface Code {
  id: string;
  code: string;
  status: "active" | "used" | "revoked" | "expired";
  plan_type: string;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
  used_by_email: string | null;
  /** 多人共用的码（首页公开体验码）：最多几次、已用几次。迁移前没有这两列 */
  max_uses?: number;
  use_count?: number;
}

interface Stats {
  total: number; active: number; used: number; revoked: number; expired: number;
}

const FILTERS = [
  { value: "active", label: "未使用" },
  { value: "used", label: "已使用" },
  { value: "expired", label: "已过期" },
  { value: "revoked", label: "已作废" },
  { value: "all", label: "全部" },
] as const;

const STATUS_BADGE: Record<string, { label: string; tone: "ok" | "neutral" | "warn" | "danger" }> = {
  active: { label: "未使用", tone: "ok" },
  used: { label: "已使用", tone: "neutral" },
  expired: { label: "已过期", tone: "warn" },
  revoked: { label: "已作废", tone: "danger" },
};

export default function AdminInvitationsPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("active");
  const [keyword, setKeyword] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // 生成表单
  const [count, setCount] = useState(10);
  const [planType, setPlanType] = useState("free");
  const [validDays, setValidDays] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // 读取本身不同步改加载态（effect 里调用它，不会引起级联渲染）；加载态由 load 在触发前切换
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: filter });
      if (keyword.trim()) params.set("q", keyword.trim());
      const res = await fetch(`/api/admin/invitations?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取失败");
      setCodes(data.codes || []);
      setStats(data.stats || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, keyword]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchData();
  }, [fetchData]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const generate = async () => {
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      notify("一次最多生成 200 个，请输入 1 到 200 之间的数字", "warning");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          planType,
          validDays: validDays ? Number(validDays) : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 生成完直接把码复制走——管理员十有八九下一步就是发给别人
      const text = (data.codes || []).map((c: Code) => c.code).join("\n");
      try {
        await navigator.clipboard.writeText(text);
        notify(`已生成 ${data.created} 个，并复制到剪贴板`, "success");
      } catch {
        notify(`已生成 ${data.created} 个`, "success");
      }
      setNotes("");
      setFilter("active");
      void load();
    } catch (e) {
      notify((e as Error).message || "生成失败", "error");
    } finally {
      setGenerating(false);
    }
  };

  const copyOne = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      notify("复制失败，请手动选中", "error");
    }
  };

  const copyAllActive = async () => {
    const list = codes.filter((c) => c.status === "active").map((c) => c.code);
    if (list.length === 0) return notify("当前列表里没有未使用的码", "warning");
    try {
      await navigator.clipboard.writeText(list.join("\n"));
      notify(`已复制 ${list.length} 个未使用的码`, "success");
    } catch {
      notify("复制失败", "error");
    }
  };

  const exportCsv = () => {
    const header = "邀请码,状态,套餐,使用者,使用时间,备注,过期时间\n";
    const rows = codes.map((c) =>
      [
        c.code,
        STATUS_BADGE[c.status]?.label ?? c.status,
        SUBSCRIPTION_PLANS[c.plan_type as keyof typeof SUBSCRIPTION_PLANS]?.name ?? c.plan_type,
        c.used_by_email ?? "",
        c.used_at ? new Date(c.used_at).toLocaleString("zh-CN") : "",
        (c.notes ?? "").replace(/,/g, "，"),
        c.expires_at ? new Date(c.expires_at).toLocaleDateString("zh-CN") : "永久",
      ].join(",")
    );
    // 加 BOM，否则 Excel 打开中文是乱码
    const blob = new Blob(["﻿" + header + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `邀请码-${new Date().toLocaleDateString("zh-CN")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleRevoke = async (c: Code) => {
    const restoring = c.status === "revoked";
    if (!restoring) {
      const ok = await confirmDialog(`确定作废 ${c.code}？作废后无法用它注册。`, {
        tone: "danger", confirmText: "作废", title: "确认作废",
      });
      if (!ok) return;
    }
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, action: restoring ? "restore" : "revoke" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(restoring ? "已恢复" : "已作废", "success");
      void load();
    } catch (e) {
      notify((e as Error).message || "操作失败", "error");
    }
  };

  const columns: Column<Code>[] = [
    {
      key: "code",
      header: "邀请码",
      render: (c) => (
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-[13.5px] font-semibold tracking-wider text-foreground">{c.code}</code>
          {(c.max_uses ?? 1) > 1 && <Badge tone="ok">公开码 · 已用 {c.use_count ?? 0} / {c.max_uses}</Badge>}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (c) => {
        const s = STATUS_BADGE[c.status] ?? STATUS_BADGE.active;
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: "plan",
      header: "兑换后开通",
      render: (c) => (c.plan_type === "free" ? <span className="text-muted-foreground">免费版</span> : <Badge tone="accent">{SUBSCRIPTION_PLANS[c.plan_type as keyof typeof SUBSCRIPTION_PLANS]?.name ?? c.plan_type}</Badge>),
    },
    {
      key: "info",
      header: "使用者 / 备注",
      render: (c) => (
        <div className="text-[12px] text-muted-foreground" suppressHydrationWarning>
          {c.used_by_email ? (
            <>
              <div className="break-all text-foreground/90">{c.used_by_email}</div>
              {c.used_at && <div>{formatRelativeTime(c.used_at)}</div>}
            </>
          ) : (
            <>
              {c.notes && <div>{c.notes}</div>}
              {c.expires_at && <div>{new Date(c.expires_at).toLocaleDateString("zh-CN")} 到期</div>}
              {!c.notes && !c.expires_at && <span>—</span>}
            </>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => copyOne(c.code)} aria-label="复制">
            {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {/* 已使用的不给作废按钮：那只会把「谁用了这个码」的记录搞乱 */}
          {c.status !== "used" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleRevoke(c)}
              aria-label={c.status === "revoked" ? "恢复" : "作废"}
              className={c.status === "revoked" ? "" : "hover:text-destructive"}
            >
              {c.status === "revoked" ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminPage title="邀请码" subtitle="注册是邀请制。一个码只能用一次，用完自动失效；选了付费套餐的码，对方注册即开通会员">
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="总数" value={stats.total} />
          <StatCard label="未使用" value={stats.active} tone="ok" />
          <StatCard label="已使用" value={stats.used} tone="muted" />
          <StatCard label="已过期" value={stats.expired} tone="warn" />
          <StatCard label="已作废" value={stats.revoked} tone="danger" />
        </div>
      )}

      <Panel title="生成邀请码" className="mb-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className={fieldLabel}>数量（最多 200）</span>
            <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className={fieldLabel}>兑换后开通</span>
            <select value={planType} onChange={(e) => setPlanType(e.target.value)} className={SELECT_CLS}>
              {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => (
                <option key={id} value={id}>{SUBSCRIPTION_PLANS[id].name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>有效期（天）</span>
            <input type="number" min={1} value={validDays} placeholder="留空＝永久" onChange={(e) => setValidDays(e.target.value)} className={INPUT_CLS} />
          </label>
          <label className="block">
            <span className={fieldLabel}>备注</span>
            <input value={notes} placeholder="发给谁 / 什么活动" onChange={(e) => setNotes(e.target.value)} className={INPUT_CLS} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void generate()} busy={generating}>生成 {count} 个</Button>
          <AdminPanelHint>生成后会自动复制到剪贴板，直接粘贴发给对方即可。</AdminPanelHint>
        </div>
      </Panel>

      <div className="glass-panel rounded-2xl border border-border/60 p-2 sm:p-4">
        <FilterBar>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`glass-interactive rounded-xl border px-3 py-1.5 text-[12.5px] ${
                  filter === f.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => { e.preventDefault(); setKeyword(draftKeyword.trim()); }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                placeholder="搜索邀请码"
                aria-label="搜索邀请码"
                className={`${INPUT_CLS} w-44 py-1.5 pl-8 text-[12.5px]`}
              />
            </form>
            <Button variant="default" size="sm" onClick={() => void copyAllActive()}>
              <Copy className="h-3.5 w-3.5" />复制未使用
            </Button>
            <Button variant="default" size="sm" onClick={exportCsv} disabled={codes.length === 0}>
              <Download className="h-3.5 w-3.5" />导出
            </Button>
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={codes}
          rowKey={(c) => c.id}
          loading={loading}
          error={error || undefined}
          onRetry={() => void load()}
          empty={keyword ? "没有符合搜索的邀请码" : "没有符合条件的邀请码"}
        />
      </div>
    </AdminPage>
  );
}
