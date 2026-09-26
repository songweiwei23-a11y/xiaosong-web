"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, KeyRound, Receipt, Loader2, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { INPUT_CLS, PRIMARY_BTN } from "@/components/form/controls";
import { throwApiError } from "@/lib/api-error";

/*
 * 我的账户：会员状态、我的订单、修改密码。
 *
 * 这三样之前全站都没有：
 *   - 到期时间在任何地方都看不到，用户只会某天发现额度突然变少
 *   - 订单付完款、传完凭证，一离开付款页就再也看不到审核结果；
 *     被驳回了用户也不会知道（查订单的接口其实早写好了，只是没有页面接）
 *   - 没有改密码的地方。忘了密码只能找客服重置，重置后拿到的临时密码
 *     也没处改——这一页就是那个"处"
 */

interface Account {
  email: string | null;
  banned: boolean;
  planId: string;
  planName: string;
  endDate: string | null;
  permanent: boolean;
  daysLeft: number | null;
  expired: { planName: string; endDate: string } | null;
}

interface Order {
  id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  billing_cycle: "monthly" | "yearly";
  status: "pending" | "reviewing" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

/** 订单状态怎么说给用户听。每种状态都要告诉他"接下来该干什么" */
const ORDER_STATUS: Record<Order["status"], { label: string; icon: typeof Clock; cls: string }> = {
  pending: { label: "待付款", icon: Clock, cls: "text-amber-500 bg-amber-500/10" },
  reviewing: { label: "审核中", icon: Clock, cls: "text-primary bg-primary/10" },
  approved: { label: "已开通", icon: CheckCircle2, cls: "text-emerald-500 bg-emerald-500/10" },
  rejected: { label: "未通过", icon: XCircle, cls: "text-destructive bg-destructive/10" },
};

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    // 两个请求互不依赖，并发取
    Promise.all([fetch("/api/account"), fetch("/api/orders")])
      .then(async ([a, o]) => {
        if (!a.ok) await throwApiError(a, "读取账户失败");
        setAccount(await a.json());
        // 订单读失败不该让整页挂掉：会员状态和改密码照样能用
        setOrders(o.ok ? await o.json() : []);
      })
      .catch((e) => setLoadError(e.message || "读取失败"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">我的账户</h1>

      {loadError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}，请刷新重试
        </div>
      )}

      <MembershipCard account={account} />
      <OrdersCard orders={orders} />
      <PasswordCard email={account?.email ?? null} />
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Crown; title: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel mb-4 rounded-2xl border border-border p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function MembershipCard({ account }: { account: Account | null }) {
  if (!account) {
    return (
      <Card icon={Crown} title="会员状态">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const paid = account.planId !== "free";

  return (
    <Card icon={Crown} title="会员状态">
      {account.banned && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          账户已被停用，如有疑问请联系客服微信 13240286600
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xl font-bold text-foreground">{account.planName}</span>
        {paid && account.permanent && <span className="text-sm text-muted-foreground">长期有效</span>}
        {paid && account.endDate && (
          <span className="text-sm text-muted-foreground">
            {fmtDate(account.endDate)} 到期
            {account.daysLeft !== null && (
              // 最后 7 天标出来——这正是该续费的时候，也是最容易忘的时候
              <span className={account.daysLeft <= 7 ? "ml-1 font-medium text-amber-500" : "ml-1"}>
                （还剩 {account.daysLeft} 天）
              </span>
            )}
          </span>
        )}
      </div>

      {account.expired && (
        <p className="mt-2 text-sm text-amber-500">
          你的{account.expired.planName}已于 {fmtDate(account.expired.endDate)} 到期，现按免费版计算额度
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Link href="/dashboard/membership" className={`${PRIMARY_BTN} !w-auto px-5`}>
          {paid ? "续费或升级" : account.expired ? "续费" : "升级会员"}
        </Link>
      </div>
    </Card>
  );
}

function OrdersCard({ orders }: { orders: Order[] | null }) {
  return (
    <Card icon={Receipt} title="我的订单">
      {orders === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有订单</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {orders.map((o) => {
            const s = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
            const Icon = s.icon;
            const payUrl = `/payment?plan=${o.plan_id}&cycle=${o.billing_cycle}`;
            return (
              <li key={o.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">{o.plan_name}</span>
                  <span className="text-sm text-muted-foreground">
                    ¥{o.amount} · {o.billing_cycle === "yearly" ? "年付" : "月付"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                </div>

                {/* 每种状态都要说清楚接下来怎么办，不能只丢一个标签 */}
                {o.status === "pending" && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    还没上传转账凭证。
                    <Link href={payUrl} className="text-primary hover:underline">继续付款 →</Link>
                  </p>
                )}
                {o.status === "reviewing" && (
                  <p className="mt-1.5 text-xs text-muted-foreground">凭证已提交，审核通过后套餐自动开通</p>
                )}
                {o.status === "rejected" && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {o.review_note ? `原因：${o.review_note}。` : "没有通过审核。"}
                    <Link href={payUrl} className="ml-1 text-primary hover:underline">重新付款 →</Link>
                    <span className="ml-1 text-muted-foreground">有疑问加微信 13240286600</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PasswordCard({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 两次输入不一致是最常见的错，前端先拦，不必白跑一趟服务端
    if (next !== confirm) {
      notify("两次输入的新密码不一样");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      // 服务端的文案（"当前密码不对""新密码至少 6 位"）要原样带给用户
      if (!res.ok) await throwApiError(res, "修改失败");
      notify("密码已修改，下次登录用新密码");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      notify(err?.message || "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={KeyRound} title="修改密码">
      {email && <p className="mb-3 text-sm text-muted-foreground">登录邮箱：{email}</p>}
      <form onSubmit={submit} className="max-w-sm space-y-3">
        {/* autoComplete 写对，浏览器的密码管理器才能正确识别并更新保存的密码 */}
        <input type="email" value={email ?? ""} autoComplete="username" readOnly hidden />
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="当前密码（客服重置过的，填临时密码）"
          autoComplete="current-password"
          className={INPUT_CLS}
          required
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="新密码，至少 6 位"
          autoComplete="new-password"
          minLength={6}
          className={INPUT_CLS}
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输一次新密码"
          autoComplete="new-password"
          minLength={6}
          className={INPUT_CLS}
          required
        />
        <button type="submit" disabled={busy} className={PRIMARY_BTN}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "修改密码"}
        </button>
      </form>
    </Card>
  );
}
