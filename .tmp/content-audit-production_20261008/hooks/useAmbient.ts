"use client";

import { useSyncExternalStore } from "react";
import { getServerState, getState, subscribe } from "@/lib/ambient/engine";

/** 白噪音播放器的状态。首页面板和顶栏小条读的是同一个播放器 */
export function useAmbient() {
  return useSyncExternalStore(subscribe, getState, getServerState);
}
