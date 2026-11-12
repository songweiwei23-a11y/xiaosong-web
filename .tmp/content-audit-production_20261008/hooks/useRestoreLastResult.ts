"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { workIdFromUrl } from "@/lib/resume";
import { hasPendingHandoff } from '@/lib/handoff';
import { usePathname } from 'next/navigation';

/**
 * 把云端最近一条生成结果回填到页面的结果区。
 *
 * 解决的问题：生成出来的正文只存在组件 state 里，切到别的页面再切回来
 * （组件被卸载重建）或刷新页面，界面就空了，用户以为内容丢了——其实一直
 * 在云端历史里，只是没被取回来显示。
 *
 * 两条保护：
 * - 用函数式更新且仅在当前为空时写入，不会覆盖用户正在看或刚生成的内容；
 * - 依赖只放 lastResult，历史列表的后续刷新不会反复触发回填。
 */
export function useRestoreLastResult(
  lastResult: string,
  setResult: Dispatch<SetStateAction<string>>,
  resultScope?: string,
  onScopeChange?: () => void
) {
  const previousScope = useRef<string>();
  // 客户端导航渲染时地址栏可能还没更新，使用新组件对应的路由。
  const pathname = usePathname();
  const incomingCreation = useRef(hasPendingHandoff(pathname || undefined));
  useEffect(() => {
    if (resultScope && previousScope.current !== resultScope) {
      const changed = previousScope.current !== undefined;
      previousScope.current = resultScope;
      if (changed) {
        incomingCreation.current = false;
        onScopeChange?.();
        setResult('');
        return; // 本次 lastResult 仍可能是上一档案的，等新历史到达
      }
    }
    if (!lastResult) return;
    if (incomingCreation.current) return;
    /*
     * 地址上带了 ?work= 时让路：用户要看的是那一个作品，内容由 useWorkResume 填。
     * 不让的话，打开作品 A 的分镜页、而 A 还没做分镜时，这里会把
     * "最近一条分镜"（多半是别的作品的）塞进来——看起来像是 A 的。
     */
    if (workIdFromUrl()) return;
    setResult((current) => current || lastResult);
  }, [lastResult, setResult, resultScope, onScopeChange]);
}
