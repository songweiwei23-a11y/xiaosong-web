"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_BUILD, PRESENCE_HEARTBEAT_MS } from "@/lib/presence";

/**
 * 在线心跳（见 lib/presence）：工作台页面在前台时，每 30 秒告诉服务器「还在用」，切换页面时马上补一次。
 * 后台标签页不发，所以切走的人会在 90 秒内变成离线。失败不提示，下一次心跳再试。
 */
export function PresenceBeat() {
  const pathname = usePathname();
  // 服务器已经是新版本，而这个页面还是旧代码：提醒刷新（只提醒，不自动刷新，免得打断正在写的内容）
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname, build: APP_BUILD }),
        cache: "no-store",
        keepalive: true,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { build?: string } | null) => {
          if (d?.build && d.build !== APP_BUILD) setStale(true);
        })
        .catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [pathname]);
  if (!stale) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-2.5 text-[13px] text-foreground shadow-lg">
      <span>开物已更新到新版本，刷新页面即可用上新功能。</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="brand-gradient rounded-lg px-3 py-1 text-[12.5px] font-medium text-white"
      >
        刷新页面
      </button>
    </div>
  );
}
