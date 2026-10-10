"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { formatRelativeTime } from "@/lib/script-result-utils";
import { INPUT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Badge, Button, EmptyState, ErrorState, Panel, readError } from "@/components/admin/kit";

/*
 * 权限管理：谁能进入这个后台。管理员能看全部用户数据、审核订单、改会员套餐，授权要慎重。
 * 授权按邮箱做（对方必须已经注册过），立即生效，不需要重新登录。
 */

interface AdminUser {
  id: string;
  email?: string;
  role: string;
  source: "admin_roles" | "user_settings";
  created_at?: string;
  last_sign_in_at?: string;
  is_self: boolean;
}

export default function AdminPermissionsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error(await readError(res, "读取管理员列表失败"));
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grant = async () => {
    const target = email.trim();
    if (!target) return notify("请输入对方的注册邮箱", "warning");

    // 授予管理员等于把整个后台交出去，多一步确认，并且要对方真的是自己人
    const ok = await confirmDialog(
      `把 ${target} 设为管理员？对方将能看到全部用户数据、审核订单、修改会员套餐，并能删除用户。`,
      { tone: "danger", confirmText: "确定授予", title: "授予管理员权限" }
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_admin", email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message, "success");
      setEmail("");
      void load();
    } catch (e) {
      notify((e as Error).message || "授权失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (user: AdminUser) => {
    const ok = await confirmDialog(
      `确定撤销 ${user.email} 的管理员权限？他将无法再进入后台。`,
      { tone: "danger", confirmText: "撤销", title: "确认撤销" }
    );
    if (!ok) return;

    setBusyId(user.id);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_admin", userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message, "success");
      void load();
    } catch (e) {
      notify((e as Error).message || "撤销失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPage title="权限管理" subtitle="谁能进入这个后台。管理员可以看到全部用户的数据、审核订单、修改会员套餐">
      <Panel title="添加管理员" className="mb-5">
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void grant(); }}
            placeholder="对方的注册邮箱"
            aria-label="对方的注册邮箱"
            className={`${INPUT_CLS} min-w-[240px] flex-1`}
          />
          <Button variant="primary" onClick={() => void grant()} busy={submitting}>
            <UserPlus className="h-3.5 w-3.5" />设为管理员
          </Button>
        </div>
        <div className="mt-2.5">
          <AdminPanelHint>对方必须已经注册过。授权立即生效，不需要重新登录。</AdminPanelHint>
        </div>
      </Panel>

      <Panel title={`当前管理员（${admins.length}）`}>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">读取中…</p>
        ) : admins.length === 0 ? (
          <EmptyState text="还没有任何管理员记录" />
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span className="break-all text-[13.5px] font-medium text-foreground">{a.email || "（邮箱未知）"}</span>
                    {a.is_self && <Badge tone="info">你自己</Badge>}
                    {a.source === "user_settings" && <Badge tone="warn">历史遗留授权</Badge>}
                  </div>
                  <div className="mt-1 text-[11.5px] text-muted-foreground" suppressHydrationWarning>
                    {a.last_sign_in_at ? `最近登录 ${formatRelativeTime(a.last_sign_in_at)}` : "从未登录"}
                  </div>
                </div>
                {!a.is_self && (
                  <Button variant="danger" size="sm" onClick={() => void revoke(a)} busy={busyId === a.id}>
                    <Trash2 className="h-3.5 w-3.5" />撤销权限
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AdminPage>
  );
}
