"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Edit2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { notify } from '@/components/ui/feedback';

type User = {
  user_id: string;
  email: string;
  membership_level: string;
  quota: number;
  created_at: string;
};

export default function UsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState("");
  const [editLevel, setEditLevel] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: search,
      });
      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    setLoading(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user.user_id);
    setEditQuota(user.quota.toString());
    setEditLevel(user.membership_level);
  };

  const handleSave = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          quota: parseInt(editQuota),
          membership_level: editLevel,
        }),
      });

      if (response.ok) {
        notify('更新成功！');
        setEditingUser(null);
        fetchUsers();
      } else {
        notify('更新失败');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      notify('更新失败');
    }
  };

  const getLevelBadge = (level: string) => {
    const styles: any = {
      free: "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200",
      pro: "bg-purple-100 text-purple-700",
      enterprise: "bg-blue-100 text-blue-700",
    };
    const labels: any = {
      free: "免费版",
      pro: "Pro版",
      enterprise: "企业版",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[level] || styles.free}`}>
        {labels[level] || level}
      </span>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-slate-900 via-purple-50 dark:via-slate-900 to-pink-50 dark:to-slate-950">
      {/* 顶部导航 */}
      <div className="border-b bg-white dark:bg-slate-800 shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                👥 用户管理
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">查看和管理所有注册用户</p>
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              返回管理后台
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-10">
        {/* 搜索栏 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="搜索用户 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => fetchUsers()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-slate-400">暂无用户数据</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 dark:from-slate-900 to-blue-50 dark:to-slate-950">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase">邮箱</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase">会员等级</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase">配额</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase">注册时间</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">{user.email}</td>
                      <td className="px-6 py-4">
                        {editingUser === user.user_id ? (
                          <select
                            value={editLevel}
                            onChange={(e) => setEditLevel(e.target.value)}
                            className="px-3 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm"
                          >
                            <option value="free">免费版</option>
                            <option value="pro">Pro版</option>
                            <option value="enterprise">企业版</option>
                          </select>
                        ) : (
                          getLevelBadge(user.membership_level)
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">
                        {editingUser === user.user_id ? (
                          <input
                            type="number"
                            value={editQuota}
                            onChange={(e) => setEditQuota(e.target.value)}
                            className="w-24 px-3 py-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm"
                          />
                        ) : (
                          `${user.quota} 次`
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4">
                        {editingUser === user.user_id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(user.user_id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="px-3 py-1 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-200 text-sm rounded-lg hover:bg-gray-400 dark:hover:bg-slate-500"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(user)}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                            编辑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 分页 */}
              <div className="border-t bg-gray-50 dark:bg-slate-800/40 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-slate-200">
                  共 <span className="font-semibold">{total}</span> 个用户，第 <span className="font-semibold">{page}</span> / {totalPages} 页
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}