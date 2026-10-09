"use client";

/**
 * 首页辅助区（时钟待办白噪音、新手课、7 天起号计划）收没收起：按登录账号分开记（2026-10-03）。
 *
 * 原来记在本机的一个公共键上：同一台电脑换个账号登录，上一个人收起的，下一个人也看不到。
 * 现在键里带账号 id；第一次读到某个账号时，沿用旧的公共键（老用户收起过的保持收起），之后各记各的。
 * 只记在本机浏览器里——换设备不跟着走，界面上也不这么说。
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type HomeSection = 'today' | 'course' | 'launchPlan';

/** 改版前各卡片自己用的公共键 */
const LEGACY_KEYS: Partial<Record<HomeSection, string>> = {
  course: 'kaiwu:course-card-collapsed',
  launchPlan: 'kaiwu:launch-plan-collapsed',
};

export const homePrefKey = (userId: string, section: HomeSection) => `kaiwu:home-collapsed:${section}:${userId}`;

/** 读：'1' 收起 / '0' 展开 / null 没记过（调用方用默认值） */
export function readCollapsed(userId: string, section: HomeSection): boolean | null {
  try {
    const own = localStorage.getItem(homePrefKey(userId, section));
    if (own !== null) return own === '1';
    const legacy = LEGACY_KEYS[section] ? localStorage.getItem(LEGACY_KEYS[section]!) : null;
    return legacy === null ? null : legacy === '1';
  } catch {
    return null;
  }
}

export function writeCollapsed(userId: string, section: HomeSection, collapsed: boolean) {
  try { localStorage.setItem(homePrefKey(userId, section), collapsed ? '1' : '0'); } catch { /* 存不了就只在这次页面里有效 */ }
}

/** 当前登录账号 id；还没读到是 undefined，没登录是 null。换账号登录时跟着变 */
export function useAccountId(): string | null | undefined {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setId(data.session?.user.id ?? null); }).catch(() => { if (alive) setId(null); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setId(session?.user.id ?? null));
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return id;
}

/**
 * 一个辅助区的收起状态。账号没读到之前返回 null（先不渲染，免得先展开再收起闪一下）。
 * fallback：这个账号没记过时的默认值。
 */
export function useCollapsed(section: HomeSection, fallback: boolean | null): [boolean | null, () => void] {
  const userId = useAccountId();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  useEffect(() => {
    if (userId === undefined || fallback === null) return;
    setCollapsed(userId ? readCollapsed(userId, section) ?? fallback : fallback);
  }, [userId, section, fallback]);
  const toggle = () => setCollapsed((c) => {
    const next = !c;
    if (userId) writeCollapsed(userId, section, next);
    return next;
  });
  return [collapsed, toggle];
}
