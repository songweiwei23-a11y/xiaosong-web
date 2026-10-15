"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { postSafely } from "@/lib/safe-post";
import { supabase } from "@/lib/supabase/client";
import { LogOut, User as UserIcon } from "lucide-react";

export function UserProfile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // 退出后这台设备的首页通行也作废：再打开首页要重新凭邀请链接或门票进门
    await postSafely("/api/gate/logout", { method: "POST" }).catch(() => {});
    // 整页跳转（退出是安全动作，不沿用页面里登录后的缓存）：首页要由服务器重新判断，不能显示登录后的内容
    window.location.replace("/");
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      {/*
        点自己的名字进账户设置，是大多数人找"改密码/看会员"的第一反应。
        手机上只留图标：完整邮箱 + "退出"两个字 + 主题按钮 + 菜单按钮，一排放不下，顶栏会被挤变形
      */}
      <Link
        href="/dashboard/account"
        title="我的账户：会员状态、订单、修改密码"
        aria-label="我的账户"
        className="flex items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-muted sm:px-2 sm:py-1"
      >
        <UserIcon className="h-4 w-4 text-muted-foreground" />
        <span className="hidden max-w-[14rem] truncate text-foreground sm:inline">{user.email}</span>
      </Link>
      <button
        onClick={handleLogout}
        aria-label="退出登录"
        className="flex items-center gap-1 rounded-lg p-2 text-sm text-destructive transition-colors hover:bg-destructive/10 sm:px-3 sm:py-1.5"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">退出</span>
      </button>
    </div>
  );
}
