"use client";

import { useEffect, useState } from "react";

/**
 * 当前账号是不是代理（2026-10-28）。null = 还在查（查的时候菜单和横幅都先不显示，免得闪一下）。
 * 同一个页面里头像菜单和首页横幅都要用，只查一次；查失败按「不是代理」处理。
 */
export interface AgentStatus { isAgent: boolean; displayName?: string }

let pending: Promise<AgentStatus> | null = null;

function loadAgentStatus(): Promise<AgentStatus> {
  pending ??= fetch("/api/agent/me")
    .then((r) => (r.ok ? r.json() : { isAgent: false }))
    .then((d: AgentStatus) => ({ isAgent: d?.isAgent === true, displayName: d?.displayName }))
    .catch(() => ({ isAgent: false }));
  return pending;
}

export function useAgentStatus(): AgentStatus | null {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void loadAgentStatus().then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);
  return status;
}
