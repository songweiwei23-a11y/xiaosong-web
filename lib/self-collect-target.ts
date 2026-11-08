/**
 * 插件采自己主页的结果交给谁（2026-11-08）：创作进度页上「诊断我的账号」和「月度复盘」都能让插件采自己的主页，
 * 插件采完把数据发给整页，两边都收得到。点按钮时记下是谁发起的，数据回来时只有发起的那一边接。
 * 记在 localStorage（插件采集时可能切到别的标签页再回来），30 分钟内有效；没记的（旧习惯、插件自己发起的）归诊断。
 */
export type SelfCollectTarget = 'diagnosis' | 'review';

const KEY = 'kaiwu-self-collect-target';
const TTL_MS = 30 * 60_000;
/** 自己主页链接（诊断和复盘共用一份） */
export const SELF_LINK_KEY = (pid: string) => `kaiwu-self-link:${pid}`;

export function wantSelfCollection(target: SelfCollectTarget, now = Date.now()): void {
  try { localStorage.setItem(KEY, JSON.stringify({ target, at: now })); } catch { /* 存不了就按默认归诊断 */ }
}

function current(now: number): SelfCollectTarget {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) as { target?: unknown; at?: unknown } : null;
    if (v && (v.target === 'review' || v.target === 'diagnosis') && typeof v.at === 'number' && now - v.at < TTL_MS) return v.target;
  } catch { /* 读不到按默认 */ }
  return 'diagnosis';
}

/**
 * 数据回来时：是交给我的返回 true。记号不在这里清——两边收到的是同一条消息，先认领的一边清掉的话，
 * 后收到的一边会读成默认值、跟着再跑一遍；记号到下次点按钮时换掉，或 30 分钟后失效
 */
export function claimSelfCollection(me: SelfCollectTarget, now = Date.now()): boolean {
  return current(now) === me;
}
