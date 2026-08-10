"use client";

import Link from "next/link";
import { Check, X, Crown, Zap, Rocket } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/config/plans";

export default function PricingPage() {
  const plans = [
    { ...SUBSCRIPTION_PLANS.free, icon: Zap, color: "gray" },
    { ...SUBSCRIPTION_PLANS.basic, icon: Check, color: "blue" },
    { ...SUBSCRIPTION_PLANS.pro, icon: Crown, color: "purple" },
    { ...SUBSCRIPTION_PLANS.enterprise, icon: Rocket, color: "orange" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
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
                  isPopular ? "border-purple-500 scale-105" : "border-border"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    最受欢迎
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 rounded-full mb-4 bg-${plan.color}-100`}>
                    <Icon className={`w-8 h-8 text-${plan.color}-600`} />
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
                        ? "bg-purple-600 text-white hover:bg-purple-700"
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
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">知识库</td>
                  <td className="text-center py-4 px-4">无限</td>
                  <td className="text-center py-4 px-4">无限</td>
                  <td className="text-center py-4 px-4">无限</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">账号定位</td>
                  <td className="text-center py-4 px-4">1次</td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">选题策划</td>
                  <td className="text-center py-4 px-4">3次/月</td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">脚本生成</td>
                  <td className="text-center py-4 px-4">20次/月</td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">自由对话</td>
                  <td className="text-center py-4 px-4">20次/月</td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">分镜脚本</td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">审稿优化</td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">标题封面</td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">成交理由</td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4">150次/月</td>
                  <td className="text-center py-4 px-4">500次/月</td>
                  <td className="text-center py-4 px-4">无限</td>
                </tr>
                <tr className="border-b border-border hover:bg-muted/50">
                  <td className="py-4 px-4">客服支持</td>
                  <td className="text-center py-4 px-4">社区</td>
                  <td className="text-center py-4 px-4">标准</td>
                  <td className="text-center py-4 px-4">优先</td>
                  <td className="text-center py-4 px-4">专属</td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="py-4 px-4">API接口</td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
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
              <p className="text-sm text-muted-foreground">每月自动重置，从开通日期起算30天为一个周期</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">可以随时升级吗？</h3>
              <p className="text-sm text-muted-foreground">可以，升级后立即生效，未使用的天数不退款</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">支持退款吗？</h3>
              <p className="text-sm text-muted-foreground">开通后7天内如未使用可申请退款</p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="font-bold mb-2">企业版有什么特殊服务？</h3>
              <p className="text-sm text-muted-foreground">提供API接口、批量处理、数据导出、定制化模板等</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition-all"
          >
            立即免费开始
          </Link>
        </div>
      </div>
    </div>
  );
}