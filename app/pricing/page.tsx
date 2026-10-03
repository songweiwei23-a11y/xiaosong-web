"use client";

import Link from "next/link";
import { Check, X, Crown, Zap, Rocket } from "lucide-react";
import {
  SUBSCRIPTION_PLANS, quotaSummary, planSellingPoints,
  COUNTED_FEATURES, PAID_PERIOD_NOTE, WEB_SEARCH_LIMITS,
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
          <h1 className="text-3xl sm:text-5xl font-extrabold brand-gradient bg-clip-text text-transparent mb-4">
            选择适合你的套餐
          </h1>
          <p className="text-xl text-muted-foreground">
            从免费版开始，按创作需求升级更多额度
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
                    推荐方案
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
                  {/* 年付撤了：2026-09-27 起所有会员一律按月收费 */}
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.price > 0 ? "按月付费" : "一次性体验"}
                  </p>
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
                    href={`/payment?plan=${plan.id}`}
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
        <div className="bg-card rounded-2xl shadow-xl p-4 sm:p-8 border border-border">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">功能详细对比</h2>
          
          {/* 手机上表格保持自然宽度、在框里横滑，功能名一列钉在左边；原来被挤成一个字一行 */}
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[34rem] whitespace-nowrap text-sm sm:text-base">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card text-left py-3 px-4 font-semibold sm:py-4">功能模块</th>
                  <th className="text-center py-3 px-3 font-semibold sm:py-4 sm:px-4">免费版</th>
                  <th className="text-center py-3 px-3 font-semibold sm:py-4 sm:px-4">基础会员</th>
                  <th className="text-center py-3 px-3 font-semibold sm:py-4 sm:px-4">专业会员</th>
                  <th className="text-center py-3 px-3 font-semibold sm:py-4 sm:px-4">高频会员</th>
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
                    <td className="sticky left-0 z-10 bg-card py-3 px-4 sm:py-4">{feat.name}</td>
                    {(['free', 'basic', 'pro', 'enterprise'] as const).map((planId) => {
                      const n = SUBSCRIPTION_PLANS[planId].quotas[feat.key] as number;
                      return (
                        <td key={planId} className="text-center py-3 px-3 sm:py-4 sm:px-4">
                          {n === -1 ? (
                            '无限'
                          ) : n === 0 ? (
                            <X className="w-5 h-5 text-destructive mx-auto" />
                          ) : planId === 'free' ? (
                            // 免费版是一次性体验额度，不按月重置，写「次/月」就是说错
                            `${n} 次`
                          ) : (
                            `${n} 次/月`
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="sticky left-0 z-10 bg-card py-3 px-4 sm:py-4">联网搜索</td>
                  {(['free', 'basic', 'pro', 'enterprise'] as const).map((id) => (
                    <td key={id} className="text-center py-3 px-3 sm:py-4 sm:px-4">{WEB_SEARCH_LIMITS[id]} 次{id === 'free' ? '（一次性）' : '/月'}</td>
                  ))}
                </tr>
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
              <p className="text-sm text-muted-foreground">{PAID_PERIOD_NOTE}。每期开始时额度回满；提前续费同档套餐不立即重置当期额度。会员到期未续费，剩余次数清零。免费版为一次性体验额度</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">可以随时升级吗？</h3>
              <p className="text-sm text-muted-foreground">可以，管理员核对并开通后生效，未使用的天数不退款</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">支持退款吗？</h3>
              <p className="text-sm text-muted-foreground">虚拟商品开通后不支持无理由退款。购买前有疑问请先联系我们</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              {/* 原答案是「提供API接口、批量处理、数据导出、定制化模板等」，四样都没有做 */}
              <h3 className="font-bold mb-2">高频会员和专业会员差在哪？</h3>
              <p className="text-sm text-muted-foreground">高频会员每类创作额度各 {SUBSCRIPTION_PLANS.enterprise.quotas.script} 次/月、知识库查询 {SUBSCRIPTION_PLANS.enterprise.quotas.knowledge} 次/月、联网搜索 {WEB_SEARCH_LIMITS.enterprise} 次/月；专业会员分别为 {SUBSCRIPTION_PLANS.pro.quotas.script} 次、{SUBSCRIPTION_PLANS.pro.quotas.knowledge} 次、{WEB_SEARCH_LIMITS.pro} 次。四个定位板块共享定位额度，脚本、起号、开篇共享脚本额度。两档都支持全部创作功能。</p>
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
