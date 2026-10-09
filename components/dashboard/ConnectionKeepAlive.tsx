"use client";

import { useEffect } from "react";

/** 页面开着、在前台时多久打一次保活 */
export const KEEP_ALIVE_MS = 25_000;

/**
 * 连接保活（2026-10-05）：工作台开着时每 25 秒打一下 /api/public/ping，切回这个标签页时马上打一下。
 *
 * 线上：用户走代理的线路上，页面闲几分钟后浏览器手里的空闲连接会被悄悄掐掉，
 * 接着点「带去下一步」「保存」，请求拿死连接去发，一个都到不了服务器，页面只能报网络断了
 * （自动重发也赶不上：死连接有好几条，要一条条试掉）。浏览器优先复用最近用过的连接，
 * 一直有一条在用，它就不会被掐，真正的请求复用它就能发出去。
 * 只在页面可见时打，后台标签页不打。
 */
export function ConnectionKeepAlive() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/public/ping", { cache: "no-store" }).catch(() => {});
    };
    const timer = window.setInterval(ping, KEEP_ALIVE_MS);
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", ping);
    window.addEventListener("online", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", ping);
      window.removeEventListener("online", ping);
    };
  }, []);
  return null;
}
