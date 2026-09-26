"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** 手机宽度（小于 640px）。首屏先当电脑，挂载后再按真实宽度切，避免水合不一致 */
export function useIsMobile(query = "(max-width: 639px)") {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return mobile;
}

/**
 * 弹出面板：电脑上挂在按钮下面，手机上从屏幕底部升起。
 *
 * 【为什么手机上要换样子】挂在按钮下面的小浮层到了手机上两头出问题：
 *   - 按钮被挤到左边时，以按钮右缘为基准往左展开的面板，大半截伸到屏幕外（首页切换档案）；
 *   - 面板比屏幕高时，它自己不能滚，下半截够不着，在上面划动的是后面的页面（外观设置）。
 * 底部面板占满宽度、限高、自己能滚，点背后的遮罩关闭——手机 App 的习惯做法。
 *
 * 【为什么用 portal】顶栏是毛玻璃（backdrop-filter），它会让里面的 fixed 元素
 * 相对顶栏定位而不是相对屏幕。面板挂到 body 上才能真正贴着屏幕底。
 *
 * panelRef：调用方"点外面关闭"要把它也算作"里面"——手机上面板不在按钮那棵 DOM 树里。
 */
export function AdaptivePopover({
  open,
  onClose,
  desktopClassName,
  title,
  panelRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** 电脑上浮层的定位和外观，如 "glass absolute right-0 top-11 z-50 w-[272px] rounded-2xl p-3 shadow-2xl" */
  desktopClassName: string;
  /** 手机底部面板顶上的标题 */
  title?: string;
  panelRef?: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  const mobile = useIsMobile();

  // 手机上面板开着时，后面的页面别跟着滚
  useEffect(() => {
    if (!open || !mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mobile]);

  if (!open) return null;

  if (!mobile) {
    return (
      <div ref={panelRef} className={desktopClassName}>
        {children}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur-xl"
      >
        {/* 顶上的小横条：提示这是可以关掉的面板 */}
        <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-foreground/20" aria-hidden />
        {title && <p className="mb-3 px-1 text-[15px] font-semibold text-foreground">{title}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}
