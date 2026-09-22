"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Smartphone, CreditCard, QrCode, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notify } from '@/components/ui/feedback';
import { getPlan } from '@/lib/config/plans';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"alipay" | "wechat">("alipay");
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    // 从 URL 获取套餐信息
    const plan = searchParams?.get("plan") || "basic";
    const cycle = searchParams?.get("cycle") || "monthly";
    
    /*
     * 价格从 lib/config/plans.ts 取，收款页不再自己写一份。
     *
     * 此前这里写的是 基础 29 / 企业 599，而首页和代码里是 30 / 199——
     * 用户在首页看到企业版 199，点进来这一页要付 599。收款页是整条链路
     * 上最不能出错的一环，它必须和对外公示的价格来自同一处。
     */
    const config = getPlan(plan);
    setSelectedPlan({
      name: config.name,
      price: config.price,
      yearly: config.yearlyPrice,
      cycle,
      finalPrice: cycle === "yearly" ? config.yearlyPrice : config.price,
    });
  }, [searchParams]);

  const handlePayment = async () => {
    setLoading(true);
    setShowQR(true);

    // 模拟支付流程
    // 真实环境中，这里会调用支付接口
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const confirmPayment = () => {
    // 模拟支付成功
    notify("支付成功！会员已升级");
    router.push("/dashboard");
  };

  if (!selectedPlan) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-muted py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* 返回按钮 */}
        <Link
          href="/dashboard/membership"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回套餐选择
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 左侧：订单信息 */}
          <div className="bg-card rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">订单详情</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">套餐名称</span>
                <span className="font-semibold text-foreground">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">计费周期</span>
                <span className="font-semibold text-foreground">
                  {selectedPlan.cycle === "yearly" ? "年付" : "月付"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">原价</span>
                <span className="text-muted-foreground line-through">
                  ¥{selectedPlan.cycle === "yearly" ? selectedPlan.price * 12 : selectedPlan.price}
                </span>
              </div>
              {selectedPlan.cycle === "yearly" && (
                <div className="flex justify-between">
                  <span className="text-green-500">年付优惠</span>
                  <span className="text-green-500 font-semibold">
                    -¥{selectedPlan.price * 12 - selectedPlan.finalPrice}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">实付金额</span>
                <span className="text-3xl font-bold text-primary">
                  ¥{selectedPlan.finalPrice}
                </span>
              </div>
            </div>

            {/* 权益说明 */}
            <div className="bg-primary/10 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3">购买后您将获得：</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>
                    {selectedPlan.name === "基础会员" && "每月 50 次使用额度"}
                    {selectedPlan.name === "专业会员" && "每月 200 次使用额度"}
                    {selectedPlan.name === "企业版" && "无限次使用额度"}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>所有核心功能无限制使用</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>优先客服支持</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>7天无理由退款</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 右侧：支付方式 */}
          <div className="bg-card rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">选择支付方式</h2>

            {!showQR ? (
              <>
                {/* 支付方式选择 */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => setPaymentMethod("alipay")}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      paymentMethod === "alipay"
                        ? "border-primary/50 bg-primary/10"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-foreground">支付宝支付</div>
                      <div className="text-sm text-muted-foreground">推荐使用，安全快捷</div>
                    </div>
                    {paymentMethod === "alipay" && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setPaymentMethod("wechat")}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      paymentMethod === "wechat"
                        ? "border-green-500/50 bg-emerald-500/10"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-foreground">微信支付</div>
                      <div className="text-sm text-muted-foreground">使用微信扫码支付</div>
                    </div>
                    {paymentMethod === "wechat" && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:opacity-90 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "生成支付码..." : `立即支付 ¥${selectedPlan.finalPrice}`}
                </button>
              </>
            ) : (
              <>
                {/* 支付二维码 */}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-64 h-64 bg-muted rounded-lg mb-4">
                    <QrCode className="w-32 h-32 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-2">
                    请使用{paymentMethod === "alipay" ? "支付宝" : "微信"}扫码支付
                  </p>
                  <p className="text-3xl font-bold text-primary mb-4">
                    ¥{selectedPlan.finalPrice}
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    支付完成后，会员权益将自动生效
                  </p>

                  {/* 模拟支付按钮 */}
                  <div className="space-y-3">
                    <button
                      onClick={confirmPayment}
                      className="w-full bg-emerald-500 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      ✓ 我已完成支付
                    </button>
                    <button
                      onClick={() => setShowQR(false)}
                      className="w-full bg-muted text-foreground py-3 rounded-lg font-semibold hover:bg-muted transition-colors"
                    >
                      返回重新选择
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 安全提示 */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                🔒 支付由第三方平台处理，我们不会保存您的支付信息
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
