"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LogOut, User as UserIcon } from "lucide-react";

export function UserProfile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <UserIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground">{user.email}</span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        退出
      </button>
    </div>
  );
}
