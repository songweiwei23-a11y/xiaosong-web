"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

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
  setResult: Dispatch<SetStateAction<string>>
) {
  useEffect(() => {
    if (!lastResult) return;
    setResult((current) => current || lastResult);
  }, [lastResult, setResult]);
}
