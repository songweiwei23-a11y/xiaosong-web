"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, Shield, Star } from "lucide-react";
import { SUBSCRIPTION_PLANS, quotaSummary, unsupportedFeatures, planSellingPoints } from "@/lib/config/plans";

/*
 * 价格和额度一律从 lib/config/plans.ts 取，页面只负责好看。
 *
 * 此前这里自己写了一份：企业版 599（首页和代码是 199，用户在首页看到
 * 199 点进来要付 599）、基础版 29（代码是 30）、额度写「基础 50 次、
 * 专业 200 次」（代码是 150 / 500）。四个地方各写各的，改一处漏三处。
 */

const membershipPlans = [
  {
    id: "free",
    name: SUBSCRIPTION_PLANS.free.name,
    price: SUBSCRIPTION_PLANS.free.price,
    yearlyPrice: SUBSCRIPTION_PLANS.free.yearlyPrice,
    period: "永久",
    icon: Shield,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    // 「社区功能」没有做，撤了。权益一律从 planSellingPoints 取，不在页面上手写
    features: [...quotaSummary("free"), ...planSellingPoints("free")],
    limits: unsupportedFeatures("free"),
  },
  {
    id: "basic",
    name: SUBSCRIPTION_PLANS.basic.name,
    price: SUBSCRIPTION_PLANS.basic.price,
    yearlyPrice: SUBSCRIPTION_PLANS.basic.yearlyPrice,
    period: "月",
    icon: Star,
    color: "text-primary",
    bgColor: "bg-primary/15",
    popular: false,
    features: [...quotaSummary("basic"), ...planSellingPoints("basic")],
    limits: [],
  },
  {
    id: "pro",
    name: SUBSCRIPTION_PLANS.pro.name,
    price: SUBSCRIPTION_PLANS.pro.price,
    yearlyPrice: SUBSCRIPTION_PLANS.pro.yearlyPrice,
    period: "月",
    icon: Crown,
    color: "text-accent",
    bgColor: "bg-accent/15",
    popular: true,
    features: [...quotaSummary("pro"), ...planSellingPoints("pro")],
    limits: [],
  },
  {
    id: "enterprise",
    name: SUBSCRIPTION_PLANS.enterprise.name,
    price: SUBSCRIPTION_PLANS.enterprise.price,
    yearlyPrice: SUBSCRIPTION_PLANS.enterprise.yearlyPrice,
    period: "月",
    icon: Zap,
    color: "text-orange-500",
    bgColor: "bg-amber-500/15",
    popular: false,
    features: [...quotaSummary("enterprise"), ...planSellingPoints("enterprise")],
    limits: [],
  },
];

interface Status {
  planId: string;
  planName: string;
  endDate: string | null;
  permanent: boolean;
  daysLeft: number | null;
  expired: { planName: string; endDate: string } | null;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

export default function MembershipPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  /*
   * 当前套餐原来是写死的：`const currentPlan = "free"; // 从用户数据获取`。
   * 付费会员打开这一页看到的也是"当前套餐：免费版"，而且还能再点一次
   * 自己正在用的那档去付款。现在从 /api/account 取真实状态。
   *
   * 取到之前是 null——这段时间不标任何"当前套餐"，免得先闪一下"免费版"。
   */
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);
  const currentPlan = status?.planId ?? null;

  const handleUpgrade = (planId: string) => {
    // 免费版不用买；当前的付费套餐可以点——那是续费。
    // 续费从原到期日往后顺延，不会吞掉剩余天数（见 activationPlan）
    if (planId === "free") return;
    router.push(`/payment?plan=${planId}&cycle=${billingCycle}`);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 页头 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          升级会员，解锁全部功能
        </h1>
        <p className="text-lg text-muted-foreground">
          选择适合你的套餐，开启高效创作之旅
        </p>

        {/* 当前状态。到期时间在这之前全站没有任何地方显示 */}
        {status && (
          <div className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/40 px-5 py-3 text-sm">
            <span className="text-muted-foreground">当前：</span>
            <span className="font-semibold text-foreground">{status.planName}</span>
            {status.permanent && <span className="text-muted-foreground">长期有效</span>}
            {status.endDate && (
              <span className="text-muted-foreground">
                {fmtDate(status.endDate)} 到期
                {status.daysLeft !== null && (
                  <span className={status.daysLeft <= 7 ? "ml-1 font-medium text-amber-500" : "ml-1"}>
                    （还剩 {status.daysLeft} 天）
                  </span>
                )}
              </span>
            )}
            {status.expired && (
              <span className="text-amber-500">
                {status.expired.planName}已于 {fmtDate(status.expired.endDate)} 到期
              </span>
            )}
            <Link href="/dashboard/account" className="text-primary hover:underline">
              订单与账户 →
            </Link>
          </div>
        )}

        {/* 计费周期切换 */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            月付
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === "yearly"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            年付
            <span className="ml-2 text-xs bg-emerald-500 text-white px-2 py-1 rounded">
              省 20%
            </span>
          </button>
        </div>
      </div>

      {/* 会员套餐卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {membershipPlans.map((plan) => {
          const Icon = plan.icon;
          // 年付价直接取配置里的 yearlyPrice，不再当场按 12×0.8 算。
          // 当场算出来的数和 plans.ts 里写的对不上时（比如 49×12×0.8=470.4），
          // 页面显示一个价、收款按另一个价，用户会以为被多收了。
          const finalPrice = billingCycle === "yearly" ? plan.yearlyPrice : plan.price;
          const listPrice = plan.price * 12;
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${
                plan.popular
                  ? "border-accent/50 shadow-lg scale-105"
                  : "border-border hover:border-primary/30"
              } ${currentPlan === plan.id ? "ring-4 ring-primary" : ""}`}
            >
              {/* 推荐标签 */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="brand-gradient text-white px-4 py-1 rounded-full text-sm font-medium">
                    🔥 最受欢迎
                  </span>
                </div>
              )}

              {/* 当前套餐标签 */}
              {currentPlan === plan.id && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    当前套餐
                  </span>
                </div>
              )}

              {/* 图标 */}
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${plan.bgColor} mb-4`}>
                <Icon className={`w-6 h-6 ${plan.color}`} />
              </div>

              {/* 套餐名称 */}
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>

              {/* 价格 */}
              <div className="mb-6">
                {plan.price === 0 ? (
                  <div className="text-3xl font-bold text-foreground">免费</div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">¥{finalPrice}</span>
                      <span className="text-muted-foreground">/{billingCycle === "yearly" ? "年" : plan.period}</span>
                    </div>
                    {billingCycle === "yearly" && plan.price > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        原价 ¥{listPrice}，省 ¥{listPrice - plan.yearlyPrice}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 功能列表 */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* 限制列表 */}
              {plan.limits.length > 0 && (
                <ul className="space-y-2 mb-6 pt-4 border-t">
                  {plan.limits.map((limit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-400">✕</span>
                      <span className="text-sm text-muted-foreground">{limit}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/*
                按钮。只有"正在用免费版"时免费版那张卡不可点；
                付费套餐是当前套餐时要能点——那是续费。
                原来一律"当前套餐就禁用"，一旦把当前套餐改成真实值，
                付费会员自己那张卡就变灰，想续费都点不了。
              */}
              {(() => {
                const isCurrent = currentPlan === plan.id;
                const isFree = plan.price === 0;
                const disabled = isFree;
                const label = isFree
                  ? isCurrent ? "当前套餐" : "免费使用"
                  : isCurrent ? "续费" : "立即升级";
                return (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={disabled}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      disabled
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : plan.popular
                        ? "brand-gradient text-white hover:from-purple-700 hover:to-pink-700"
                        : "bg-primary text-white hover:opacity-90"
                    }`}
                  >
                    {label}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* 常见问题 */}
      <div className="mt-16 bg-muted rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">常见问题</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-foreground mb-2">如何支付？</h3>
            <p className="text-muted-foreground text-sm">
              支持支付宝、微信支付、银行卡等多种支付方式，安全便捷。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">可以退款吗？</h3>
            <p className="text-muted-foreground text-sm">
              虚拟商品开通后不支持无理由退款。购买前有疑问可以先问清楚再买。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">额度什么时候重置？</h3>
            <p className="text-muted-foreground text-sm">
              按订阅周期每 30 天重置一次，重置后额度回到满额。
              未用完的次数不会累积到下个周期。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">企业版如何联系？</h3>
            <p className="text-muted-foreground text-sm">
              请添加微信：13240286600（手机同号）
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
