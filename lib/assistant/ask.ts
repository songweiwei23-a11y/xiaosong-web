/**
 * 首页顶部的一句话条和右下角的助理之间的通道：把一句话交给助理，助理打开面板并直接执行。
 * 只在浏览器里用（页面上的组件之间通信），所以这里不引用任何服务端的东西。
 */
export const ASSISTANT_ASK_EVENT = "kaiwu:assistant-ask";

export function askAssistant(message: string): void {
  const text = message.trim();
  if (!text || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ message: string }>(ASSISTANT_ASK_EVENT, { detail: { message: text } }));
}
