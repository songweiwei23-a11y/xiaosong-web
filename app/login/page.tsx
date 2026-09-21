"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { LogIn, Mail, Lock, Sparkles, ArrowLeft, Home } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        // 登录
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
        // 注册
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
        } else {
          setMessage("注册成功！请切换到登录标签页进行登录。");
          setTimeout(() => setIsLogin(true), 1500);
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
    // 背景交给全站的 AmbientBackground。这里原本自带一层写死的渐变和光斑，
    // 会盖住氛围层，且颜色不跟随配色方案切换。
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">

      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors"
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
            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold brand-text">
              小宋编导工作台
            </h1>
          </Link>
          <p className="text-muted-foreground">AI驱动的短视频脚本创作工具</p>
        </div>

        {/* Login Form */}
        <div className="glass-panel rounded-2xl p-8 shadow-xl">
          {/* 登录/注册切换 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                isLogin
                  ? "brand-gradient text-white shadow-lg"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
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
                  ? "brand-gradient text-white shadow-lg"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {/* 邮箱输入 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/25 focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                  className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/25 focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* 消息提示 */}
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                message.includes("成功")
                  ? "bg-emerald-500/15 dark:bg-green-900/30 text-green-500 dark:text-green-400 border border-green-500/50/25"
                  : "bg-destructive/15 dark:bg-red-900/30 text-destructive dark:text-red-400 border border-destructive/25"
              }`}>
                {message}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 btn-brand py-3.5 rounded-xl font-semibold disabled:cursor-not-allowed"
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
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "还没有账号？" : "已有账号？"}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              className="ml-1 text-primary hover:opacity-80 font-semibold transition-opacity"
            >
              {isLogin ? "立即注册" : "立即登录"}
            </button>
          </div>
        </div>

        {/* 功能亮点 */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="glass-panel text-center p-4 rounded-xl">
            <div className="text-3xl font-bold brand-text">8</div>
            <div className="text-xs text-muted-foreground mt-1">核心功能</div>
          </div>
          <div className="glass-panel text-center p-4 rounded-xl">
            <div className="text-3xl font-bold brand-text">10000+</div>
            <div className="text-xs text-muted-foreground mt-1">知识库</div>
          </div>
          <div className="glass-panel text-center p-4 rounded-xl">
            <div className="text-3xl font-bold brand-text">10秒</div>
            <div className="text-xs text-muted-foreground mt-1">生成脚本</div>
          </div>
        </div>

        {/* 底部链接 */}
        <div className="mt-6 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页了解更多
          </Link>
        </div>
      </div>
    </div>
  );
}
