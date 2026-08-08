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
      console.log("📊 Session详情:", session);
      
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
      console.log("📧 用户邮箱:", session.user.email);

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
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <History className="w-4 h-4" />
              生成历史
            </Link>
            
            {loading ? (
              <div className="rounded-lg border border-border bg-muted px-4 py-2">
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mb-1" />
                <div className="text-xs text-muted-foreground">加载中...</div>
              </div>
            ) : userSettings ? (
              <div className={`rounded-lg border px-4 py-2 ${
                userSettings.subscription_tier === 'pro' ? 'bg-purple-500/10 border-purple-500/30' :
                userSettings.subscription_tier === 'premium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-primary/10 border-primary/30'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`text-xs font-medium ${
                    userSettings.subscription_tier === 'pro' ? 'text-purple-600' :
                    userSettings.subscription_tier === 'premium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {userSettings.subscription_tier === 'pro' && <Crown className="w-3 h-3 inline mr-1" />}
                    {userSettings.subscription_tier === 'premium' && <TrendingUp className="w-3 h-3 inline mr-1" />}
                    {getTierLabel(userSettings.subscription_tier)}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${
                  userSettings.subscription_tier === 'pro' ? 'text-purple-700' :
                  userSettings.subscription_tier === 'premium' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  剩余 {Math.max(0, userSettings.quota_limit - userSettings.quota_used)}/{userSettings.quota_limit} 次
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted px-4 py-2">
                <div className="text-xs text-muted-foreground">游客模式</div>
                <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  登录查看
                </Link>
              </div>
            )}
            
            <Link 
              href="/dashboard/membership"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              升级会员
            </Link>
          </div>
        </div>
      </div>

      <div className="p-10 min-h-screen">
        {/* Stats */}
        {!loading && userSettings && userSettings.quota_limit && (
          <div className="mb-10 grid grid-cols-3 gap-8">
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
                    <span className="rounded-full bg-gradient-to-r from-blue-100 to-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                      {feature.badge}
                    </span>
                  </div>
                )}
                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300 ${
                    feature.color === 'blue' ? 'bg-blue-100' :
                    feature.color === 'yellow' ? 'bg-yellow-100' :
                    feature.color === 'purple' ? 'bg-purple-100' :
                    feature.color === 'green' ? 'bg-green-100' :
                    feature.color === 'red' ? 'bg-red-100' :
                    feature.color === 'indigo' ? 'bg-indigo-100' :
                    'bg-muted'
                  }`}
                >
                  <feature.icon
                    className={`h-6 w-6 ${
                      feature.color === 'blue' ? 'text-blue-600' :
                      feature.color === 'yellow' ? 'text-yellow-600' :
                      feature.color === 'purple' ? 'text-purple-600' :
                      feature.color === 'green' ? 'text-green-600' :
                      feature.color === 'red' ? 'text-red-600' :
                      feature.color === 'indigo' ? 'text-indigo-600' :
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
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
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






