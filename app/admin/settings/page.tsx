"use client";

import { useState, useEffect } from "react";
import { Save, DollarSign, Settings as SettingsIcon, Shield, Zap, Loader2 } from "lucide-react";
import { notify } from '@/components/ui/feedback';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"pricing" | "features" | "system">("pricing");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // 会员价格配置
  const [pricing, setPricing] = useState({
    basic: { monthly: 30, yearly: 288 },
    pro: { monthly: 99, yearly: 950 },
    enterprise: { monthly: 199, yearly: 1910 },
  });

  // 功能配额配置
  const [quotas, setQuotas] = useState({
    free: 50,
    basic: 150,
    pro: 500,
    enterprise: -1,
  });

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
      
      if (response.ok && data.settings) {
        if (data.settings.pricing) {
          setPricing(data.settings.pricing);
        }
        if (data.settings.quotas) {
          setQuotas(data.settings.quotas);
        }
        if (data.settings.features) {
          setFeatures(data.settings.features);
        }
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
        body: JSON.stringify({
          settings: {
            pricing,
            quotas,
            features,
          },
        }),
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
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* 顶部导航 */}
      <div className="bg-white dark:bg-slate-800 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">系统设置</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                配置系统参数和功能选项
              </p>
            </div>
            <a
              href="/admin"
              className="text-sm text-blue-600 hover:text-blue-700"
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
            <div className="bg-white dark:bg-slate-800 rounded-lg border p-2 space-y-1">
              <button
                onClick={() => setActiveTab("pricing")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "pricing"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">价格配置</span>
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "features"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span className="font-medium">功能配置</span>
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === "system"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">系统配置</span>
              </button>
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg border p-6">
              {/* 价格配置 */}
              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold mb-4">会员价格配置</h2>

                  {/* 基础会员 */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">基础会员</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">月付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.basic.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              basic: { ...pricing.basic, monthly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">年付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.basic.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              basic: { ...pricing.basic, yearly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 专业会员 */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">专业会员</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">月付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.pro.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              pro: { ...pricing.pro, monthly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">年付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.pro.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              pro: { ...pricing.pro, yearly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 企业版 */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">企业版</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">月付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.enterprise.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              enterprise: { ...pricing.enterprise, monthly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">年付价格（¥）</label>
                        <input
                          type="number"
                          value={pricing.enterprise.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              enterprise: { ...pricing.enterprise, yearly: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 功能配置 */}
              {activeTab === "features" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold mb-4">功能额度配置</h2>

                  <div className="space-y-4">
                    {Object.entries(quotas).map(([plan, quota]) => (
                      <div key={plan} className="border rounded-lg p-4">
                        <label className="block font-semibold mb-2 capitalize">
                          {plan === 'free' ? '免费版' : plan === 'basic' ? '基础会员' : plan === 'pro' ? '专业会员' : '企业版'}
                        </label>
                        <input
                          type="number"
                          value={quota}
                          onChange={(e) =>
                            setQuotas({ ...quotas, [plan]: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder={quota === -1 ? "无限（输入-1）" : ""}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {quota === -1 ? '无限额度' : `每月 ${quota} 次`}
                        </p>
                      </div>
                    ))}
                  </div>

                  <h2 className="text-xl font-bold mb-4 mt-8">功能开关</h2>

                  <div className="space-y-3">
                    {Object.entries(features).map(([key, enabled]) => (
                      <label key={key} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
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
                    <p className="text-sm text-gray-500">
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
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
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