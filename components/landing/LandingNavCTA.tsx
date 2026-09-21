"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function LandingNavCTA() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  if (loggedIn === null) {
    // 加载中状态
    return (
      <div className="flex items-center gap-3">
        <div className="w-16 h-9 bg-muted dark:bg-muted animate-pulse rounded-full" />
        <div className="w-24 h-9 bg-muted dark:bg-muted animate-pulse rounded-full" />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <Link 
        href="/dashboard" 
        className="brand-gradient text-white px-6 py-2.5 rounded-full hover:shadow-lg hover:scale-105 transition-all font-medium"
      >
        进入工作台
      </Link>
    );
  }

  return (
    <>
      <Link 
        href="/login" 
        className="text-foreground/80 hover:text-primary transition-colors font-medium"
      >
        登录
      </Link>
      <Link 
        href="/login" 
        className="brand-gradient text-white px-6 py-2.5 rounded-full hover:shadow-lg hover:scale-105 transition-all font-medium"
      >
        免费试用
      </Link>
    </>
  );
}
