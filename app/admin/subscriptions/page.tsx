"use client";

import { useState, useEffect } from "react";
import { Crown, Edit, Save, X, Calendar, Zap, RefreshCw, Search } from "lucide-react";
import { notify, confirmDialog } from '@/components/ui/feedback';
import { Loading } from '@/components/ui/loading';

interface UserSubscription {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  quota: { used: number; total: number };
  startDate: string;
  endDate: string | null;
}

export default function SubscriptionsManagement() {
  const [users, setUsers] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState({
    plan: "",
    endDate: "",
  });

  useEffect(() => {
    loadSubscriptions();
  }, [planFilter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (planFilter !== 'all') {
        params.append('plan', planFilter);
      }
      
      const response = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.subscriptions || []);
      } else {
        notify(data.error || '加载失败', 'error');
      }
    } catch (error) {
      console.error('加载会员列表失败:', error);
      notify('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const planInfo: any = {
    free: { label: "免费版", color: "gray", quota: 50 },
    basic: { label: "基础会员", color: "blue", quota: 150 },
    pro: { label: "专业会员", color: "purple", quota: 500 },
    enterprise: { label: "企业版", color: "orange", quota: -1 },
  };

  const handleEdit = (user: UserSubscription) => {
    setEditingId(user.user_id);
    setEditForm({
      plan: user.plan,
      endDate: user.endDate || "",
    });
  };

  const handleSave = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          plan: editForm.plan,
          endDate: editForm.endDate,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        notify(data.message || '会员信息已更新', 'success');
        setEditingId(null);
        loadSubscriptions();
      } else {
        notify(data.error || '更新失败', 'error');
      }
    } catch (error) {
      console.error('更新失败:', error);
      notify('更新失败', 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleResetQuota = async (userId: string) => {
    if (await confirmDialog("确定要重置该用户的本月使用额度吗？")) {
      try {
        const response = await fetch('/api/admin/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            action: 'reset_quota',
          }),
        });

        const data = await response.json();

        if (response.ok) {
          notify(data.message || '额度已重置', 'success');
          loadSubscriptions();
        } else {
          notify(data.error || '重置失败', 'error');
        }
      } catch (error) {
        console.error('重置失败:', error);
        notify('重置失败', 'error');
      }
    }
  };

  const filteredUsers = users.filter(user =>
    searchTerm === '' ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 统计
  const stats = {
    total: users.length,
    free: users.filter(u => u.plan === 'free').length,
    basic: users.filter(u => u.plan === 'basic').length,
    pro: users.filter(u => u.plan === 'pro').length,
    enterprise: users.filter(u => u.plan === 'enterprise').length,
  };

  if (loading) {
    return <Loading size="lg" text="加载会员数据..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="border-b bg-white dark:bg-slate-800 shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
                <Crown className="w-8 h-8 text-purple-600" />
                会员管理
              </h1>
              <p className="text-sm text-muted-foreground mt-1">管理用户会员权限和额度</p>
            </div>
            <button
              onClick={loadSubscriptions}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-10">
        {/* 统计卡片 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">总会员</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">免费版</div>
            <div className="text-2xl font-bold text-gray-700">{stats.free}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600">基础会员</div>
            <div className="text-2xl font-bold text-blue-700">{stats.basic}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600">专业会员</div>
            <div className="text-2xl font-bold text-purple-700">{stats.pro}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-600">企业版</div>
            <div className="text-2xl font-bold text-orange-700">{stats.enterprise}</div>
          </div>
        </div>

        {/* 筛选和搜索 */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索用户邮箱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">全部套餐</option>
            <option value="free">免费版</option>
            <option value="basic">基础会员</option>
            <option value="pro">专业会员</option>
            <option value="enterprise">企业版</option>
          </select>
        </div>

        {/* 用户列表 */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">用户</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">套餐</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">额度使用</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">到期时间</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">ID: {user.user_id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === user.user_id ? (
                        <select
                          value={editForm.plan}
                          onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="free">免费版</option>
                          <option value="basic">基础会员</option>
                          <option value="pro">专业会员</option>
                          <option value="enterprise">企业版</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${planInfo[user.plan]?.color}-100 text-${planInfo[user.plan]?.color}-700`}>
                          {planInfo[user.plan]?.label || user.plan}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          {user.quota.used} / {user.quota.total === -1 ? '无限' : user.quota.total}
                        </div>
                        {user.quota.total !== -1 && (
                          <div className="flex-1 bg-muted rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{
                                width: `${Math.min((user.quota.used / user.quota.total) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === user.user_id ? (
                        <input
                          type="date"
                          value={editForm.endDate ? editForm.endDate.split('T')[0] : ''}
                          onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                          className="px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm">
                          {user.endDate ? new Date(user.endDate).toLocaleDateString() : '永久'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === user.user_id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSave(user.user_id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResetQuota(user.user_id)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="重置额度"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}