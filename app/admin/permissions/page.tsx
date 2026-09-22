"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, UserPlus, Trash2, Loader2, Info } from "lucide-react";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { Loading } from "@/components/ui/loading";
import { formatRelativeTime } from "@/lib/script-result-utils";

/*
 * 权限管理。
 *
 * 这个页面此前不存在——但 /api/admin/permissions 接口早就写好了，
 * 被删掉的 admin-debug 页还提示过「请在权限管理页面设置管理员」。
 * 也就是说要加一个管理员，只能去数据库里手工改表。
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
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/permissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "读取失败");
      setAdmins(data.admins || []);
    } catch (e: any) {
      notify(e?.message || "读取管理员列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grant = async () => {
    const target = email.trim();
    if (!target) return notify("请输入对方的注册邮箱");

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_admin", email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message);
      setEmail("");
      load();
    } catch (e: any) {
      notify(e?.message || "授权失败");
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

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_admin", userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message);
      load();
    } catch (e: any) {
      notify(e?.message || "撤销失败");
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-[22px] font-semibold text-foreground">权限管理</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            谁能进入这个后台。管理员可以看到全部用户的数据、审核订单、修改会员套餐。
          </p>
        </header>

        <section className="glass-panel mb-4 rounded-2xl p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-foreground">添加管理员</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") grant(); }}
              placeholder="对方的注册邮箱"
              className="min-w-[240px] flex-1 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={grant}
              disabled={submitting}
              className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              设为管理员
            </button>
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            对方必须已经注册过。授权立即生效，不需要重新登录。
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-4 text-[14px] font-semibold text-foreground">
            当前管理员（{admins.length}）
          </h2>

          {admins.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">还没有任何管理员记录。</p>
          ) : (
            <div className="space-y-2">
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {a.email || "（邮箱未知）"}
                      </span>
                      {a.is_self && (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] text-primary">
                          你自己
                        </span>
                      )}
                      {a.source === "user_settings" && (
                        // 旧机制授权的。requireAdmin 仍然认，但新授权一律走 admin_roles
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          历史遗留授权
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11.5px] text-muted-foreground" suppressHydrationWarning>
                      {a.last_sign_in_at
                        ? `最近登录 ${formatRelativeTime(a.last_sign_in_at)}`
                        : "从未登录"}
                    </div>
                  </div>

                  {!a.is_self && (
                    <button
                      onClick={() => revoke(a)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      撤销
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
            为防止把自己锁在外面，不能撤销自己的权限。需要转交时，先把对方设为管理员，
            再由对方撤销你。
          </p>
        </section>
      </div>
    </div>
  );
}
