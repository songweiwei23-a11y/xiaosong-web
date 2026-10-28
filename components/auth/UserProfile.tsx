"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { postSafely } from "@/lib/safe-post";
import { supabase } from "@/lib/supabase/client";
import { Briefcase, ChevronDown, Crown, LogOut, User as UserIcon, UserCog } from "lucide-react";
import { useAgentStatus } from "@/components/agent/useAgentStatus";

/*
 * 顶栏右上角的头像菜单（2026-10-28 改成下拉）：我的账户、会员中心、代理后台（只有代理看得到）、退出登录。
 * 代理后台和管理后台是两回事：代理只能进 /dashboard/agent，看自己的邀请码、客户和分成。
 */
export function UserProfile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const agent = useAgentStatus();

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

  // 点菜单外面、按 Esc 都收起来
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted";

  return (
    <div ref={boxRef} className="relative">
      {/* 手机上只留图标：完整邮箱放不下，顶栏会被挤变形 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="账户菜单"
        title="我的账户、会员中心、退出登录"
        className="flex items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-muted sm:px-2 sm:py-1"
      >
        <UserIcon className="h-4 w-4 text-muted-foreground" />
        <span className="hidden max-w-[14rem] truncate text-foreground sm:inline">{user.email}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <Link role="menuitem" href="/dashboard/account" onClick={() => setOpen(false)} className={item}>
            <UserCog className="h-4 w-4 text-muted-foreground" /> 我的账户
          </Link>
          <Link role="menuitem" href="/dashboard/membership" onClick={() => setOpen(false)} className={item}>
            <Crown className="h-4 w-4 text-muted-foreground" /> 会员中心
          </Link>
          {agent?.isAgent && (
            <Link role="menuitem" href="/dashboard/agent" onClick={() => setOpen(false)} className={item}>
              <Briefcase className="h-4 w-4 text-muted-foreground" /> 代理后台
            </Link>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            title="退出后，这台电脑再打开首页要重新凭邀请链接或门票进门"
            className={`${item} text-destructive hover:bg-destructive/10`}
          >
            <LogOut className="h-4 w-4" /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}
