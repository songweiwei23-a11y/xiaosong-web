"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Activity, TrendingUp, Settings, Database, FileText, Loader2, RefreshCw } from "lucide-react";
import { notify } from '@/components/ui/feedback';

type Stats = {
  totalUsers: number;
  activeToday: number;
  apiCallsToday: number;
  subscriptionStats: {
    free: number;
    pro: number;
    premium: number;
    enterprise: number;
  };
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeToday: 0,
    apiCallsToday: 0,
    subscriptionStats: { free: 0, pro: 0, premium: 0, enterprise: 0 },
  });

  useEffect(() => {
    checkAdminRole();
    fetchStats();
  }, []);

  const checkAdminRole = async () => {
    try {
      const response = await fetch("/api/admin/check-role");
      if (response.ok) {
        const data = await response.json();
        setAdminRole(data.role);
        setAdminEmail(data.email);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to check admin role:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-slate-900 via-purple-50 dark:via-slate-900 to-pink-50 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    const badges: any = {
      developer: { label: "超级管理员", icon: "👨‍💻", color: "bg-red-500" },
      admin: { label: "管理员", icon: "👑", color: "bg-purple-500" },
      operator: { label: "运营", icon: "📊", color: "bg-blue-500" },
    };
    const badge = badges[role] || badges.operator;
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 ${badge.color} text-white rounded-full text-sm font-semibold shadow-lg`}>
        <span>{badge.icon}</span>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-slate-900 via-purple-50 dark:via-slate-900 to-pink-50 dark:to-slate-950">
      <div className="border-b bg-white dark:bg-slate-800 shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">🎯</div>
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  管理后台
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">全面掌控系统运营</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {adminRole && getRoleBadge(adminRole)}
              <span className="text-sm text-gray-600 dark:text-slate-300">{adminEmail}</span>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                返回工作台
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📊 数据概览</h2>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-slate-700">
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:to-slate-950 rounded-2xl group-hover:scale-110 transition-transform">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400">用户</p>
                    <h3 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {stats.totalUsers}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300">总注册用户</p>
                <div className="mt-4 flex gap-2 text-xs flex-wrap">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded">免费: {stats.subscriptionStats.free}</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Pro: {stats.subscriptionStats.pro}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">高级: {stats.subscriptionStats.premium}</span>
                </div>
              </div>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-slate-700">
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400">活跃</p>
                    <h3 className="text-4xl font-extrabold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                      {stats.activeToday}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300">今日活跃用户</p>
              </div>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-slate-700">
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400">调用</p>
                    <h3 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {stats.apiCallsToday}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300">今日 API 调用</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6">🛠️ 管理功能</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">选择您需要的功能模块</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => router.push("/admin/users")}
              className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-slate-700 hover:border-purple-200"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:to-slate-950 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2 group-hover:text-purple-600 transition-colors">
                    用户管理
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">查看所有用户、编辑配额、管理会员等级</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => notify("系统配置功能开发中...")}
              className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-slate-700 hover:border-purple-200"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <Settings className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2 group-hover:text-purple-600 transition-colors">
                    系统配置
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">修改系统参数、会员套餐、功能开关</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => notify("数据监控功能开发中...")}
              className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-slate-700 hover:border-purple-200"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <Database className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2 group-hover:text-purple-600 transition-colors">
                    数据监控
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">实时监控系统运行状态、数据库性能</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => notify("操作日志功能开发中...")}
              className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-slate-700 hover:border-purple-200"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <FileText className="h-8 w-8 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2 group-hover:text-purple-600 transition-colors">
                    操作日志
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">查看管理员操作记录、系统异常日志</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {adminRole === "developer" && (
          <div className="mt-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🔧</span>
              开发者专属功能
            </h2>
            <p className="text-purple-100 mb-6">高级系统管理与维护工具</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">数据库管理</p>
                <p className="text-sm text-purple-200 mt-1">SQL 查询、备份恢复</p>
              </button>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">API 密钥管理</p>
                <p className="text-sm text-purple-200 mt-1">生成、撤销密钥</p>
              </button>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">系统备份</p>
                <p className="text-sm text-purple-200 mt-1">一键备份还原</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}