"use client";

import { useSyncExternalStore } from "react";

/**
 * 本机浏览器里的一个偏好（比如监控大屏的音量、投屏打码）。
 *
 * 为什么不用 useState + useEffect 去读 localStorage：那样要在 effect 里同步 setState，
 * 会多渲染一轮，React 的新规则也会警告。用 useSyncExternalStore 读外部存储，
 * 服务端渲染时用默认值，挂载后自动换成本机的值，不会出现水合不一致。
 *
 * 读写都容错：隐私模式或被禁用时 localStorage 会抛错，这时退回默认值，不影响页面。
 */

const listeners = new Set<() => void>();

function readRaw(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** 写入并通知所有订阅者（同一页面里的其它组件也会立刻拿到新值） */
export function writeLocalPref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 写不进去就只在本次页面里生效
  }
  listeners.forEach((l) => l());
}

export function useLocalPref(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readRaw(key, fallback),
    () => fallback
  );
  return [value, (next: string) => writeLocalPref(key, next)];
}
