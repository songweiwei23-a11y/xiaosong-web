"use client";

import { useState, useEffect } from "react";
import { Save, DollarSign, Settings as SettingsIcon, Shield, Zap, Loader2, AlertTriangle } from "lucide-react";
import { SUBSCRIPTION_PLANS, quotaSummary } from "@/lib/config/plans";
import { notify } from '@/components/ui/feedback';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"pricing" | "features" | "system">("pricing");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /*
   * 价格与额度的 state 已删除。
   *
   * 它们原本是一组可编辑的输入框，存进 system_settings，而没有任何代码
   * 读它——真实值一直来自 lib/config/plans.ts。留着这两份 state 的话，
   * 页面会继续把过期的数字（basic 月付 30、free 配额 50）写回数据库，
   * 下次谁来接手一看有这份配置，很容易以为它是生效的。
   *
   * 现在两个 tab 都改成从 plans.ts 只读展示。
   */

  // 功能开关
  const [features, setFeatures] = useState({
    registration: true,
    payment: true,
    scriptGeneration: true,
    topicPlanning: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      
      // 只还原功能开关。pricing / quotas 即使库里有旧值也不再读——
      // 它们从来没生效过，读回来只会在页面上显示一组骗人的数字
      if (response.ok && data.settings?.features) {
        setFeatures(data.settings.features);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      notify('加载配置失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // 只存功能开关。价格和额度在 lib/config/plans.ts 里，
        // 往这里再存一份就又多了一个会分叉的来源
        body: JSON.stringify({ settings: { features } }),
      });

      const data = await response.json();

      if (response.ok) {
        notify(data.message || '设置已保存！', 'success');
      } else {
        notify(data.error || '保存失败', 'error');
      }
    } catch (error) {
      console.error('保存失败:', error);
      notify('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted dark:bg-muted">
      {/* 顶部导航 */}
      <div className="glass-panel border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-foreground">系统设置</h1>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                配置系统参数和功能选项
              </p>
            </div>
            <a
              href="/admin"
              className="text-sm text-primary hover:text-primary"
            >
              ← 返回后台首页
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* 左侧导航 */}
          <div className="w-64 flex-shrink-0">
            <div className="glass-panel rounded-lg border p-2 space-y-1">
              <button
                onClick={() => setActiveTab("pricing")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "pricing"
                    ? "bg-accent/10 text-accent dark:bg-purple-900/30"
                    : "hover:bg-foreground/[0.06] dark:hover:bg-muted"
                }`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">价格配置</span>
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "features"
                    ? "bg-accent/10 text-accent dark:bg-purple-900/30"
                    : "hover:bg-foreground/[0.06] dark:hover:bg-muted"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span className="font-medium">功能配置</span>
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "system"
                    ? "bg-accent/10 text-accent dark:bg-purple-900/30"
                    : "hover:bg-foreground/[0.06] dark:hover:bg-muted"
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">系统配置</span>
              </button>
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1">
            <div className="glass-panel rounded-lg border p-6">
              {/* 价格配置 */}
              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold mb-4">当前生效的价格</h2>

                  {/*
                    这里原本是一组可编辑的价格输入框，改完点保存会写进
                    system_settings——但没有任何代码读它。真实价格来自
                    lib/config/plans.ts，首页、会员页、收款页和服务端全从那里取。
                    管理员改了半天、看到「保存成功」，实际一分钱都没变。

                    没有把它接成「数据库里的价格」，是因为这个产品刚为
                    「说的是一套、跑的是另一套」付过代价：价格曾经在四个地方
                    各写一份，企业版首页写 199、收款页收 599。再开一个来源，
                    等于又给自己埋一颗同样的雷。
                  */}
                  <div className="space-y-3">
                    {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => {
                      const plan = SUBSCRIPTION_PLANS[id];
                      const save = plan.price * 12 - plan.yearlyPrice;
                      return (
                        <div key={id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border/60 p-4">
                          <span className="font-semibold text-foreground">{plan.name}</span>
                          {plan.price === 0 ? (
                            <span className="text-sm text-muted-foreground">免费</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              ¥{plan.price}/月 · ¥{plan.yearlyPrice}/年
                              <span className="ml-2 text-xs">（年付省 ¥{save}）</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">价格在代码里，不在这里改</p>
                      <p className="mt-1">
                        改 <code className="rounded bg-foreground/10 px-1">lib/config/plans.ts</code> 后重新部署，
                        首页、会员页、收款页会一起变。放在这个页面改会出现
                        「页面显示一套、实际收另一套」——这正是之前企业版
                        首页写 199 而收款页收 599 的原因。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 功能配置 */}
              {activeTab === "features" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold mb-4">当前生效的套餐与额度</h2>

                  {/*
                    这里原本是一组可编辑的数字输入框，改完点保存会写进
                    system_settings——但没有任何代码读它，真实额度一直来自
                    lib/config/plans.ts。也就是说管理员改了半天、看到「保存成功」，
                    实际什么都没变。

                    没有把它接成「数据库里的额度」，是因为这个产品刚为
                    「文案与执行不一致」付过代价：价格曾经在四个地方各写一份，
                    企业版首页 199、收款页 599。再加一个数据库来源，
                    等于又开一个会分叉的口子。

                    改成如实展示当前生效的配置，并说清改哪里。
                  */}
                  <div className="space-y-3">
                    {(Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[]).map((id) => {
                      const plan = SUBSCRIPTION_PLANS[id];
                      return (
                        <div key={id} className="rounded-xl border border-border/60 p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-semibold text-foreground">{plan.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {plan.price === 0
                                ? "免费"
                                : `¥${plan.price}/月 · ¥${plan.yearlyPrice}/年`}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-0.5">
                            {quotaSummary(id).map((line) => (
                              <li key={line} className="text-xs text-muted-foreground">
                                · {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">这些数字改不了</p>
                      <p className="mt-1">
                        价格和额度由代码里的 <code className="rounded bg-foreground/10 px-1">lib/config/plans.ts</code> 决定，
                        首页、会员页、收款页和服务端的额度校验都从那一处取值。
                        要调整请改那个文件并重新部署——放在这里改会出现
                        「页面显示一套、实际执行另一套」，这个产品在价格上已经吃过一次亏。
                      </p>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold mb-4 mt-8">功能开关</h2>

                  <div className="space-y-3">
                    {Object.entries(features).map(([key, enabled]) => (
                      <label key={key} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-foreground/[0.06]">
                        <span className="font-medium capitalize">
                          {key === 'registration' ? '用户注册' : 
                           key === 'payment' ? '支付功能' :
                           key === 'scriptGeneration' ? '脚本生成' :
                           key === 'topicPlanning' ? '选题策划' : key}
                        </span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            setFeatures({ ...features, [key]: e.target.checked })
                          }
                          className="w-5 h-5"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 系统配置 */}
              {activeTab === "system" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold mb-4">系统信息</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">站点名称</label>
                      <input
                        type="text"
                        defaultValue="小宋编导工作台"
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">版本号</label>
                      <input
                        type="text"
                        defaultValue="v2.0.0"
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      更多系统配置功能开发中...
                    </p>
                  </div>
                </div>
              )}

              {/* 保存按钮 */}
              <div className="mt-6 pt-6 border-t flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存设置
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}