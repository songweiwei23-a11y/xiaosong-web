"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Loader2, Plus } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { PRIMARY_BTN, SELECT_CLS } from "@/components/form/controls";
import { SUPPORT_WECHAT } from "@/lib/config/contact";
import { throwApiError } from "@/lib/api-error";
import { postSafely } from "@/lib/safe-post";

/*
 * 代理后台（2026-10-28 改版）：放在工作台里，和管理后台完全分开，从右上角头像菜单进来。
 * 代理只看得到：自己生成的邀请码、用这些码注册的客户、这些客户购买会员的账单、每月分成。
 * 所有数据由服务端按代理身份过滤（/api/agent/*）。
 */

interface Month { period: string; orderCount: number; payerCount: number; paidAmount: number; rate: number; commission: number; settled: boolean }
interface Summary {
  displayName: string;
  rate: number;
  currentPeriod: string;
  totals: { customers: number; payers: number; orderCount: number; paidAmount: number; commission: number };
  thisMonth: Month;
  months: Month[];
}
interface CodeRow { id: string; code: string; status: string; use_count: number | null; created_at: string }
interface CustomerRow { user_id: string; email: string; invitation_code: string; bound_at: string; orderCount: number; paidAmount: number }
interface BillRow { id: string; email: string; plan_name: string; billing_cycle: string; amount: number; reviewed_at: string; rate: number; commission: number; settled: boolean }

const TABS = [
  { id: "codes", label: "我的邀请码" },
  { id: "customers", label: "我的客户" },
  { id: "bills", label: "会员账单" },
  { id: "months", label: "每月分成" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const money = (n: number) => `¥${n.toFixed(2)}`;
const pct = (r: number) => `${(r * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
const day = (s: string) => new Date(s).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
const CYCLE: Record<string, string> = { monthly: "月付", yearly: "年付" };
const PANEL = "glass-panel rounded-2xl border border-border p-4 sm:p-5";
const TH = "px-3 py-2 text-left text-[12px] font-medium text-muted-foreground";
const TD = "px-3 py-2.5 text-[13px] text-foreground";

/** 读数据：出错时用服务端的错误文案（throwApiError 会带上 status，403 就是不是代理） */
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) await throwApiError(res, "读取失败");
  return (await res.json()) as T;
}

export default function AgentPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("codes");

  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [codeCount, setCodeCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [period, setPeriod] = useState("");
  const [bills, setBills] = useState<BillRow[] | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getJson<Summary>("/api/agent/summary"));
    } catch (e) {
      if ((e as { status?: number }).status === 403) setForbidden(true);
      else setError((e as Error).message);
    }
  }, []);

  const loadCodes = useCallback(async () => {
    try { setCodes((await getJson<{ codes: CodeRow[] }>("/api/agent/codes")).codes ?? []); }
    catch (e) { notify((e as Error).message, "error"); setCodes([]); }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  // 标签页用到时再读，先读概览
  useEffect(() => {
    if (forbidden || !summary) return;
    if (tab === "codes" && codes === null) void loadCodes();
    if (tab === "customers" && customers === null) {
      getJson<{ customers: CustomerRow[] }>("/api/agent/customers")
        .then((d) => setCustomers(d.customers ?? []))
        .catch((e) => { notify((e as Error).message, "error"); setCustomers([]); });
    }
  }, [tab, forbidden, summary, codes, customers, loadCodes]);

  useEffect(() => {
    if (forbidden || !summary || tab !== "bills") return;
    setBills(null);
    getJson<{ bills: BillRow[] }>(`/api/agent/bills${period ? `?period=${encodeURIComponent(period)}` : ""}`)
      .then((d) => setBills(d.bills ?? []))
      .catch((e) => { notify((e as Error).message, "error"); setBills([]); });
  }, [tab, period, forbidden, summary]);

  async function generate() {
    setGenerating(true);
    try {
      // 写入走 postSafely：线路差时空闲连接断了会自动重发
      const res = await postSafely("/api/agent/codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: codeCount }) });
      if (!res.ok) await throwApiError(res, "生成失败");
      const data = await res.json();
      notify(`已生成 ${data.created} 个邀请码`, "success");
      await loadCodes();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); notify(`已复制${label}`, "success"); }
    catch { notify("复制失败，请手动选中", "error"); }
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">代理后台</h1>
        <section className={PANEL}>
          <p className="text-[14px] leading-relaxed text-foreground">这个账号暂时不能使用代理后台：还没有开通代理，或者已经停用。</p>
          <p className="mt-2 text-[13px] text-muted-foreground">想成为代理，加微信联系我们：
            <button type="button" onClick={() => void copy(SUPPORT_WECHAT, "微信号")} className="ml-1 font-medium text-primary underline-offset-2 hover:underline">{SUPPORT_WECHAT}</button>
          </p>
        </section>
      </div>
    );
  }

  const tm = summary?.thisMonth;
  const t = summary?.totals;
  const stats = [
    { label: "本月分成", value: tm ? money(tm.commission) : "—", hint: tm ? (tm.settled ? "已结算" : "未结算，按当前费率") : "" },
    { label: "本月充值", value: tm ? money(tm.paidAmount) : "—", hint: tm ? `${tm.payerCount} 人购买会员` : "" },
    { label: "累计客户", value: t ? `${t.customers} 人` : "—", hint: t ? `付费 ${t.payers} 人` : "" },
    { label: "累计分成", value: t ? money(t.commission) : "—", hint: t ? `充值 ${money(t.paidAmount)}` : "" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-foreground">代理后台</h1>
      <p className="mb-5 mt-1 text-[13px] text-muted-foreground">
        {summary ? `${summary.displayName || "代理"} · 统一费率 ${pct(summary.rate)} · 每月结算一次` : "你的邀请码、客户和分成"}
      </p>
      {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={PANEL}>
            <div className="text-[12px] text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{summary ? s.value : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}</div>
            {s.hint && <div className="mt-1 text-[11px] text-muted-foreground">{s.hint}</div>}
          </div>
        ))}
      </div>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-[14px] transition-colors ${tab === x.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <section className={PANEL}>
        {tab === "codes" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select value={codeCount} onChange={(e) => setCodeCount(Number(e.target.value))} className={`${SELECT_CLS} w-24`} aria-label="生成数量">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} 个</option>)}
              </select>
              <button type="button" onClick={() => void generate()} disabled={generating} className={PRIMARY_BTN}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 生成邀请码
              </button>
              <span className="text-[12px] text-muted-foreground">客户用你的码注册，就会记到你名下；一个码可以给多人用。</span>
            </div>
            <Table loading={codes === null} empty="还没有邀请码，先生成一个发给客户" head={["邀请码", "已注册", "状态", "生成时间", ""]}
              rows={(codes ?? []).map((c) => [
                <span key="c" className="font-mono">{c.code}</span>,
                `${c.use_count ?? 0} 人`,
                c.status === "active" ? "可用" : "已作废",
                day(c.created_at),
                <button key="b" type="button" onClick={() => void copy(c.code, "邀请码")} aria-label="复制邀请码" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button>,
              ])} />
          </>
        )}
        {tab === "customers" && (
          <Table loading={customers === null} empty="还没有客户" head={["客户邮箱", "注册时间", "用的邀请码", "购买会员", "累计充值"]}
            rows={(customers ?? []).map((c) => [c.email, day(c.bound_at), <span key="c" className="font-mono">{c.invitation_code}</span>, `${c.orderCount} 次`, money(c.paidAmount)])} />
        )}
        {tab === "bills" && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">月份</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${SELECT_CLS} w-32`} aria-label="月份">
                <option value="">全部</option>
                {(summary?.months ?? []).map((m) => <option key={m.period} value={m.period}>{m.period}</option>)}
              </select>
            </div>
            <Table loading={bills === null} empty="这个月份还没有会员账单" head={["付款时间", "客户", "套餐", "金额", "分成"]}
              rows={(bills ?? []).map((b) => [
                day(b.reviewed_at), b.email, `${b.plan_name}（${CYCLE[b.billing_cycle] ?? b.billing_cycle}）`, money(b.amount),
                <span key="c">{money(b.commission)} <span className="text-[11px] text-muted-foreground">{pct(b.rate)} · {b.settled ? "已结算" : "未结算"}</span></span>,
              ])} />
          </>
        )}
        {tab === "months" && (
          <>
            <Table loading={!summary} empty="还没有会员订单" head={["月份", "购买人数", "会员单数", "充值金额", "分成", "状态"]}
              rows={(summary?.months ?? []).map((m) => [m.period, `${m.payerCount} 人`, `${m.orderCount} 单`, money(m.paidAmount), money(m.commission), m.settled ? "已结算" : "未结算"])} />
            <p className="mt-3 text-[12px] text-muted-foreground">每月结算一次。已结算的月份按结算时的费率，不再变；未结算的按当前费率计算。</p>
          </>
        )}
      </section>
    </div>
  );
}

/** 简单表格：手机上横向滑动，不把页面撑宽 */
function Table({ head, rows, loading, empty }: { head: string[]; rows: React.ReactNode[][]; loading: boolean; empty: string }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead><tr className="border-b border-border">{head.map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">{r.map((c, j) => <td key={j} className={TD}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
