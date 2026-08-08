"use client";

import { useState, useEffect } from "react";
import { Crown, Edit, Save, X, Calendar, Zap } from "lucide-react";
import { notify, confirmDialog } from '@/components/ui/feedback';

interface UserSubscription {
  id: string;
  email: string;
  plan: string;
  status: string;
  quota: { used: number; total: number };
  startDate: string;
  endDate: string | null;
}

export default function SubscriptionsManagement() {
  const [users, setUsers] = useState<UserSubscription[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    plan: "",
    quota: 0,
    endDate: "",
  });

  useEffect(() => {
    // 模拟数据，后续连接真实数据库
    setUsers([
      {
        id: "1",
        email: "song.weiwei23@gmail.com",
        plan: "free",
        status: "active",
        quota: { used: 3, total: 5 },
        startDate: "2026-07-27",
        endDate: null,
      },
    ]);
  }, []);

  const planInfo: any = {
    free: { label: "免费版", color: "gray", quota: 5 },
    basic: { label: "基础会员", color: "blue", quota: 50 },
    pro: { label: "专业会员", color: "purple", quota: 200 },
    enterprise: { label: "企业版", color: "orange", quota: 999 },
  };

  const handleEdit = (user: UserSubscription) => {
    setEditingId(user.id);
    setEditForm({
      plan: user.plan,
      quota: user.quota.total,
      endDate: user.endDate || "",
    });
  };

  const handleSave = (userId: string) => {
    // 这里后续会连接真实API
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              plan: editForm.plan,
              quota: { ...user.quota, total: editForm.quota },
              endDate: editForm.endDate || null,
            }
          : user
      )
    );
    setEditingId(null);
    notify("会员信息已更新！");
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleResetQuota = async (userId: string) => {
    if (await confirmDialog("确定要重置该用户的本月使用额度吗？")) {
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, quota: { ...user.quota, used: 0 } } : user
        )
      );
      notify("使用额度已重置！");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* 顶部导航 */}
      <div className="bg-white dark:bg-slate-800 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">会员管理</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                管理用户会员等级和权限
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
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border p-4">
            <div className="text-sm text-gray-500 dark:text-slate-400">免费用户</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">
              {users.filter((u) => u.plan === "free").length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border p-4">
            <div className="text-sm text-gray-500 dark:text-slate-400">基础会员</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {users.filter((u) => u.plan === "basic").length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border p-4">
            <div className="text-sm text-gray-500 dark:text-slate-400">专业会员</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {users.filter((u) => u.plan === "pro").length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border p-4">
            <div className="text-sm text-gray-500 dark:text-slate-400">企业版</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {users.filter((u) => u.plan === "enterprise").length}
            </div>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-800/40 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  用户邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  会员套餐
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  月度额度
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  到期时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-slate-100">{user.email}</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">ID: {user.id}</div>
                  </td>

                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <select
                        value={editForm.plan}
                        onChange={(e) =>
                          setEditForm({ ...editForm, plan: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="free">免费版</option>
                        <option value="basic">基础会员</option>
                        <option value="pro">专业会员</option>
                        <option value="enterprise">企业版</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-${
                          planInfo[user.plan].color
                        }-100 text-${planInfo[user.plan].color}-700`}
                      >
                        <Crown className="w-3 h-3" />
                        {planInfo[user.plan].label}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <input
                        type="number"
                        value={editForm.quota}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            quota: parseInt(e.target.value),
                          })
                        }
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {user.quota.used} / {user.quota.total}
                          </span>
                          <button
                            onClick={() => handleResetQuota(user.id)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            <Zap className="w-3 h-3 inline" /> 重置
                          </button>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${
                                (user.quota.used / user.quota.total) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <input
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) =>
                          setEditForm({ ...editForm, endDate: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4" />
                        {user.endDate || "永久"}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(user.id)}
                          className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-600 dark:text-slate-300" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 批量操作提示 */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">💡 快速操作指南</h3>
          <ul className="text-sm text-gray-700 dark:text-slate-200 space-y-1">
            <li>• 点击 <Edit className="w-3 h-3 inline" /> 编辑按钮可修改用户会员信息</li>
            <li>• 点击 <Zap className="w-3 h-3 inline" /> 重置按钮可清空本月已用额度</li>
            <li>• 修改套餐后会立即生效，用户刷新页面即可看到变化</li>
            <li>• 设置到期时间后，系统会在到期时自动降级为免费版</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
