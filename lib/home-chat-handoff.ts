/**
 * 工作台首页的大对话框 → 自由对话页（2026-11-02 产品方：首页优先展示自由对话，发出去后跳到自由对话页接着聊）。
 * 页面内跳转（router.push）不刷新，附件这类 File 对象放在内存里交过去；
 * 文字和联网设置另存一份到 sessionStorage，万一整页刷新了也能接上（附件就只能重新选）。
 * 自由对话页打开时取一次，取完就清掉，不会重复发送。
 */

export type WebMode = 'auto' | 'on' | 'off';

export interface HomeChatHandoff {
  text: string;
  webMode: WebMode;
  /** 点了「深度研究」：到自由对话页打开研究卡片、把问题填好，让编导选深度再开始（深度研究有单独的额度） */
  research: boolean;
  files: File[];
}

const KEY = 'kaiwu-home-chat';
/** 存下来超过这么久还没被取走，就当是过期的，不再自动发送 */
const MAX_AGE_MS = 5 * 60 * 1000;

let pending: HomeChatHandoff | null = null;

const isWebMode = (v: unknown): v is WebMode => v === 'auto' || v === 'on' || v === 'off';

export function putHomeChat(handoff: HomeChatHandoff): void {
  pending = handoff;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ text: handoff.text, webMode: handoff.webMode, research: handoff.research, at: Date.now() }));
  } catch { /* 存不了就只靠内存那份 */ }
}

export function takeHomeChat(now = Date.now()): HomeChatHandoff | null {
  const mem = pending;
  pending = null;
  let stored: { text?: unknown; webMode?: unknown; research?: unknown; at?: unknown } | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch { stored = null; }
  if (mem) return mem;
  if (!stored || typeof stored.text !== 'string' || typeof stored.at !== 'number' || now - stored.at > MAX_AGE_MS) return null;
  return { text: stored.text, webMode: isWebMode(stored.webMode) ? stored.webMode : 'auto', research: stored.research === true, files: [] };
}
