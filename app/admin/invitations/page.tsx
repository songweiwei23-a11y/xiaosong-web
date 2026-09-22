"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Ticket, Plus, Copy, Check, Ban, RotateCcw, Loader2, Download, Search, Info,
} from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { Loading } from "@/components/ui/loading";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";
import { formatRelativeTime } from "@/lib/script-result-utils";

/*
 * 邀请码管理。
 *
 * invitation_codes 表早就存在（还有 100 个历史码），但代码里一处没引用，
 * 注册一直是完全开放的。这一页把它接上。
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
}

interface Stats {
  total: number; active: number; used: number; revoked: number; expired: number;
}

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "active", label: "未使用" },
  { value: "used", label: "已使用" },
  { value: "expired", label: "已过期" },
  { value: "revoked", label: "已作废" },
] as const;

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  active: { label: "未使用", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  used: { label: "已使用", cls: "bg-muted text-muted-foreground" },
  expired: { label: "已过期", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  revoked: { label: "已作废", cls: "bg-destructive/15 text-destructive" },
};

export default function AdminInvitationsPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [keyword, setKeyword] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // 生成表单
  const [count, setCount] = useState(10);
  const [planType, setPlanType] = useState("free");
  const [validDays, setValidDays] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: filter });
      if (keyword.trim()) params.set("q", keyword.trim());
      const res = await fetch(`/api/admin/invitations?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取失败");
      setCodes(data.codes || []);
      setStats(data.stats || null);
    } catch (e: any) {
      notify(e?.message || "读取邀请码失败");
    } finally {
      setLoading(false);
    }
  }, [filter, keyword]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
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
        notify(`已生成 ${data.created} 个，并复制到剪贴板`);
      } catch {
        notify(`已生成 ${data.created} 个`);
      }
      setNotes("");
      setFilter("active");
      load();
    } catch (e: any) {
      notify(e?.message || "生成失败");
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
      notify("复制失败，请手动选中");
    }
  };

  const copyAllActive = async () => {
    const list = codes.filter((c) => c.status === "active").map((c) => c.code);
    if (list.length === 0) return notify("当前列表里没有未使用的码");
    try {
      await navigator.clipboard.writeText(list.join("\n"));
      notify(`已复制 ${list.length} 个未使用的码`);
    } catch {
      notify("复制失败");
    }
  };

  const exportCsv = () => {
    const header = "邀请码,状态,套餐,使用者,使用时间,备注,过期时间\n";
    const rows = codes.map((c) =>
      [
        c.code,
        STATUS_STYLE[c.status]?.label ?? c.status,
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
      notify(restoring ? "已恢复" : "已作废");
      load();
    } catch (e: any) {
      notify(e?.message || "操作失败");
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground">邀请码</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            注册需要邀请码。一个码只能用一次，用完自动失效。
          </p>
        </header>

        {stats && (
          <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {([
              ["总数", stats.total, "gray"],
              ["未使用", stats.active, "emerald"],
              ["已使用", stats.used, "gray"],
              ["已过期", stats.expired, "amber"],
              ["已作废", stats.revoked, "rose"],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="glass-panel rounded-2xl p-4">
                <div className="text-[12px] text-muted-foreground">{label}</div>
                <div
                  className={`mt-1 text-[22px] font-semibold tabular-nums ${
                    tone === "emerald"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : tone === "amber"
                        ? "text-amber-600 dark:text-amber-400"
                        : tone === "rose"
                          ? "text-destructive"
                          : "text-foreground"
                  }`}
                >
                  {value}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 生成 */}
        <section className="glass-panel mb-4 rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <Plus className="h-4 w-4" />
            生成邀请码
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">数量</span>
              <input
                type="number" min={1} max={200} value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-[13px] text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">兑换后开通</span>
              <select
                value={planType} onChange={(e) => setPlanType(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-[13px] text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => (
                  <option key={id} value={id}>{SUBSCRIPTION_PLANS[id].name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">有效期（天）</span>
              <input
                type="number" min={1} value={validDays} placeholder="留空＝永久"
                onChange={(e) => setValidDays(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">备注</span>
              <input
                value={notes} placeholder="发给谁 / 什么活动"
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <button
            onClick={generate} disabled={generating}
            className="brand-gradient mt-4 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-white disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            生成 {count} 个
          </button>

          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            生成后会自动复制到剪贴板，直接粘贴发给对方即可。选了付费套餐的码，
            对方注册完就是会员，不用再手动开通。
          </p>
        </section>

        {/* 列表 */}
        <section className="glass-panel rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`glass-interactive rounded-xl border px-3 py-1.5 text-[12.5px] ${
                    filter === f.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索码"
                  className="w-36 rounded-xl border border-border bg-background/50 py-1.5 pl-8 pr-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                />
              </div>
              <button onClick={copyAllActive} className="glass-panel glass-interactive flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] text-foreground">
                <Copy className="h-3.5 w-3.5" />
                复制未使用
              </button>
              <button onClick={exportCsv} className="glass-panel glass-interactive flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] text-foreground">
                <Download className="h-3.5 w-3.5" />
                导出
              </button>
            </div>
          </div>

          {codes.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-muted-foreground">没有符合条件的邀请码</p>
          ) : (
            <div className="space-y-1.5">
              {codes.map((c) => {
                const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.active;
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <code className="font-mono text-[14px] font-semibold tracking-wider text-foreground">
                        {c.code}
                      </code>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${st.cls}`}>
                        {st.label}
                      </span>
                      {c.plan_type !== "free" && (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] text-primary">
                          {SUBSCRIPTION_PLANS[c.plan_type as keyof typeof SUBSCRIPTION_PLANS]?.name}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
                      <span className="truncate text-[11.5px] text-muted-foreground" suppressHydrationWarning>
                        {c.used_by_email
                          ? `${c.used_by_email} · ${c.used_at ? formatRelativeTime(c.used_at) : ""}`
                          : c.notes
                            ? c.notes
                            : c.expires_at
                              ? `${new Date(c.expires_at).toLocaleDateString("zh-CN")} 到期`
                              : ""}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyOne(c.code)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                          title="复制"
                        >
                          {copied === c.code ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        {/* 已使用的不给作废按钮：那只会把「谁用了这个码」的记录搞乱 */}
                        {c.status !== "used" && (
                          <button
                            onClick={() => toggleRevoke(c)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-destructive"
                            title={c.status === "revoked" ? "恢复" : "作废"}
                          >
                            {c.status === "revoked" ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
