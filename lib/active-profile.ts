/**
 * 「当前在用哪个账号档案」的唯一入口。
 *
 * 【为什么要收拢】之前有三个地方往 localStorage.activeProfileId 写：
 * 侧边栏切换器、档案总览页、新建档案页。但只有侧边栏那个会广播
 * profileChanged 事件。结果是：从档案总览页切了账号，定位页和各创作板块
 * 收不到通知，界面上显示的档案和实际进提示词的档案会悄悄错开——
 * 而用户完全看不出来，只会觉得"AI 怎么答得不对"。
 *
 * 所以写入一律走 setActiveProfileId，它保证「写存储」和「通知别人」
 * 一起发生，不会漏掉其中一半。
 */

export const ACTIVE_PROFILE_KEY = 'activeProfileId';
export const PROFILE_CHANGED = 'profileChanged';

/** 服务端渲染时没有 localStorage，取不到就是 null */
export function getActiveProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    // 隐私模式下 localStorage 可能直接抛错
    return null;
  }
}

/**
 * 切换当前档案。detail 传完整档案对象时，监听方可以直接用，不必再查一次。
 * 传 null 表示"没有选中任何档案"。
 */
export function setActiveProfileId(id: string | null, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {
    // 存不进去也要把事件发出去，本次会话内至少是一致的
  }
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED, { detail: detail ?? id }));
}

/** 订阅档案切换，返回取消订阅的函数（给 useEffect 直接 return 用） */
export function onActiveProfileChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PROFILE_CHANGED, handler);
  return () => window.removeEventListener(PROFILE_CHANGED, handler);
}
