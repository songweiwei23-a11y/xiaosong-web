"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CreatorContext, CreatorProfile } from "@/lib/creator-context";
import { getActiveProfileId, onActiveProfileChange } from "@/lib/active-profile";
import { BRIEF_TYPE } from "@/lib/creative-brief";
import { ADVICE_TYPE, staleUpstream } from "@/lib/industry-advice";
import { fetchActivePreset } from "@/lib/creator-presets";
import { fetchActivePreferences } from "@/lib/preferences-client";

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
let cacheVersion = 0;
const CONTEXT_CHANGED = 'creatorContextChanged';
let lastClearedEvent: Event | undefined;

const EMPTY: CreatorContext = { profile: null, positioning: null, dealReasons: [] };

async function fetchContext(profileId: string | null): Promise<CreatorContext> {
  const key = profileId ?? "__none__";
  const hit = cache.get(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;
  const version = cacheVersion;

  const task = (async (): Promise<CreatorContext> => {
    // 三个来源互不依赖，并行拉。任何一个失败都不该让整块上下文消失——
    // 有档案没定位，照样比什么都没有强
    const [profileRes, posRes, dealRes0, briefRes, adviceRes, contentRes, businessRes] = await Promise.all([
      fetch("/api/profiles").catch(() => null),
      // 只要六维地基。内容定位、商业定位不在这里取：只给声明了 deep 的板块（见下面和 lib/context-manifest）
      fetch("/api/positioning?type=" + encodeURIComponent("账号定位")).catch(() => null),
      // 成交理由按档案分别存（2026-09-30）：知道是哪个档案就一起并行拉
      profileId ? fetch(`/api/deal-reasons?profileId=${encodeURIComponent(profileId)}`).catch(() => null) : Promise.resolve(null),
      // 创作简报：有它就优先用它，它是按板块切好片的，比截断定位原文有用得多
      fetch("/api/positioning?type=" + encodeURIComponent(BRIEF_TYPE)).catch(() => null),
      // 行业建议（药方）：当前阶段的打法，所有创作板块都照它执行（见 lib/industry-advice）
      fetch("/api/positioning?type=" + encodeURIComponent(ADVICE_TYPE)).catch(() => null),
      // 内容定位（系列清单）、商业定位（成交路径）：选题、方向、脚本按清单取用
      fetch("/api/positioning?type=" + encodeURIComponent("内容定位")).catch(() => null),
      fetch("/api/positioning?type=" + encodeURIComponent("商业定位")).catch(() => null),
    ]);

    let profile: CreatorProfile | null = null;
    if (profileRes?.ok) {
      const list = await profileRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        profile = (profileId && list.find((p: CreatorProfile) => p.id === profileId)) || list[0];
      }
    }

    let positioning: CreatorContext["positioning"] = null;
    let positioningAt: string | null = null;
    if (posRes?.ok) {
      const list = await posRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        /*
         * 只取这个档案自己的定位；没有就只退回"没挂任何档案"的老数据。
         * 原来退回的是"最新的一份"——一个号没做定位，就拿另一个号的定位顶上，
         * 各板块照着别的店的方向写，用户完全看不出来（产品方要求一切以当前档案为准，2026-09-30）
         */
        const own = profile ? list.find((x: any) => x.profile_id === profile!.id) : null;
        const pick = own || list.find((x: any) => !x.profile_id) || null;
        if (pick) {
          positioning = {
            name: pick.positioning_name || "账号定位",
            summary: pick.strategy_summary || pick.full_content || "",
            full: pick.full_content || pick.strategy_summary || "",
          };
          positioningAt = pick.created_at || null;
        }
      }
    }

    // 内容定位、商业定位：同样只取这个档案自己的那份（没有才退回没挂档案的老数据）
    type PositioningRow = { profile_id?: string | null; full_content?: string | null; strategy_summary?: string | null; created_at?: string | null };
    const pickOwnPositioning = async (res: Response | null): Promise<PositioningRow | null> => {
      if (!res?.ok) return null;
      const list = (await res.json().catch(() => null)) as PositioningRow[] | null;
      if (!Array.isArray(list) || list.length === 0) return null;
      return (profile ? list.find((x) => x.profile_id === profile!.id) : null) || list.find((x) => !x.profile_id) || null;
    };
    const contentPick = await pickOwnPositioning(contentRes);
    const businessPick = await pickOwnPositioning(businessRes);
    const contentPositioning: string | null = contentPick?.full_content || contentPick?.strategy_summary || null;
    const businessPositioning: string | null = businessPick?.full_content || businessPick?.strategy_summary || null;

    // 没记着当前档案、或记着的已经删了（用的是列表第一个）：档案定下来之后再按它取成交理由
    const dealRes = profile && profile.id !== profileId
      ? await fetch(`/api/deal-reasons?profileId=${encodeURIComponent(profile.id)}`).catch(() => null)
      : dealRes0;
    let dealReasons: string[] = [];
    if (dealRes?.ok) {
      const d = await dealRes.json().catch(() => null);
      if (Array.isArray(d?.reasons)) dealReasons = d.reasons.filter(Boolean);
    }

    let brief: string | null = null;
    let briefAt: string | null = null;
    let briefFacts: string | null = null;
    if (briefRes?.ok) {
      const list = await briefRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        // 取这个档案自己的那份（接口已按 created_at 倒序）；同上，不拿别的档案的顶上
        const own = profile ? list.find((x: any) => x.profile_id === profile!.id) : null;
        const pick = own || list.find((x: any) => !x.profile_id);
        brief = pick?.full_content || null;
        briefAt = pick?.updated_at || pick?.created_at || null;
        briefFacts = typeof pick?.positioning_description === 'string' ? pick.positioning_description : null;
      }
    }

    let advice: string | null = null;
    let adviceAt: string | null = null;
    if (adviceRes?.ok) {
      const list = await adviceRes.json().catch(() => null);
      if (Array.isArray(list) && list.length > 0) {
        const own = profile ? list.find((x: any) => x.profile_id === profile!.id) : null;
        advice = own?.full_content || null;
        adviceAt = own?.created_at || null;
      }
    }
    // 药方之后上游又更新过（账号定位、内容定位、商业定位任一）：药方要提示先复诊，不静默沿用
    const adviceStale = advice
      ? staleUpstream(adviceAt, [
          { name: "账号定位", at: positioningAt },
          { name: "内容定位", at: contentPick?.created_at ?? null },
          { name: "商业定位", at: businessPick?.created_at ?? null },
        ])
      : [];

    // 数据回流（lib/performance）：这个号录了数据的作品汇总，选题、方向、起号、自由对话会参考
    let performance: CreatorContext["performance"] = null;
    if (profile) {
      const perfRes = await fetch(`/api/works/performance?profileId=${encodeURIComponent(profile.id)}`).catch(() => null);
      if (perfRes?.ok) {
        const d = await perfRes.json().catch(() => null);
        if (d && typeof d.count === "number" && d.count > 0) performance = d;
      }
    }

    // 风格预设（lib/creator-presets）：这个档案在用的那份；没有或表没建都当没有，不挡生成
    const preset = await fetchActivePreset(profile?.id ?? profileId);
    // 我的创作偏好（lib/preferences）：学习开着时生效的那几条；读不到当没有，不挡生成
    const preferences = await fetchActivePreferences(profile?.id ?? profileId);

    const ctx: CreatorContext = {
      profile, positioning, dealReasons, brief, briefAt, briefFacts, performance, preset, preferences,
      advice, adviceAt, adviceStale, contentPositioning, businessPositioning,
    };
    if (version === cacheVersion) cache.set(key, ctx);
    return ctx;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    if (inflight.get(key) === task) inflight.delete(key);
  }
}

export function useCreatorContext() {
  const [context, setContext] = useState<CreatorContext>(EMPTY);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const id = getActiveProfileId();
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const next = await fetchContext(id);
      if (request === requestRef.current) setContext(next);
    } catch {
      // 上下文是增强项，取不到就按没有处理，不该挡住用户生成
      if (request === requestRef.current) setContext(EMPTY);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // 侧边栏切换档案时立刻跟着换，不用刷新页面
    const unsubscribe = onActiveProfileChange((event) => {
      // 多个使用方订阅的是同一次切换，只清一次，后续请求才能合并。
      if (lastClearedEvent !== event) {
        lastClearedEvent = event;
        clearContextCache();
      }
      load();
    });
    window.addEventListener(CONTEXT_CHANGED, load);
    return () => {
      ++requestRef.current;
      unsubscribe();
      window.removeEventListener(CONTEXT_CHANGED, load);
    };
  }, [load]);

  return { context, loading, reload: load };
}

/** 档案被编辑后调用，让下次取到的是新内容 */
export function invalidateCreatorContext() {
  clearContextCache();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONTEXT_CHANGED));
}

function clearContextCache() {
  ++cacheVersion;
  cache.clear();
  inflight.clear();
}
