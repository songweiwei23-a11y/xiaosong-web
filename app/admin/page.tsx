"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Activity, TrendingUp, Settings, Database, FileText, Loader2, RefreshCw } from "lucide-react";

type Stats = {
  totalUsers: number;
  activeToday: number;
  apiCallsToday: number;
  /*
   * 键跟着接口走（lib/admin-stats.ts 的 buildPlanDistribution）：free/basic/pro/enterprise。
   * 这里原来写的是 free/pro/premium/enterprise——套餐里根本没有 premium，
   * 接口也不返回它，于是"付费会员"= pro + undefined + enterprise = NaN，
   * 基础会员也一直没被算进去。
   */
  subscriptionStats: Record<string, number>;
};

type Health = {
  ok: boolean;
  label: string;
  note: string;
  checks: { name: string; ok: boolean; ms: number; detail?: string }[];
};

/** 付费会员数 = 除免费版以外所有档位之和。不按名字列举，加档位不会漏 */
const paidCount = (s: Record<string, number>) =>
  Object.entries(s).reduce((sum, [k, v]) => (k === "free" ? sum : sum + (Number(v) || 0)), 0);

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
    subscriptionStats: { free: 0, basic: 0, pro: 0, enterprise: 0 },
  });
  // null = 还在检查。检查完之前不显示任何状态，更不能先显示"正常"
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    checkAdminRole();
    fetchStats();
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setHealth(null);
    try {
      const res = await fetch("/api/admin/health");
      if (res.ok) setHealth(await res.json());
      else setHealth({ ok: false, label: "检查失败", note: `健康检查接口返回 ${res.status}`, checks: [] });
    } catch {
      setHealth({ ok: false, label: "检查失败", note: "健康检查接口连不上", checks: [] });
    }
  };

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
      <div className="min-h-screen  flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    const badges: any = {
      developer: { label: "超级管理员", icon: "👨‍💻", color: "bg-destructive/100" },
      admin: { label: "管理员", icon: "👔", color: "bg-accent/100" },
      operator: { label: "运营", icon: "📊", color: "bg-primary" },
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
    <div className="min-h-screen ">
      <div className="border-b glass-panel shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">🏆</div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold brand-gradient bg-clip-text text-transparent">
                  管理后台
                </h1>
                <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">全面掌控系统运营</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {adminRole && getRoleBadge(adminRole)}
              <span className="text-sm text-muted-foreground dark:text-foreground">{adminEmail}</span>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 text-sm font-medium text-foreground/80 dark:text-foreground bg-muted dark:bg-muted hover:bg-muted dark:hover:bg-muted rounded-lg transition-colors"
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
            <h2 className="text-2xl font-bold text-foreground dark:text-foreground">📊 数据概览</h2>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase">总用户</span>
              </div>
              <div className="text-4xl font-extrabold text-foreground mb-2">
                {stats.totalUsers}
              </div>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                {/* 原来写"今日活跃"，接口算的是近 7 天有用量变动的人数（见 /api/admin/stats） */}
                近 7 天活跃: <span className="font-semibold text-primary">{stats.activeToday}</span>
              </p>
            </div>

            <div className="glass-panel rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <Activity className="h-8 w-8 text-green-500" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase">生成</span>
              </div>
              <div className="text-4xl font-extrabold text-foreground mb-2">
                {stats.apiCallsToday}
              </div>
              {/* 原来写"今日调用次数"，但接口给的是累计生成次数（见 /api/admin/stats 注释） */}
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">累计生成次数</p>
            </div>

            <div className="glass-panel rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase">会员</span>
              </div>
              <div className="text-4xl font-extrabold text-foreground mb-2">
                {paidCount(stats.subscriptionStats)}
              </div>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                免费: {stats.subscriptionStats.free ?? 0} | 付费: {paidCount(stats.subscriptionStats)}
              </p>
            </div>

            <div className="glass-panel rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <Activity className="h-8 w-8 text-orange-500" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase">系统状态</span>
              </div>
              {/*
                这里原来是写死的"运行正常 / 所有服务正常"——Dify 挂了、数据库连不上，
                它都照样显示绿色。现在是真检查：数据库查一次、Dify 探一次活。
              */}
              {health === null ? (
                <div className="mb-2 flex items-center gap-2 text-lg text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> 检查中…
                </div>
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold mb-2 ${
                      !health.ok ? "text-destructive" : health.label === "运行正常" ? "text-green-500" : "text-amber-500"
                    }`}
                  >
                    {health.label}
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">{health.note}</p>
                  <button onClick={fetchHealth} className="mt-2 text-xs text-primary hover:underline">
                    重新检查
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground dark:text-foreground mb-6">🔧 管理功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button
              onClick={() => router.push("/admin/users")}
              className="group glass-panel rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-border hover:border-accent/20 dark:hover:border-purple-800"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-2 group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    用户管理
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">查看用户、编辑配额、管理会员等级</p>
                </div>
              </div>
            </button>

            {/*
              下面三个按钮原来点了都只弹"XX功能开发中..."。
              其实系统设置和实时监控两页早就做好了，只是按钮没接过去；
              操作日志是真没有，这次补上了。描述也改成如实的：
              系统设置页是只读的，操作日志不含系统异常日志。
            */}
            <button
              onClick={() => router.push("/admin/settings")}
              className="group glass-panel rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-border hover:border-accent/20 dark:hover:border-purple-800"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Settings className="h-8 w-8 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-2 group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    系统设置
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">查看当前套餐与额度，以及各项配置在哪里改</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push("/admin/monitor")}
              className="group glass-panel rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-border hover:border-accent/20 dark:hover:border-purple-800"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <Database className="h-8 w-8 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-2 group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    实时监控
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">实时看站内注册、生成和订单动态</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push("/admin/logs")}
              className="group glass-panel rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border border-gray-100 dark:border-border hover:border-accent/20 dark:hover:border-purple-800"
            >
              <div className="flex items-start gap-6">
                <div className="p-4 bg-amber-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                  <FileText className="h-8 w-8 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-2 group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    操作日志
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">谁在什么时候、对谁做了什么操作</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {adminRole === "developer" && (
          <div className="mt-10 brand-gradient rounded-2xl shadow-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🔑</span>
              开发者专属功能
            </h2>
            <p className="text-accent mb-6">高级系统管理与维护工具</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">数据库管理</p>
                <p className="text-sm text-accent mt-1">SQL 查询、备份恢复</p>
              </button>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">API 密钥管理</p>
                <p className="text-sm text-accent mt-1">生成、撤销密钥</p>
              </button>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl p-4 text-left transition-all">
                <p className="font-semibold">系统备份</p>
                <p className="text-sm text-accent mt-1">一键备份还原</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
