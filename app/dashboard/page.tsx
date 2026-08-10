"use client";
import ProfileDashboard from "./components/ProfileDashboard";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { 
  FileText, 
  Lightbulb, 
  Film, 
  CheckCircle, 
  Tag, 
  Target,
  ArrowRight,
  Clock,
  History,
  Crown,
  TrendingUp,
  RefreshCw,
  Loader2,
} from "lucide-react";

const features = [
  {
    name: "脚本生成",
    description: "专业口播稿 + 结构拆解 + 可替换句式",
    icon: FileText,
    href: "/dashboard/script",
    color: "blue",
    badge: "最常用"
  },
  {
    name: "选题策划",
    description: "12个选题方案 + 优先级建议 + 爆款分析",
    icon: Lightbulb,
    href: "/dashboard/topic",
    color: "yellow",
  },
  {
    name: "分镜脚本",
    description: "详细拍摄执行表 + 镜头语言 + 剪辑节奏",
    icon: Film,
    href: "/dashboard/storyboard",
    color: "purple",
  },
  {
    name: "审稿优化",
    description: "AI诊断问题 + 给出修改建议 + 完整修改版",
    icon: CheckCircle,
    href: "/dashboard/review",
    color: "green",
  },
  {
    name: "标题封面",
    description: "12个标题方案 + 封面字 + 发布文案",
    icon: Tag,
    href: "/dashboard/title",
    color: "red",
  },
  {
    name: "账号定位",
    description: "测试方向 + 7天计划 + 判断标准",
    icon: Target,
    href: "/dashboard/positioning",
    color: "indigo",
  },
  {
    name: "生成历史",
    description: "查看所有生成记录 + 复制下载 + 数据统计",
    icon: History,
    href: "/history",
    color: "gray",
    badge: "新增"
  },
];

export default function DashboardPage() {
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    console.log("🔄 开始加载用户设置...");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("📊 Session状态:", session ? "已登录" : "未登录");
      
      if (sessionError) {
        console.error("❌ Session错误:", sessionError);
      }
      
      if (!session) {
        console.log("⚠️ 未登录");
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      console.log("✅ 用户ID:", userId);

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("❌ 查询用户设置失败:", error);
        setUserSettings({
          quota_used: 0,
          quota_limit: 5,
          subscription_tier: "free"
        });
      } else {
        console.log("✅ 用户设置加载成功:", data);
        setUserSettings(data);
      }
    } catch (error: any) {
      console.error("❌ 加载失败:", error);
      setUserSettings({
        quota_used: 0,
        quota_limit: 5,
        subscription_tier: "free"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTierLabel = (tier: string) => {
    const labels: any = {
      free: "免费版",
      pro: "Pro版",
      premium: "Premium版"
    };
    return labels[tier] || "免费版";
  };

  // 加载动画组件
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          {/* 旋转的圆圈动画 */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-slate-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
          </div>

          {/* 加载文字 */}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            小宋编导工作台
          </h2>
          <p className="text-slate-600 dark:text-slate-400 animate-pulse">
            正在加载您的工作台...
          </p>

          {/* 加载进度点 */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-pink-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <ProfileDashboard />

      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">工作台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              选择功能开始创作，让AI成为你的专业编导助手
            </p>
          </div>
          <Link 
            href="/dashboard/membership"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <Crown className="h-4 w-4" />
            升级会员
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-8 px-8 py-8">
        {/* Membership Banner */}
        {!loading && userSettings && userSettings.subscription_tier === 'free' && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-8 text-white shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-6 h-6" />
                  <h3 className="text-2xl font-bold">升级会员，解锁全部功能</h3>
                </div>
                <p className="text-purple-100 mb-4">
                  专业版每月仅需 ¥99，享受无限生成次数 + 高级功能 + 优先支持
                </p>
                <Link 
                  href="/dashboard/membership"
                  className="inline-flex items-center gap-2 rounded-lg bg-white text-purple-600 px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-105"
                >
                  立即升级
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="hidden lg:block">
                <div className="flex gap-4">
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm px-6 py-4 text-center">
                    <div className="text-3xl font-bold">无限</div>
                    <div className="text-sm text-purple-100">生成次数</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm px-6 py-4 text-center">
                    <div className="text-3xl font-bold">7x24</div>
                    <div className="text-sm text-purple-100">优先支持</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {!loading && userSettings && (
          <div className="grid grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">本月已用</div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  {userSettings.quota_used}
                </div>
                <div className="text-lg text-muted-foreground">/ {userSettings.quota_limit}</div>
                <div className="text-sm text-muted-foreground">次</div>
              </div>
            </div>
            
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">会员等级</div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className={`text-2xl font-bold ${
                  userSettings.subscription_tier === 'pro' ? 'text-purple-500' :
                  userSettings.subscription_tier === 'premium' ? 'text-yellow-500' :
                  'text-foreground'
                }`}>
                  {getTierLabel(userSettings.subscription_tier)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">使用率</div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  {userSettings.quota_limit > 0 
                    ? Math.round((userSettings.quota_used / userSettings.quota_limit) * 100) 
                    : 0}
                </div>
                <div className="text-sm text-muted-foreground">%</div>
              </div>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div>
          <h2 className="mb-6 text-xl font-bold text-foreground">
            核心功能
          </h2>
          <div className="grid grid-cols-3 gap-8">
            {features.map((feature) => (
              <Link
                key={feature.name}
                href={feature.href}
                className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary hover:shadow-2xl hover:scale-105 hover:-translate-y-1 duration-300"
              >
                {feature.badge && (
                  <div className="absolute right-4 top-4">
                    <span className="rounded-full bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-sm">
                      {feature.badge}
                    </span>
                  </div>
                )}
                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300 ${
                    feature.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    feature.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    feature.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    feature.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                    feature.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                    feature.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                    'bg-muted'
                  }`}
                >
                  <feature.icon
                    className={`h-6 w-6 ${
                      feature.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      feature.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      feature.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                      feature.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      feature.color === 'red' ? 'text-red-600 dark:text-red-400' :
                      feature.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                      'text-muted-foreground'
                    }`}
                  />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {feature.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
                  {feature.name === "生成历史" ? "查看记录" : "开始使用"}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
