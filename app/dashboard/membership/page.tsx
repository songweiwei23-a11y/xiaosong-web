"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, Shield, Star } from "lucide-react";

const membershipPlans = [
  {
    id: "free",
    name: "免费版",
    price: 0,
    period: "永久",
    icon: Shield,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    features: [
      "每月 5 次使用额度",
      "脚本生成基础功能",
      "选题策划 3 个方案",
      "知识库基础搜索",
      "社区功能",
    ],
    limits: [
      "不支持分镜脚本",
      "不支持审稿优化",
      "不支持账号定位",
    ],
  },
  {
    id: "basic",
    name: "基础会员",
    price: 29,
    period: "月",
    icon: Star,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    popular: false,
    features: [
      "每月 50 次使用额度",
      "所有脚本生成功能",
      "选题策划 12 个方案",
      "分镜脚本生成",
      "知识库高级搜索",
      "标题封面生成",
      "优先客服支持",
    ],
    limits: [],
  },
  {
    id: "pro",
    name: "专业会员",
    price: 99,
    period: "月",
    icon: Crown,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    popular: true,
    features: [
      "每月 200 次使用额度",
      "所有功能无限制使用",
      "审稿优化功能",
      "账号定位 7 天计划",
      "AI 智能分析",
      "数据导出功能",
      "专属客服 1v1",
      "定制化模板",
    ],
    limits: [],
  },
  {
    id: "enterprise",
    name: "企业版",
    price: 599,
    period: "月",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    popular: false,
    features: [
      "无限次使用额度",
      "多账号协作（5人）",
      "企业级数据安全",
      "API 接口调用",
      "私有化部署支持",
      "定制化开发",
      "专属客户经理",
      "培训与技术支持",
    ],
    limits: [],
  },
];

export default function MembershipPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const currentPlan = "free"; // 从用户数据获取

  const handleUpgrade = (planId: string) => {
    if (planId === "free" || planId === currentPlan) return;
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

        {/* 计费周期切换 */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            月付
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === "yearly"
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            年付
            <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
              省 20%
            </span>
          </button>
        </div>
      </div>

      {/* 会员套餐卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {membershipPlans.map((plan) => {
          const Icon = plan.icon;
          const finalPrice = billingCycle === "yearly" ? Math.floor(plan.price * 12 * 0.8) : plan.price;
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${
                plan.popular
                  ? "border-purple-500 shadow-lg scale-105"
                  : "border-border hover:border-blue-300"
              } ${currentPlan === plan.id ? "ring-4 ring-green-400" : ""}`}
            >
              {/* 推荐标签 */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    🔥 最受欢迎
                  </span>
                </div>
              )}

              {/* 当前套餐标签 */}
              {currentPlan === plan.id && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
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
                        原价 ¥{plan.price * 12}，省 ¥{plan.price * 12 * 0.2}
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

              {/* 按钮 */}
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={currentPlan === plan.id}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  currentPlan === plan.id
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : plan.popular
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {currentPlan === plan.id ? "当前套餐" : plan.price === 0 ? "免费使用" : "立即升级"}
              </button>
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
              购买后 7 天内，如不满意可申请全额退款，无需理由。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">额度用不完怎么办？</h3>
            <p className="text-muted-foreground text-sm">
              每月额度不会清零，可累积到下个月使用，最多累积 3 个月。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">企业版如何联系？</h3>
            <p className="text-muted-foreground text-sm">
              请添加客服微信：xiaosong-service，或发送邮件至 enterprise@xiaosong.ai
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
