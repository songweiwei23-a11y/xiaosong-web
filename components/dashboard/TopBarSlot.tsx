"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 顶栏中间的空位（2026-10-04）。
 *
 * 电脑上顶栏 72px 高，中间一直空着。自由对话页的标题行（标题、记忆状态、同步、导出）
 * 原来单独占一行在顶栏下面，挤掉对话区 44px——现在放进这个空位，顶栏高度不变。
 * 页面用 <TopBarPortal> 占用它；占用时「进行中」的作品让出位置，不占用时由「进行中」用。
 * 只在电脑上显示（手机上顶栏左边是菜单按钮，「进行中」在第二行）。
 */
const SlotContext = createContext<{
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
  claimed: boolean;
  setClaimed: (v: boolean) => void;
}>({ el: null, setEl: () => {}, claimed: false, setClaimed: () => {} });

export function TopBarSlotProvider({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [claimed, setClaimed] = useState(false);
  return <SlotContext.Provider value={{ el, setEl, claimed, setClaimed }}>{children}</SlotContext.Provider>;
}

/** 空位是否已被页面占用（电脑上） */
export function useTopBarSlotClaimed() {
  return useContext(SlotContext).claimed;
}

/** 顶栏里的空位本身。没有页面占用时隐藏，不挡「进行中」 */
export function TopBarSlotTarget() {
  const { setEl, claimed } = useContext(SlotContext);
  return <div ref={setEl} className={claimed ? "hidden min-w-0 flex-1 items-center md:flex" : "hidden"} />;
}

/** 页面把内容放进顶栏空位 */
export function TopBarPortal({ children }: { children: React.ReactNode }) {
  const { el, setClaimed } = useContext(SlotContext);
  useEffect(() => {
    setClaimed(true);
    return () => setClaimed(false);
  }, [setClaimed]);
  return el ? createPortal(children, el) : null;
}
