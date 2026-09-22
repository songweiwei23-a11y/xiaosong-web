"use client";

import { useState, useEffect, useCallback } from "react";
import type { CreatorContext, CreatorProfile } from "@/lib/creator-context";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { BRIEF_TYPE } from "@/lib/creative-brief";

/**
 * 取当前账号的创作上下文：档案 + 定位 + 成交理由。
 *
 * 【一个事实源】以侧边栏那个档案切换器写的 localStorage.activeProfileId 为准。
 * 在此之前，选题页和脚本页各有一套自己的档案下拉框，跟侧边栏互不相干——
 * 在选题页选了 A 号，切到分镜可能还是 B 号，而用户完全看不出来。
 *
 * 【缓存】三个板块来回切换时不该每次都重新拉一遍。按档案 id 缓存在模块作用域，
 * 切换档案（profileChanged 事件）时作废。这个缓存只活在当前页面会话里，
 * 刷新就没了，所以不存在「改了档案还显示旧的」的问题。
 */

const cache = new Map<string, CreatorContext>();
/** 同一个档案的并发请求合并成一次，避免三个板块同时挂载时打三遍接口 */
const inflight = new Map<string, Promise<CreatorContext>>();

const EMPTY: CreatorContext = { profile: null, positioning: null, dealReasons: [] };

async function fetchContext(profileId: string | null): Promise<CreatorContext> {
  const key = profileId ?? "__none__";
  const hit = cache.get(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;

  const task = (async (): Promise<CreatorContext> => {
    // 三个来源互不依赖，并行拉。任何一个失败都不该让整块上下文消失——
    // 有档案没定位，照样比什么都没有强
    const [profileRes, posRes, dealRes, briefRes] = await Promise.all([
      fetch("/api/profiles").catch(() => null),
      // 只要六维地基。商业定位和内容定位是它的深挖，拿来当"账号方向"会跑偏
      fetch("/api/positioning?type=" + encodeURIComponent("账号定位")).catch(() => null),
      fetch("/api/deal-reasons").catch(() => null),
      // 创作简报：有它就优先用它，它是按板块切好片的，比截断定位原文有用得多
      fetch("/api/positioning?type=" + encodeURIComponent(BRIEF_TYPE)).catch(() => null),
    ]);

    let profile: CreatorProfile | null = null;
    if (profileRes?.ok) {
      const list = await profileRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        profile = (profileId && list.find((p: CreatorProfile) => p.id === profileId)) || list[0];
      }
    }

    let positioning: CreatorContext["positioning"] = null;
    if (posRes?.ok) {
      const list = await posRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        // 优先取这个档案自己的定位；没有就退回最新的一份，
        // 总比让选题完全不知道账号方向强
        const own = profile ? list.find((x: any) => x.profile_id === profile!.id) : null;
        const pick = own || list[0];
        if (pick) {
          positioning = {
            name: pick.positioning_name || "账号定位",
            summary: pick.strategy_summary || pick.full_content || "",
            full: pick.full_content || pick.strategy_summary || "",
          };
        }
      }
    }

    let dealReasons: string[] = [];
    if (dealRes?.ok) {
      const d = await dealRes.json().catch(() => null);
      if (Array.isArray(d?.reasons)) dealReasons = d.reasons.filter(Boolean);
    }

    let brief: string | null = null;
    if (briefRes?.ok) {
      const list = await briefRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        // 取这个档案自己的那份；接口已按 created_at 倒序，[0] 就是最新的
        const own = profile ? list.find((x: any) => x.profile_id === profile!.id) : null;
        brief = (own || list[0])?.full_content || null;
      }
    }

    const ctx: CreatorContext = { profile, positioning, dealReasons, brief };
    cache.set(key, ctx);
    return ctx;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export function useCreatorContext() {
  const [context, setContext] = useState<CreatorContext>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const id = getActiveProfileId();
    setLoading(true);
    try {
      setContext(await fetchContext(id));
    } catch {
      // 上下文是增强项，取不到就按没有处理，不该挡住用户生成
      setContext(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // 侧边栏切换档案时立刻跟着换，不用刷新页面
    return onActiveProfileChange(() => {
      cache.clear();
      load();
    });
  }, [load]);

  return { context, loading, reload: load };
}

/** 档案被编辑后调用，让下次取到的是新内容 */
export function invalidateCreatorContext() {
  cache.clear();
}
