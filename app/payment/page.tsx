"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Upload, Loader2, CheckCircle2, Clock, XCircle, QrCode, Info,
} from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { supabase } from "@/lib/supabase/client";
import { getPlan, SUBSCRIPTION_PLANS, quotaSummary } from "@/lib/config/plans";

/*
 * 付款页。
 *
 * 改造前这一页是纯演示：handlePayment 只是 setTimeout 一秒，
 * confirmPayment 直接弹「支付成功！会员已升级」然后跳回工作台——
 * 什么都没发生，既没有订单也没有开通。这是最坏的一种假，
 * 它告诉用户事情办成了。
 *
 * 现在的真实流程（人工核对，不接第三方支付接口）：
 *   1. 按 URL 里的套餐下单，金额由服务端按 plans.ts 现取，前端传什么都不算
 *   2. 显示管理员配置的收款码
 *   3. 用户转账后上传截图，订单进入待审
 *   4. 管理员在后台放行，会员开通
 */

type Step = "confirm" | "pay" | "done";

interface Order {
  id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  billing_cycle: string;
  payment_method: string;
  status: string;
  review_note?: string | null;
}

const METHODS = [
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
] as const;

function PaymentContent() {
  const searchParams = useSearchParams();

  const planId = searchParams?.get("plan") || "basic";
  const cycle = searchParams?.get("cycle") === "yearly" ? "yearly" : "monthly";

  const plan = getPlan(planId);
  const isPayable = planId !== "free" && planId in SUBSCRIPTION_PLANS;
  const amount = cycle === "yearly" ? plan.yearlyPrice : plan.price;

  const [method, setMethod] = useState<"alipay" | "wechat">("alipay");
  const [step, setStep] = useState<Step>("confirm");
  const [order, setOrder] = useState<Order | null>(null);
  const [qrcodes, setQrcodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // 收款码：表的 RLS 允许登录用户读，这里直接取
  useEffect(() => {
    supabase
      .from("payment_qrcodes")
      .select("payment_method, qrcode_url, is_active")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const q of data ?? []) {
          if (q.is_active && q.qrcode_url) map[q.payment_method] = q.qrcode_url;
        }
        setQrcodes(map);
      });
  }, []);

  const createOrder = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: cycle, paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "下单失败");
      setOrder(data);
      setStep(data.status === "reviewing" ? "done" : "pay");
    } catch (e: any) {
      notify(e?.message || "下单失败");
    } finally {
      setBusy(false);
    }
  }, [planId, cycle, method]);

  const uploadProof = async (file: File) => {
    if (!order) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("登录已过期，请重新登录");

      // 路径首段必须是自己的 user id——存储桶的 RLS 就是按这个判归属的
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${order.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: false });
      if (upErr) throw new Error("图片上传失败：" + upErr.message);

      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, proofPath: path, paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交失败");

      setOrder(data);
      setStep("done");
      notify("凭证已提交，等待管理员确认");
    } catch (e: any) {
      notify(e?.message || "提交失败");
    } finally {
      setBusy(false);
    }
  };

  if (!isPayable) {
    return (
      <Shell>
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-[14px] text-foreground">这个套餐不需要付费</p>
          <Link href="/dashboard/membership" className="mt-3 inline-block text-[13px] text-primary">
            回去选套餐
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
        {/* 订单 */}
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-5 text-[16px] font-semibold text-foreground">订单详情</h2>

          <dl className="space-y-3 text-[13px]">
            <Row label="套餐" value={plan.name} />
            <Row label="计费周期" value={cycle === "yearly" ? "年付" : "月付"} />
            {cycle === "yearly" && (
              <Row label="原价" value={`¥${plan.price * 12}`} muted strike />
            )}
            <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
              <dt className="text-muted-foreground">应付金额</dt>
              <dd className="text-[24px] font-semibold tabular-nums text-foreground">¥{amount}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-border/60 p-4">
            <p className="mb-2 text-[12px] font-medium text-foreground">开通后你将获得</p>
            <ul className="space-y-1">
              {quotaSummary(planId).map((l) => (
                <li key={l} className="flex gap-1.5 text-[12px] text-muted-foreground">
                  <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 付款 */}
        <section className="glass-panel rounded-2xl p-6">
          {step === "confirm" && (
            <>
              <h2 className="mb-5 text-[16px] font-semibold text-foreground">选择付款方式</h2>
              <div className="mb-5 grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={`glass-interactive rounded-xl border px-4 py-3 text-[13px] ${
                      method === m.value ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                onClick={createOrder}
                disabled={busy}
                className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-medium text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                生成订单并显示收款码
              </button>

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                目前为人工确认：转账后上传截图，管理员核对后为你开通，通常当天处理。
              </p>
            </>
          )}

          {step === "pay" && order && (
            <>
              <h2 className="mb-1 text-[16px] font-semibold text-foreground">
                扫码转账 ¥{order.amount}
              </h2>
              <p className="mb-4 text-[12px] text-muted-foreground">
                订单号 {order.id.slice(0, 8)} · {METHODS.find((m) => m.value === method)?.label}
              </p>

              {qrcodes[method] ? (
                <div className="mb-5 flex justify-center">
                  <div className="rounded-2xl bg-white p-3">
                    <Image
                      src={qrcodes[method]}
                      alt="收款二维码"
                      width={200}
                      height={200}
                      unoptimized
                      className="h-[200px] w-[200px] object-contain"
                    />
                  </div>
                </div>
              ) : (
                // 收款码没配时如实说明，不要显示一个空白框让用户对着扫
                <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[12.5px] text-muted-foreground">
                  管理员还没有上传{METHODS.find((m) => m.value === method)?.label}收款码，
                  请换一种付款方式，或联系客服获取收款账号。订单已经生成，
                  转账后回到这里上传截图即可。
                </div>
              )}

              <label className="glass-panel glass-interactive flex cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-medium text-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? "提交中…" : "上传转账截图"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadProof(f);
                  }}
                />
              </label>

              <p className="mt-3 text-[11.5px] text-muted-foreground">
                截图需能看清金额和时间。上传后订单进入待审，可以关掉页面。
              </p>
            </>
          )}

          {step === "done" && order && <OrderStatus order={order} />}
        </section>
      </div>
    </Shell>
  );
}

function OrderStatus({ order }: { order: Order }) {
  if (order.status === "approved") {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 text-[15px] font-semibold text-foreground">已开通</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{order.plan_name} 已生效</p>
        <Link href="/dashboard" className="mt-4 inline-block text-[13px] text-primary">
          回到工作台
        </Link>
      </div>
    );
  }

  if (order.status === "rejected") {
    return (
      <div className="py-6 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 text-[15px] font-semibold text-foreground">凭证未通过</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {order.review_note || "请确认转账金额与订单一致后重新提交"}
        </p>
        <Link href="/dashboard/membership" className="mt-4 inline-block text-[13px] text-primary">
          重新下单
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6 text-center">
      <Clock className="mx-auto h-10 w-10 text-amber-500" />
      <p className="mt-3 text-[15px] font-semibold text-foreground">已提交，等待确认</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        管理员核对后会为你开通 {order.plan_name}，通常当天处理。
      </p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">订单号 {order.id.slice(0, 8)}</p>
      <Link href="/dashboard" className="mt-4 inline-block text-[13px] text-primary">
        先回工作台
      </Link>
    </div>
  );
}

function Row({ label, value, muted, strike }: { label: string; value: string; muted?: boolean; strike?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${muted ? "text-muted-foreground" : "font-medium text-foreground"} ${strike ? "line-through" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href="/dashboard/membership"
          className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回套餐选择
        </Link>
        {children}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">加载中…</div>}>
      <PaymentContent />
    </Suspense>
  );
}
