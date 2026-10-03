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

// 存储被浏览器禁止时仍保留本次页面会话的选择。否则切换器收到广播后
// 再次读到 null，会重复选第一个档案、广播、请求接口，形成循环。
let memoryProfileId: string | null = null;
let useMemoryProfile = false;

/** 服务端没有当前浏览器档案；浏览器存储不可用时读本次会话的选择。 */
export function getActiveProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  if (useMemoryProfile) return memoryProfileId;
  try {
    memoryProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return memoryProfileId;
  } catch {
    useMemoryProfile = true;
    return memoryProfileId;
  }
}

/**
 * 切换当前档案。detail 传完整档案对象时，监听方可以直接用，不必再查一次。
 * 传 null 表示"没有选中任何档案"。
 */
export function setActiveProfileId(id: string | null, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  const nextId = id || null;
  const previousId = getActiveProfileId();
  memoryProfileId = nextId;
  try {
    if (nextId) localStorage.setItem(ACTIVE_PROFILE_KEY, nextId);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
    useMemoryProfile = false;
  } catch {
    useMemoryProfile = true;
  }
  // 同一个选择无需重复加载；携带详情可能是编辑后的新档案，仍须通知。
  if (previousId === nextId && detail === undefined) return;
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED, { detail: detail ?? nextId }));
}

/** 订阅档案切换，返回取消订阅的函数（给 useEffect 直接 return 用） */
export function onActiveProfileChange(handler: (event: Event) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PROFILE_CHANGED, handler);
  return () => window.removeEventListener(PROFILE_CHANGED, handler);
}
