"use client";

import { useState } from "react";
import { Save, DollarSign, Settings as SettingsIcon, Shield, Zap } from "lucide-react";
import { notify } from '@/components/ui/feedback';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"pricing" | "features" | "system">("pricing");
  const [saved, setSaved] = useState(false);

  // 会员价格配置
  const [pricing, setPricing] = useState({
    basic: { monthly: 29, yearly: 278 },
    pro: { monthly: 99, yearly: 950 },
    enterprise: { monthly: 599, yearly: 5750 },
  });

  // 功能配额配置
  const [quotas, setQuotas] = useState({
    free: 5,
    basic: 50,
    pro: 200,
    enterprise: 999,
  });

  // 功能开关
  const [features, setFeatures] = useState({
    registration: true,
    payment: true,
    scriptGeneration: true,
    topicPlanning: true,
    storyboard: true,
    review: true,
    titleCover: true,
    positioning: true,
    knowledge: true,
  });

  // 系统参数
  const [systemParams, setSystemParams] = useState({
    siteName: "小宋编导工作台",
    siteUrl: "http://localhost:3000",
    adminEmail: "admin@xiaosong.ai",
    maxUploadSize: 10,
    sessionTimeout: 24,
  });

  const handleSave = () => {
    // 这里后续会连接真实API保存到数据库
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    notify("设置已保存！");
  };

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
            <div className="bg-white dark:bg-slate-800 rounded-xl border p-2 space-y-1">
              <button
                onClick={() => setActiveTab("pricing")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "pricing"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">价格配置</span>
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "features"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span className="font-medium">功能开关</span>
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "system"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
                <span className="font-medium">系统参数</span>
              </button>
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border p-6">
            {/* 价格配置 */}
            {activeTab === "pricing" && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                  会员价格配置
                </h2>

                <div className="space-y-6">
                  {/* 基础会员 */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">基础会员</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          月付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.basic.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              basic: { ...pricing.basic, monthly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          年付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.basic.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              basic: { ...pricing.basic, yearly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                      年付节省：¥{pricing.basic.monthly * 12 - pricing.basic.yearly}
                    </div>
                  </div>

                  {/* 专业会员 */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">专业会员</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          月付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.pro.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              pro: { ...pricing.pro, monthly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          年付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.pro.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              pro: { ...pricing.pro, yearly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                      年付节省：¥{pricing.pro.monthly * 12 - pricing.pro.yearly}
                    </div>
                  </div>

                  {/* 企业版 */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">企业版</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          月付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.enterprise.monthly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              enterprise: { ...pricing.enterprise, monthly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          年付价格（元）
                        </label>
                        <input
                          type="number"
                          value={pricing.enterprise.yearly}
                          onChange={(e) =>
                            setPricing({
                              ...pricing,
                              enterprise: { ...pricing.enterprise, yearly: parseInt(e.target.value) },
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                      年付节省：¥{pricing.enterprise.monthly * 12 - pricing.enterprise.yearly}
                    </div>
                  </div>

                  {/* 使用额度配置 */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">月度使用额度</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          免费版
                        </label>
                        <input
                          type="number"
                          value={quotas.free}
                          onChange={(e) =>
                            setQuotas({ ...quotas, free: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          基础会员
                        </label>
                        <input
                          type="number"
                          value={quotas.basic}
                          onChange={(e) =>
                            setQuotas({ ...quotas, basic: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          专业会员
                        </label>
                        <input
                          type="number"
                          value={quotas.pro}
                          onChange={(e) =>
                            setQuotas({ ...quotas, pro: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          企业版
                        </label>
                        <input
                          type="number"
                          value={quotas.enterprise}
                          onChange={(e) =>
                            setQuotas({ ...quotas, enterprise: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 功能开关 */}
            {activeTab === "features" && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                  功能开关管理
                </h2>

                <div className="space-y-4">
                  {Object.entries(features).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-slate-100">
                          {key === "registration" && "用户注册"}
                          {key === "payment" && "在线支付"}
                          {key === "scriptGeneration" && "脚本生成"}
                          {key === "topicPlanning" && "选题策划"}
                          {key === "storyboard" && "分镜脚本"}
                          {key === "review" && "审稿优化"}
                          {key === "titleCover" && "标题封面"}
                          {key === "positioning" && "账号定位"}
                          {key === "knowledge" && "知识库"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">
                          {value ? "已启用" : "已禁用"}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setFeatures({ ...features, [key]: !value })
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          value ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-800 transition-transform ${
                            value ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 系统参数 */}
            {activeTab === "system" && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                  系统参数配置
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      网站名称
                    </label>
                    <input
                      type="text"
                      value={systemParams.siteName}
                      onChange={(e) =>
                        setSystemParams({ ...systemParams, siteName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      网站域名
                    </label>
                    <input
                      type="url"
                      value={systemParams.siteUrl}
                      onChange={(e) =>
                        setSystemParams({ ...systemParams, siteUrl: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      管理员邮箱
                    </label>
                    <input
                      type="email"
                      value={systemParams.adminEmail}
                      onChange={(e) =>
                        setSystemParams({ ...systemParams, adminEmail: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      最大上传文件大小（MB）
                    </label>
                    <input
                      type="number"
                      value={systemParams.maxUploadSize}
                      onChange={(e) =>
                        setSystemParams({
                          ...systemParams,
                          maxUploadSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      会话超时时间（小时）
                    </label>
                    <input
                      type="number"
                      value={systemParams.sessionTimeout}
                      onChange={(e) =>
                        setSystemParams({
                          ...systemParams,
                          sessionTimeout: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 保存按钮 */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  saved
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Save className="w-5 h-5" />
                {saved ? "已保存" : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
