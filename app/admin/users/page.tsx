"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, Search } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { SUBSCRIPTION_PLANS, getPlan } from "@/lib/config/plans";
import { beijingDate } from "@/lib/admin-dates";
import { INPUT_CLS, SELECT_CLS } from "@/components/form/controls";
import {
  AdminPage, Badge, Button, DataTable, Dialog, FilterBar, Pager, fieldLabel, readError, type Column,
} from "@/components/admin/kit";

/** 改套餐下拉里的说明：名字 + 价格 + 各板块次数范围，全部从配置读 */
function planOptionLabel(id: string): string {
  const p = getPlan(id);
  const price = p.price ? ` ${p.price}元/月` : "";
  if (p.totalQuota === -1) return `${p.name}${price}（无限使用）`;
  if (p.totalQuota !== null) return `${p.name}${price}（所有功能合计 ${p.totalQuota} 次/月）`;
  const n = Object.values(p.quotas).filter((v) => v >= 0);
  const lo = Math.min(...n);
  const hi = Math.max(...n);
  return `${p.name}${price}（各板块 ${lo === hi ? lo : `${lo}-${hi}`} 次）`;
}

const PLAN_TONE: Record<string, "neutral" | "info" | "accent" | "warn"> = {
  free: "neutral",
  basic: "info",
  pro: "accent",
  enterprise: "warn",
};

interface User {
  user_id: string;
  email: string;
  full_name: string;
  membership_level: string;
  subscription_status: string;
  subscription_end: string | null;
  total_used: number;
  period_end: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface Detail {
  user: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; status: string };
  profile: { profile_name: string | null; account_platform: string[] | null; updated_at: string | null } | null;
  subscription: { plan: string; status: string; start_date: string | null; end_date: string | null } | null;
  quota: { used: number; periodEnd: string | null } | null;
  orders: { id: string; plan_name: string; amount: number; status: string; created_at: string; reviewed_at: string | null; review_note: string | null }[];
  generations: { task_type: string; created_at: string }[];
  logs: { id: string; createdAt: string; label: string; adminEmail: string; details: Record<string, unknown> }[];
}

const ORDER_LABEL: Record<string, string> = { pending: "待付款", reviewing: "待审核", approved: "已通过", rejected: "已拒绝" };
const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "danger" | "neutral" }> = {
  active: { label: "正常", tone: "ok" },
  inactive: { label: "已封禁", tone: "danger" },
};

const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("zh-CN") : "—");
const fmtDateTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("zh-CN") : "—");

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const [detail, setDetail] = useState<{ id: string; data: Detail | null; error: string } | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);
  const [del, setDel] = useState<{ user: User; preview: { email: string; counts: Record<string, number>; paidOrders: number } | null; error: string; input: string; busy: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search });
      const res = await fetch(`/api/admin/users?${qs}`);
      if (!res.ok) throw new Error(await readError(res, "获取用户列表失败"));
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (userId: string, action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, error: data.error as string | undefined };
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  };

  const openDetail = async (user: User) => {
    setDetail({ id: user.user_id, data: null, error: "" });
    try {
      const res = await fetch(`/api/admin/users?detail=${encodeURIComponent(user.user_id)}`);
      const data = await res.json().catch(() => ({}));
      setDetail((d) => (d && d.id === user.user_id ? { ...d, data: res.ok ? data : null, error: res.ok ? "" : data.error || "读取失败" } : d));
    } catch {
      setDetail((d) => (d && d.id === user.user_id ? { ...d, error: "读取失败，请重试" } : d));
    }
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setEditPlan(user.membership_level);
    setEditEndDate(beijingDate(user.subscription_end));
  };

  const saveMembership = async () => {
    if (!editing) return;
    const confirmed = await confirmDialog(
      `把 ${editing.email} 的会员改为「${planOptionLabel(editPlan)}」，到期${editEndDate ? `为 ${editEndDate}（北京时间当天结束）` : "设为永久"}？`,
      { tone: "danger", confirmText: "确定修改", title: "修改会员" }
    );
    if (!confirmed) return;
    setSaving(true);
    const { ok, error: err } = await act(editing.user_id, "update_membership", { plan: editPlan, endDate: editEndDate || null });
    setSaving(false);
    if (ok) {
      notify("会员等级已更新", "success");
      setEditing(null);
      void load();
    } else notify(err || "更新失败", "error");
  };

  const resetQuota = async (user: User) => {
    const ok = await confirmDialog(`把 ${user.email} 的本期额度清零？他的使用次数会立刻恢复。`, { tone: "danger", confirmText: "确定重置", title: "重置额度" });
    if (!ok) return;
    const r = await act(user.user_id, "reset_quota");
    if (r.ok) { notify("额度已重置", "success"); void load(); }
    else notify(r.error || "重置失败", "error");
  };

  const resetPassword = async (user: User) => {
    const ok = await confirmDialog(
      `给 ${user.email} 重置密码？他当前的密码会立刻失效。发临时密码前，请先在微信里核对对方身份。`,
      { tone: "danger", confirmText: "确定重置", title: "重置密码" }
    );
    if (!ok) return;
    const r = await act(user.user_id, "reset_password");
    if (r.ok && r.data.tempPassword) setTempPw({ email: user.email, password: r.data.tempPassword });
    else notify(r.error || "重置失败", "error");
  };

  const toggleBan = async (user: User) => {
    const banning = user.subscription_status === "active";
    if (banning) {
      const ok = await confirmDialog("封禁后他无法登录、无法使用任何功能。已登录的会话最多一小时内失效。", { tone: "danger", confirmText: "确定封禁", title: "封禁用户" });
      if (!ok) return;
    }
    const r = await act(user.user_id, banning ? "ban_user" : "unban_user");
    if (r.ok) { notify(banning ? "用户已封禁" : "用户已解封", "success"); void load(); }
    else notify(r.error || "操作失败", "error");
  };

  const openDelete = async (user: User) => {
    setDel({ user, preview: null, error: "", input: "", busy: false });
    const r = await act(user.user_id, "delete_preview");
    setDel((d) => (d && d.user.user_id === user.user_id ? { ...d, preview: r.ok ? r.data : null, error: r.ok ? "" : r.error || "读取失败" } : d));
  };

  const confirmDelete = async () => {
    if (!del?.preview || del.busy) return;
    setDel({ ...del, busy: true, error: "" });
    const r = await act(del.user.user_id, "delete_user", { confirmEmail: del.input });
    if (!r.ok) {
      setDel((d) => (d ? { ...d, busy: false, error: r.error || "删除失败，请重试" } : d));
      return;
    }
    notify(r.data.message || "已删除", "success");
    setDel(null);
    void load();
  };

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "用户",
      render: (u) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{u.full_name !== "未设置" ? u.full_name : u.email}</div>
          <div className="truncate text-[12px] text-muted-foreground">{u.email}</div>
          <div className="text-[11px] text-muted-foreground/70">编号 {u.user_id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "会员",
      render: (u) => (
        <div>
          <Badge tone={PLAN_TONE[u.membership_level] ?? "neutral"}>{SUBSCRIPTION_PLANS[u.membership_level as keyof typeof SUBSCRIPTION_PLANS]?.name ?? u.membership_level}</Badge>
          <div className="mt-1 text-[11.5px] text-muted-foreground">到期 {u.subscription_end ? fmtDate(u.subscription_end) : "永久 / 未设置"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (u) => {
        const s = STATUS_LABEL[u.subscription_status] ?? { label: u.subscription_status || "未知", tone: "neutral" as const };
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: "usage",
      header: "本期用量",
      className: "tabular-nums",
      render: (u) => <span>{u.total_used} 次</span>,
    },
    {
      key: "time",
      header: "注册 / 最近登录",
      render: (u) => (
        <div className="text-[12px] text-muted-foreground">
          <div>注册 {fmtDate(u.created_at)}</div>
          <div>登录 {u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : "从未"}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "操作",
      className: "text-right",
      render: (u) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="default" onClick={() => void openDetail(u)}>详情</Button>
          <Button size="sm" variant="default" onClick={() => openEdit(u)}>改会员</Button>
          <Button size="sm" variant="default" onClick={() => void resetQuota(u)}>清额度</Button>
          <Button size="sm" variant="default" onClick={() => void resetPassword(u)}>重置密码</Button>
          <Button size="sm" variant={u.subscription_status === "active" ? "danger" : "default"} onClick={() => void toggleBan(u)}>
            {u.subscription_status === "active" ? "封禁" : "解封"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => void openDelete(u)}>删除</Button>
        </div>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminPage
      title="用户管理"
      subtitle={search ? `搜索「${search}」，共 ${total} 人` : `全部注册用户，共 ${total} 人`}
    >
      <FilterBar>
        <form onSubmit={submitSearch} className="flex min-w-[16rem] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索邮箱、用户名或用户编号"
              aria-label="搜索用户"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>
          <Button type="submit" variant="primary">搜索</Button>
          {search && (
            <Button variant="default" onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>清空</Button>
          )}
        </form>
      </FilterBar>

      <div className="glass-panel rounded-2xl border border-border/60 p-2 sm:p-4">
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(u) => u.user_id}
          loading={loading}
          error={error || undefined}
          onRetry={() => void load()}
          empty={search ? "没有找到匹配的用户，换个关键词试试" : "还没有注册用户"}
        />
        <Pager page={page} pageCount={pageCount} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      {/* 用户详情 */}
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        title="用户详情"
        width="max-w-2xl"
      >
        {detail && !detail.data && !detail.error && <p className="text-muted-foreground">正在读取…</p>}
        {detail?.error && <p className="text-destructive">{detail.error}</p>}
        {detail?.data && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className={fieldLabel}>邮箱</div><div className="break-all">{detail.data.user.email ?? "—"}</div></div>
              <div><div className={fieldLabel}>名字</div><div>{detail.data.profile?.profile_name || "未设置"}</div></div>
              <div><div className={fieldLabel}>注册时间</div><div>{fmtDateTime(detail.data.user.created_at)}</div></div>
              <div><div className={fieldLabel}>最近登录</div><div>{fmtDateTime(detail.data.user.last_sign_in_at)}</div></div>
              <div>
                <div className={fieldLabel}>会员</div>
                <div>{SUBSCRIPTION_PLANS[detail.data.subscription?.plan as keyof typeof SUBSCRIPTION_PLANS]?.name ?? "免费版"} · {detail.data.subscription?.end_date ? `到期 ${fmtDate(detail.data.subscription.end_date)}` : "永久 / 未设置"}</div>
              </div>
              <div>
                <div className={fieldLabel}>账号状态</div>
                <Badge tone={STATUS_LABEL[detail.data.user.status]?.tone ?? "neutral"}>{STATUS_LABEL[detail.data.user.status]?.label ?? detail.data.user.status}</Badge>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium">最近订单</div>
              {detail.data.orders.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">没有订单</p>
              ) : (
                <ul className="divide-y divide-border/50 text-[12.5px]">
                  {detail.data.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{o.plan_name} · ¥{o.amount}</span>
                      <span className="text-muted-foreground">{fmtDate(o.created_at)} · {ORDER_LABEL[o.status] ?? o.status}</span>
                      {o.review_note && <span className="w-full text-[11.5px] text-muted-foreground">备注：{o.review_note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium">最近生成</div>
              {detail.data.generations.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">还没有生成过内容</p>
              ) : (
                <ul className="grid gap-1 text-[12.5px] sm:grid-cols-2">
                  {detail.data.generations.map((g, i) => (
                    <li key={i} className="flex justify-between gap-2"><span>{g.task_type}</span><span className="text-muted-foreground">{fmtDateTime(g.created_at)}</span></li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium">相关操作记录</div>
              {detail.data.logs.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">没有相关的管理员操作</p>
              ) : (
                <ul className="divide-y divide-border/50 text-[12.5px]">
                  {detail.data.logs.map((l) => (
                    <li key={l.id} className="py-2">
                      <span className="font-medium">{l.label}</span>
                      <span className="text-muted-foreground"> · {l.adminEmail} · {fmtDateTime(l.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* 改会员 */}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="修改会员"
        busy={saving}
        footer={
          <>
            <Button variant="default" onClick={() => setEditing(null)} disabled={saving}>取消</Button>
            <Button variant="primary" onClick={() => void saveMembership()} busy={saving}>确定修改</Button>
          </>
        }
      >
        {editing && (
          <>
            <p className="text-muted-foreground">用户：{editing.email}</p>
            <label className="block">
              <span className={fieldLabel}>会员套餐</span>
              <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className={SELECT_CLS}>
                {Object.keys(SUBSCRIPTION_PLANS).map((id) => (
                  <option key={id} value={id}>{planOptionLabel(id)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>到期时间（不填就是永久）</span>
              <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className={INPUT_CLS} />
            </label>
          </>
        )}
      </Dialog>

      {/* 临时密码：只显示这一次 */}
      <Dialog
        open={!!tempPw}
        onClose={() => setTempPw(null)}
        title="密码已重置"
        footer={<Button variant="primary" onClick={() => setTempPw(null)}>已发给用户，关闭</Button>}
      >
        {tempPw && (
          <>
            <p className="text-muted-foreground">{tempPw.email}</p>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.04] px-4 py-3">
              <code className="flex-1 select-all font-mono text-[18px] tracking-wider text-foreground">{tempPw.password}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard
                    .writeText(`你的临时密码是：${tempPw.password}\n登录后请点右上角的邮箱进入「我的账户」，改成你自己的密码。`)
                    .then(() => notify("已复制，可以直接粘贴到微信"))
                    .catch(() => notify("复制失败，请手动选中复制"));
                }}
              >
                <Copy className="h-3.5 w-3.5" />复制话术
              </Button>
            </div>
            <p className="text-[12px] leading-relaxed text-amber-400">
              这个密码只显示这一次，关掉就看不到了（它不会写进操作日志）。发给用户，并提醒他登录后到「我的账户」里改掉。
            </p>
          </>
        )}
      </Dialog>

      {/* 删除：先看有多少东西，输入邮箱确认才删 */}
      <Dialog
        open={!!del}
        onClose={() => setDel(null)}
        title={<span className="text-rose-400">删除用户</span>}
        busy={del?.busy}
        footer={
          <>
            <Button variant="default" onClick={() => setDel(null)} disabled={del?.busy}>取消</Button>
            <Button
              variant="danger"
              onClick={() => void confirmDelete()}
              busy={del?.busy}
              disabled={!del?.preview || del.input.trim().toLowerCase() !== del.preview.email.toLowerCase()}
            >
              永久删除
            </Button>
          </>
        }
      >
        {del && (
          <>
            <p className="text-muted-foreground">{del.user.email}</p>
            {!del.preview && !del.error && <p className="text-muted-foreground">正在读取这个用户的数据…</p>}
            {del.preview && (
              <>
                <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3 leading-relaxed">
                  <p className="font-medium text-destructive">删除后不能恢复，下面这些会全部删掉：</p>
                  <p className="mt-1 text-muted-foreground">
                    账号档案 {del.preview.counts.user_profiles ?? 0} 个 · 作品 {del.preview.counts.works ?? 0} 条 · 生成记录 {del.preview.counts.script_history ?? 0} 条 · 对话 {del.preview.counts.chat_conversations ?? 0} 个 · 素材 {del.preview.counts.material_library ?? 0} 条 · 订单 {del.preview.counts.payment_orders ?? 0} 笔，以及会员、额度、上传的文件和登录账号。
                  </p>
                  <p className="mt-1 text-muted-foreground">他要再用，只能拿邀请码重新注册。</p>
                  {del.preview.paidOrders > 0 && (
                    <p className="mt-2 font-medium text-amber-400">这个用户有 {del.preview.paidOrders} 笔已付款的订单，删除后订单记录也会删掉。确定是垃圾账号再删。</p>
                  )}
                </div>
                <label className="block">
                  <span className={fieldLabel}>输入这个用户的邮箱确认</span>
                  <input value={del.input} onChange={(e) => setDel({ ...del, input: e.target.value })} placeholder={del.preview.email} autoComplete="off" className={INPUT_CLS} />
                </label>
              </>
            )}
            {del.error && <p role="alert" className="text-destructive">{del.error}</p>}
          </>
        )}
      </Dialog>

    </AdminPage>
  );
}
