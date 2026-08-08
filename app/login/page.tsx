"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LogIn, Mail, Lock, Sparkles } from "lucide-react";

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
        
        setMessage("登录成功！");
        router.push("/dashboard");
        router.refresh();
      } else {
        // 注册 - 禁用邮箱验证,直接创建账号
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

        // 检查用户是否需要邮箱验证
        if (data?.user?.identities?.length === 0) {
          setMessage("该邮箱已注册，请直接登录。");
        } else {
          setMessage("注册成功！请切换到登录标签页进行登录。");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setMessage(error.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">小宋编导工作台</h1>
          </div>
          <p className="text-muted-foreground">AI驱动的短视频脚本创作工具</p>
        </div>

        {/* Login Form */}
        <div className="bg-card rounded-2xl shadow-xl p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                isLogin
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setMessage("");
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                !isLogin
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

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
                  placeholder="········"
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes("成功")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                "处理中..."
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {isLogin ? "登录" : "注册"}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "还没有账号？" : "已有账号？"}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              {isLogin ? "立即注册" : "立即登录"}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">8</div>
            <div className="text-xs text-muted-foreground mt-1">核心功能</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">100+</div>
            <div className="text-xs text-muted-foreground mt-1">功能选项</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">3秒</div>
            <div className="text-xs text-muted-foreground mt-1">生成脚本</div>
          </div>
        </div>
      </div>
    </div>
  );
}


