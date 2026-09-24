"use client";

import Link from "next/link";
import { Check, X, Crown, Zap, Rocket } from "lucide-react";
import {
  SUBSCRIPTION_PLANS, quotaSummary, planSellingPoints,
  COUNTED_FEATURES, FREE_ONE_TIME_FEATURES,
} from "@/lib/config/plans";
import { toneSoft } from "@/lib/ui-tokens";

export default function PricingPage() {
  /*
   * 额度文案必须现算。
   *
   * 这一页原来是 `...SUBSCRIPTION_PLANS.free` 整个摊开，于是 features 用的是
   * 配置里手写的那份文案，和 quotas 是两个来源。会员页和首页早就改成
   * quotaSummary() 现算了，只有这一页还读手写的——改额度时这里会悄悄留在旧数字上，
   * 又变成「说的是一套、跑的是另一套」。
   */
  const plans = [
    { ...SUBSCRIPTION_PLANS.free, icon: Zap, color: "gray" },
    { ...SUBSCRIPTION_PLANS.basic, icon: Check, color: "blue" },
    { ...SUBSCRIPTION_PLANS.pro, icon: Crown, color: "purple" },
    { ...SUBSCRIPTION_PLANS.enterprise, icon: Rocket, color: "orange" }
  ].map((p) => ({ ...p, features: [...quotaSummary(p.id), ...planSellingPoints(p.id)] }));

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold brand-gradient bg-clip-text text-transparent mb-4">
            选择适合你的套餐
          </h1>
          <p className="text-xl text-muted-foreground">
            从免费版开始，随时升级到更强大的功能
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isPopular = plan.id === "pro";
            
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-8 bg-card shadow-lg transition-all hover:shadow-2xl hover:-translate-y-2 ${
                  isPopular ? "border-accent/50 scale-105" : "border-border"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent/100 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    最受欢迎
                  </div>
                )}

                <div className="text-center mb-6">
                  {/* 类名必须是完整字面量。`bg-${plan.color}-100` 是运行时拼出来的，
                      Tailwind 构建时扫不到，这些图标底色从上线起就没生效过 */}
                  <div className={`inline-flex p-3 rounded-full mb-4 ${toneSoft(plan.color)}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold">¥{plan.price}</span>
                    {plan.price > 0 && <span className="text-muted-foreground">/月</span>}
                  </div>
                  {plan.yearlyPrice > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      年付 ¥{plan.yearlyPrice} (省 ¥{plan.price * 12 - plan.yearlyPrice})
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <Link
                    href="/dashboard"
                    className="block w-full text-center py-3 rounded-lg border-2 border-border hover:bg-muted transition-colors font-semibold"
                  >
                    免费使用
                  </Link>
                ) : (
                  <Link
                    href={`/payment?plan=${plan.id}&cycle=monthly`}
                    className={`block w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                      isPopular
                        ? "bg-accent text-white hover:bg-accent"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    立即开通
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          <h2 className="text-3xl font-bold text-center mb-8">功能详细对比</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-semibold">功能模块</th>
                  <th className="text-center py-4 px-4 font-semibold">免费版</th>
                  <th className="text-center py-4 px-4 font-semibold">基础会员</th>
                  <th className="text-center py-4 px-4 font-semibold">专业会员</th>
                  <th className="text-center py-4 px-4 font-semibold">企业版</th>
                </tr>
              </thead>
              <tbody>
                {/*
                  这张表原来是手写的，而且数字全是旧的：基础会员写 150次/月、
                  专业写 500次/月，实际是 50 和 120——对外宣传比实际多 3 倍。
                  账号定位免费版写 1 次（实际 3）、脚本生成写 20 次（实际 8）。
                  这是一张**公示价格的对比表**，写错等于虚假宣传，
                  而我们刚刚才在同一页写上"不支持无理由退款"。

                  改成从 lib/config/plans.ts 现算。配置改了这里自动跟，
                  不会再有第二份说法。
                */}
                {COUNTED_FEATURES.map((feat) => (
                  <tr key={feat.key} className="border-b border-border hover:bg-muted/50">
                    <td className="py-4 px-4">{feat.name}</td>
                    {(['free', 'basic', 'pro', 'enterprise'] as const).map((planId) => {
                      const n = SUBSCRIPTION_PLANS[planId].quotas[feat.key] as number;
                      return (
                        <td key={planId} className="text-center py-4 px-4">
                          {n === -1 ? (
                            '无限'
                          ) : n === 0 ? (
                            <X className="w-5 h-5 text-destructive mx-auto" />
                          ) : planId === 'free' && FREE_ONE_TIME_FEATURES.includes(feat.key) ? (
                            `${n} 次`
                          ) : (
                            `${n} 次/月`
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/*
                  知识库原来是手写的一行「无限 / 无限 / 无限 / 无限」。
                  现在只有企业版还是无限，其余三档都有次数——这一行已经
                  进了 COUNTED_FEATURES，由上面的循环渲染，删掉手写的这份，
                  免得又变成"公示的和实际执行的对不上"。
                */}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold mb-8">常见问题</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">额度什么时候重置？</h3>
              <p className="text-sm text-muted-foreground">每月自动重置，从开通日期起算30天为一个周期</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">可以随时升级吗？</h3>
              <p className="text-sm text-muted-foreground">可以，升级后立即生效，未使用的天数不退款</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">支持退款吗？</h3>
              <p className="text-sm text-muted-foreground">虚拟商品开通后不支持无理由退款。购买前有疑问请先联系我们</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              {/* 原答案是「提供API接口、批量处理、数据导出、定制化模板等」，四样都没有做 */}
              <h3 className="font-bold mb-2">企业版和专业版差在哪？</h3>
              <p className="text-sm text-muted-foreground">企业版所有功能不限次数；专业版每个创作功能每月有固定额度。功能本身两档完全一样</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 brand-gradient text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition-all"
          >
            立即免费开始
          </Link>
        </div>
      </div>
    </div>
  );
}