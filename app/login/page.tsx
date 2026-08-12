"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { LogIn, Mail, Lock, Sparkles, ArrowLeft, Home, Ticket } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isLogin) {
        // 登录逻辑
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        setMessage("登录成功！正在跳转...");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 500);
      } else {
        // 注册逻辑 - 需要邀请码
        if (!invitationCode.trim()) {
          setMessage("请输入邀请码");
          setLoading(false);
          return;
        }

        // 1. 先验证邀请码
        const validateRes = await fetch("/api/invitation/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: invitationCode.trim() }),
        });

        const validateData = await validateRes.json();

        if (!validateRes.ok || !validateData.valid) {
          setMessage(validateData.error || "邀请码无效");
          setLoading(false);
          return;
        }

        // 2. 注册账户
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined,
            data: {
              email_confirmed: true
            }
          }
        });

        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          setMessage("该邮箱已注册，请直接登录。");
          setLoading(false);
          return;
        }

        // 3. 使用邀请码
        if (data?.user) {
          const useRes = await fetch("/api/invitation/use", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              code: invitationCode.trim(),
              userId: data.user.id 
            }),
          });

          const useData = await useRes.json();

          if (!useRes.ok) {
            console.error("使用邀请码失败:", useData.error);
            // 不阻断注册，但提示用户
            setMessage(`注册成功，但邀请码使用失败: ${useData.error}。请联系管理员。`);
            setLoading(false);
            return;
          }

          const planName = 
            useData.planType === "basic" ? "基础会员" :
            useData.planType === "pro" ? "专业会员" :
            useData.planType === "enterprise" ? "企业会员" :
            "体验版";

          setMessage(`注册成功！您已获得${planName}权限。请切换到登录标签页进行登录。`);
          setTimeout(() => setIsLogin(true), 2000);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setMessage(error.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">返回首页</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10 px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:scale-105 transition-transform">
            <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              小宋编导工作台
            </h1>
          </Link>
          <p className="text-slate-600 dark:text-slate-400">AI驱动的短视频脚本创作工具</p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          {/* 登录/注册切换 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                isLogin
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setMessage("");
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                !isLogin
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {/* 邮箱输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* 邀请码输入 - 仅注册时显示 */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                  邀请码 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    placeholder="请输入邀请码（如：XS-ABC123）"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors uppercase"
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  💡 新用户需要邀请码才能注册。请向付费用户或管理员获取邀请码。
                </p>
              </div>
            )}

            {/* 消息提示 */}
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                message.includes("成功")
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
              }`}>
                {message}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3.5 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {isLogin ? "登录账户" : "注册账户"}
                </>
              )}
            </button>
          </form>

          {/* 切换提示 */}
          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {isLogin ? "还没有账号？" : "已有账号？"}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors"
            >
              {isLogin ? "立即注册" : "立即登录"}
            </button>
          </div>
        </div>

        {/* 功能亮点 */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">8</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">核心功能</div>
          </div>
          <div className="text-center p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">10000+</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">知识库</div>
          </div>
          <div className="text-center p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">10秒</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">生成脚本</div>
          </div>
        </div>

        {/* 底部链接 */}
        <div className="mt-6 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页了解更多
          </Link>
        </div>
      </div>
    </div>
  );
}
