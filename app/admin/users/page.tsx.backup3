"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Edit2, ChevronLeft, ChevronRight, Loader2, RefreshCw, AlertCircle, Crown, Ban, Unlock, RotateCcw, Eye } from "lucide-react";
import { notify, confirmDialog } from '@/components/ui/feedback';

type User = {
  user_id: string;
  email: string;
  full_name: string;
  membership_level: string;
  subscription_status: string;
  subscription_end: string | null;
  quota_details: {
    script: { used: number };
    topic: { used: number };
    positioning: { used: number };
    freeChat: { used: number };
    storyboard: { used: number };
    review: { used: number };
    title: { used: number };
    dealReason: { used: number };
  };
  total_used: number;
  period_end: string | null;
  created_at: string;
  last_sign_in_at: string;
  has_profile: boolean;
  has_subscription: boolean;
  has_quota: boolean;
};

export default function UsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editPlan, setEditPlan] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: search,
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取用户列表失败');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('获取用户失败:', error);
      notify(error.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleUpdateMembership = async (userId: string, plan: string, endDate?: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'update_membership',
          plan,
          endDate: endDate || null
        }),
      });

      if (response.ok) {
        notify('会员等级更新成功！');
        setShowEditModal(false);
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '更新失败');
      }
    } catch (error) {
      console.error('更新会员失败:', error);
      notify('更新失败');
    }
  };

  const handleResetQuota = async (userId: string) => {
    const confirmed = await confirmDialog('确定要重置该用户的配额吗？所有使用次数将清零。', {
      tone: 'danger',
      confirmText: '确定重置',
      title: '重置配额'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'reset_quota'
        }),
      });

      if (response.ok) {
        notify('配额重置成功！');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '重置失败');
      }
    } catch (error) {
      console.error('重置配额失败:', error);
      notify('重置失败');
    }
  };

  const handleBanUser = async (userId: string) => {
    const confirmed = await confirmDialog('确定要封禁该用户吗？用户将无法使用任何功能。', {
      tone: 'danger',
      confirmText: '确定封禁',
      title: '封禁用户'
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'ban_user'
        }),
      });

      if (response.ok) {
        notify('用户已封禁');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '封禁失败');
      }
    } catch (error) {
      console.error('封禁用户失败:', error);
      notify('封禁失败');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'unban_user'
        }),
      });

      if (response.ok) {
        notify('用户已解封');
        fetchUsers();
      } else {
        const errorData = await response.json();
        notify(errorData.error || '解封失败');
      }
    } catch (error) {
      console.error('解封用户失败:', error);
      notify('解封失败');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditPlan(user.membership_level);
    setEditEndDate(user.subscription_end ? new Date(user.subscription_end).toISOString().split('T')[0] : '');
    setShowEditModal(true);
  };

  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const getLevelBadge = (level: string) => {
    const configs: any = {
      free: { label: '免费版', color: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300' },
      basic: { label: '基础版', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      pro: { label: '专业版', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
      enterprise: { label: '企业版', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    };
    const config = configs[level] || configs.free;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      active: { label: '正常', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      inactive: { label: '已封禁', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    };
    const config = configs[status] || configs.inactive;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getPlanLimits = (plan: string) => {
    const limits: any = {
      free: { positioning: 1, topic: 3, script: 20, freeChat: 20, others: 0 },
      basic: { all: 150 },
      pro: { all: 500 },
      enterprise: { all: '无限' }
    };
    return limits[plan] || limits.free;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">用户管理</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              管理所有注册用户、会员等级和配额（共 {total} 个用户）
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中...' : '刷新数据'}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">用户信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">会员等级</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">配额使用</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">周期结束</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">{user.full_name}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getLevelBadge(user.membership_level)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.subscription_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900 dark:text-white">
                          {user.total_used} 次
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {user.period_end ? new Date(user.period_end).toLocaleDateString('zh-CN') : '无限期'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openDetailModal(user)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="查看详情"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                            title="修改会员"
                          >
                            <Crown className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleResetQuota(user.user_id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="重置配额"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                          {user.subscription_status === 'active' ? (
                            <button
                              onClick={() => handleBanUser(user.user_id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="封禁用户"
                            >
                              <Ban className="h-5 w-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnbanUser(user.user_id)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              title="解封用户"
                            >
                              <Unlock className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    显示 <span className="font-medium">{(page - 1) * pageSize + 1}</span> 到{' '}
                    <span className="font-medium">{Math.min(page * pageSize, total)}</span> 共{' '}
                    <span className="font-medium">{total}</span> 个用户
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">修改会员等级</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    用户: {selectedUser.email}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    会员套餐
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="free">免费版（定位1次 + 选题3次 + 脚本20次）</option>
                    <option value="basic">基础版 30元/月（所有功能150次）</option>
                    <option value="pro">专业版 99元/月（所有功能500次）</option>
                    <option value="enterprise">企业版 199元/月（无限使用）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    到期时间（可选）
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleUpdateMembership(selectedUser.user_id, editPlan, editEndDate)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    确定修改
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">用户详细信息</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">邮箱</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">姓名</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">会员等级</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{getLevelBadge(selectedUser.membership_level)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">账号状态</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{getStatusBadge(selectedUser.subscription_status)}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">功能使用情况</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">脚本生成</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.script.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">选题策划</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.topic.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">账号定位</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.positioning.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">自由对话</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.freeChat.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">分镜脚本</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.storyboard.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">审稿优化</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.review.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">标题封面</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.title.used}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">成交理由</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.quota_details.dealReason.used}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
