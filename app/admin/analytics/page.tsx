"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { notify } from '@/components/ui/feedback';
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  FileText,
  Lightbulb,
  Film,
  CheckCircle,
  Tag,
  Target,
  BookOpen,
} from "lucide-react";

export default function AnalyticsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalUsers: 0,
    activeUsers: 0,
    conversionRate: 0,
    avgUsagePerUser: 0,
  });
  const [featureUsage, setFeatureUsage] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);

      // 检查登录
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // 检查管理员权限
      const checkResponse = await fetch(`/api/admin/check`);
      const checkData = await checkResponse.json();

      if (!checkData.isAdmin) {
        notify("⚠️ 您没有管理员权限");
        router.push("/dashboard");
        return;
      }

      // 加载统计数据
      const statsResponse = await fetch(`/api/admin/stats`);
      const statsData = await statsResponse.json();
      
      if (!statsData.error) {
        setStats({
          totalRevenue: 0,
          monthlyRevenue: statsData.monthlyRevenue || 0,
          totalUsers: statsData.totalUsers || 0,
          activeUsers: statsData.activeUsers || 0,
          conversionRate: statsData.paidUsers && statsData.totalUsers 
            ? parseFloat(((statsData.paidUsers / statsData.totalUsers) * 100).toFixed(1))
            : 0,
          avgUsagePerUser: statsData.totalUsers 
            ? Math.round(statsData.totalUsage / statsData.totalUsers)
            : 0,
        });
      }

      // 加载功能使用统计
      const analyticsResponse = await fetch(`/api/admin/analytics`);
      const analyticsData = await analyticsResponse.json();
      
      if (!analyticsData.error) {
        const iconMap: any = {
          "脚本生成": { icon: FileText, color: "blue" },
          "选题策划": { icon: Lightbulb, color: "yellow" },
          "分镜脚本": { icon: Film, color: "purple" },
          "审稿优化": { icon: CheckCircle, color: "green" },
          "标题封面": { icon: Tag, color: "red" },
          "账号定位": { icon: Target, color: "indigo" },
          "知识库": { icon: BookOpen, color: "pink" },
        };

        setFeatureUsage(analyticsData.features.map((f: any) => ({
          ...f,
          ...iconMap[f.name],
        })));
      }
    } catch (error) {
      console.error("Load analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 用户增长数据(暂时保留模拟数据)
  const userGrowth = [
    { date: "07-20", users: 0 },
    { date: "07-21", users: 0 },
    { date: "07-22", users: 0 },
    { date: "07-23", users: 0 },
    { date: "07-24", users: 0 },
    { date: "07-25", users: 0 },
    { date: "07-26", users: 0 },
    { date: "07-27", users: 1 },
  ];

  // 套餐分布(暂时保留模拟数据)
  const planDistribution = [
    { plan: "免费版", count: stats.totalUsers - stats.activeUsers, percentage: 100, color: "gray" },
    { plan: "基础会员", count: 0, percentage: 0, color: "blue" },
    { plan: "专业会员", count: 0, percentage: 0, color: "purple" },
    { plan: "企业版", count: 0, percentage: 0, color: "orange" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* 顶部导航 */}
      <div className="bg-white dark:bg-slate-800 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">数据统计</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                查看平台数据和用户行为分析
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
                <option value="90d">最近 90 天</option>
              </select>
              <a
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← 返回后台首页
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 核心指标 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-100">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-green-600">+0%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              ¥{stats.monthlyRevenue}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">本月收入</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-blue-600">+100%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              {stats.totalUsers}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">总用户数</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-purple-600">+100%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              {stats.activeUsers}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">活跃用户</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 用户增长趋势 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              用户增长趋势
            </h2>
            <div className="h-64 flex items-end justify-between gap-2">
              {userGrowth.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                    style={{
                      height: `${Math.max(day.users * 100, 5)}%`,
                    }}
                  />
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-2">{day.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 会员分布 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              会员套餐分布
            </h2>
            <div className="space-y-4">
              {planDistribution.map((item) => (
                <div key={item.plan}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                      {item.plan}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {item.count} 人 ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`bg-${item.color}-500 h-2 rounded-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 功能使用排行 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
            功能使用排行
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureUsage
              .sort((a, b) => b.count - a.count)
              .map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.name}
                    className="relative p-4 rounded-lg border hover:shadow-md transition-shadow"
                  >
                    <div className="absolute top-2 right-2">
                      <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                        #{index + 1}
                      </span>
                    </div>
                    <div
                      className={`inline-flex p-3 rounded-lg bg-${feature.color}-100 mb-3`}
                    >
                      <Icon className={`w-5 h-5 text-${feature.color}-600`} />
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                      {feature.name}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {feature.count}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">次使用</div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">
              付费转化率
            </h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              {stats.conversionRate}%
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {stats.totalUsers > 0
                ? `${stats.totalUsers - 1} 用户未付费`
                : "暂无数据"}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">
              人均使用次数
            </h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              {stats.avgUsagePerUser}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">次/用户</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">
              累计收入
            </h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              ¥{stats.totalRevenue}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">自平台上线以来</div>
          </div>
        </div>
      </div>
    </div>
  );
}



