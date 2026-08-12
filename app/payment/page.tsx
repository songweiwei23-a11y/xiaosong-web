"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Smartphone, CreditCard, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { notify } from '@/components/ui/feedback';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';

interface PaymentConfig {
  payment_wechat_qrcode: { url: string | null; enabled: boolean };
  payment_alipay_qrcode: { url: string | null; enabled: boolean };
  payment_config: { enabled: boolean; manual_confirm: boolean };
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"alipay" | "wechat">("alipay");
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    loadPaymentConfig();
  }, []);

  useEffect(() => {
    // 从 URL 获取套餐信息
    const plan = searchParams?.get("plan") || "basic";
    const cycle = searchParams?.get("cycle") || "monthly";
    
    const plans: any = {
      basic: { name: "基础会员", price: 29, yearly: 278 },
      pro: { name: "专业会员", price: 99, yearly: 950 },
      enterprise: { name: "企业版", price: 599, yearly: 5750 },
    };

    setSelectedPlan({
      ...plans[plan],
      cycle: cycle,
      finalPrice: cycle === "yearly" ? plans[plan].yearly : plans[plan].price,
    });
  }, [searchParams]);

  const loadPaymentConfig = async () => {
    try {
      const { data, error } = await supabase.rpc('get_payment_config');
      if (error) throw error;
      setPaymentConfig(data as any);
    } catch (error: any) {
      console.error('加载支付配置失败:', error);
      notify('加载支付配置失败');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handlePayment = async () => {
    // 检查是否有对应的收款码
    const qrUrl = paymentMethod === 'alipay' 
      ? paymentConfig?.payment_alipay_qrcode?.url
      : paymentConfig?.payment_wechat_qrcode?.url;

    if (!qrUrl) {
      notify(`暂未配置${paymentMethod === 'alipay' ? '支付宝' : '微信'}收款码，请联系客服`);
      return;
    }

    setLoading(true);
    setShowQR(true);
    setLoading(false);
  };

  const confirmPayment = () => {
    notify("支付凭证已提交，等待管理员审核");
    router.push("/dashboard/membership");
  };

  if (!selectedPlan || loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentQRUrl = paymentMethod === 'alipay' 
    ? paymentConfig?.payment_alipay_qrcode?.url
    : paymentConfig?.payment_wechat_qrcode?.url;

  return (
    <div className="min-h-screen bg-muted py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* 返回按钮 */}
        <Link
          href="/dashboard/membership"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-6"
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
                  <span className="text-green-600">年付优惠</span>
                  <span className="text-green-600 font-semibold">
                    -¥{selectedPlan.price * 12 - selectedPlan.finalPrice}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">实付金额</span>
                <span className="text-3xl font-bold text-blue-600">
                  ¥{selectedPlan.finalPrice}
                </span>
              </div>
            </div>

            {/* 权益说明 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3">购买后您将获得：</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>
                    {selectedPlan.name === "基础会员" && "每月 150 次使用额度"}
                    {selectedPlan.name === "专业会员" && "每月 500 次使用额度"}
                    {selectedPlan.name === "企业版" && "无限次使用额度"}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>全部高级功能解锁</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>优先客服支持</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>历史记录保存</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 右侧：支付方式 */}
          <div className="bg-card rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">支付方式</h2>

            {!showQR ? (
              <>
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => setPaymentMethod("alipay")}
                    disabled={!paymentConfig?.payment_alipay_qrcode?.url}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      paymentMethod === "alipay"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-border hover:border-blue-300"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-foreground">支付宝支付</div>
                      <div className="text-sm text-muted-foreground">
                        {paymentConfig?.payment_alipay_qrcode?.url ? '推荐使用，安全快捷' : '暂未开通'}
                      </div>
                    </div>
                    {paymentMethod === "alipay" && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setPaymentMethod("wechat")}
                    disabled={!paymentConfig?.payment_wechat_qrcode?.url}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      paymentMethod === "wechat"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-border hover:border-green-300"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-foreground">微信支付</div>
                      <div className="text-sm text-muted-foreground">
                        {paymentConfig?.payment_wechat_qrcode?.url ? '使用微信扫码支付' : '暂未开通'}
                      </div>
                    </div>
                    {paymentMethod === "wechat" && (
                      <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={loading || !currentQRUrl}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "生成支付码..." : `立即支付 ¥${selectedPlan.finalPrice}`}
                </button>
              </>
            ) : (
              <>
                {/* 支付二维码 */}
                <div className="text-center">
                  {currentQRUrl ? (
                    <div className="relative w-64 h-64 mx-auto mb-4 bg-white rounded-lg p-4 border-2 border-border">
                      <Image 
                        src={currentQRUrl} 
                        alt={`${paymentMethod === 'alipay' ? '支付宝' : '微信'}收款码`}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-muted-foreground">暂无收款码</p>
                    </div>
                  )}
                  
                  <p className="text-lg font-semibold text-foreground mb-2">
                    请使用{paymentMethod === "alipay" ? "支付宝" : "微信"}扫码支付
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mb-4">
                    ¥{selectedPlan.finalPrice}
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    支付完成后，请点击下方按钮，管理员审核后会员权益将自动生效
                  </p>

                  {/* 支付确认按钮 */}
                  <div className="space-y-3">
                    <button
                      onClick={confirmPayment}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                    >
                      ✓ 我已完成支付
                    </button>
                    <button
                      onClick={() => setShowQR(false)}
                      className="w-full bg-muted text-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition-colors"
                    >
                      返回重新选择
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 安全提示 */}
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                💡 提示：支付完成后请等待管理员审核，通常在24小时内完成
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}