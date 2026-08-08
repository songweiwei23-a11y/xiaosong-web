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

  if (loggedIn) {
    return (
      <Link href="/dashboard" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all">
        进入工作台
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className="text-muted-foreground hover:text-blue-600 transition-colors">
        登录
      </Link>
      <Link href="/login?redirect=/dashboard" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all">
        免费试用
      </Link>
    </>
  );
}
