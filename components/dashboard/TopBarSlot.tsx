"use client";

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 顶栏左边的空位（2026-10-04）。
 *
 * 电脑上顶栏 72px 高，右边是白噪音、主题、账号，左边一直空着。自由对话页的标题行（标题、记忆状态、同步、导出）
 * 原来单独占一行在顶栏下面，挤掉对话区 44px——现在放进这个空位，顶栏高度不变。
 * 页面用 <TopBarPortal> 把内容放进来；不用的页面这里就是空的，和原来一样。只在电脑上显示（手机上顶栏左边是菜单按钮）。
 */
const SlotContext = createContext<{ el: HTMLElement | null; setEl: (el: HTMLElement | null) => void }>({ el: null, setEl: () => {} });

export function TopBarSlotProvider({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ el, setEl }}>{children}</SlotContext.Provider>;
}

/** 顶栏里的空位本身 */
export function TopBarSlotTarget() {
  const { setEl } = useContext(SlotContext);
  return <div ref={setEl} className="hidden min-w-0 flex-1 items-center md:flex" />;
}

/** 页面把内容放进顶栏空位 */
export function TopBarPortal({ children }: { children: React.ReactNode }) {
  const { el } = useContext(SlotContext);
  return el ? createPortal(children, el) : null;
}
