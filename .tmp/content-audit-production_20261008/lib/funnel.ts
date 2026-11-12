/**
 * 转化漏斗：首页来了多少人 → 试了多少 → 打开注册页多少 → 注册多少 → 出了第一条多少 → 付费多少。
 *
 * 不看这个，每次改首页、改引导都是凭感觉——改完到底有没有用，没人知道。
 *
 * 前三步访客还没登录，记匿名事件（funnel_events）：只有一个随机的访客编号，
 * 不记 IP、不记任何个人信息；同一个访客同一种事件一天只记一次。
 * 后三步按"这段时间里注册的人"算（同一批人往下走了多少），数据来自已有的表：
 * 注册 = 账号创建时间，出第一条 = usage_events，付费 = 审核通过的订单。
 */

export const FUNNEL_KINDS = ['landing_view', 'landing_try', 'register_view'] as const;
export type FunnelKind = (typeof FUNNEL_KINDS)[number];

export function isFunnelKind(v: unknown): v is FunnelKind {
  return typeof v === 'string' && (FUNNEL_KINDS as readonly string[]).includes(v);
}

/** 访客编号：随机、只存在本机，看不出是谁 */
export const VISITOR_RE = /^[a-z0-9-]{8,64}$/;

const VID_KEY = 'kaiwu:vid';
const inFlight = new Set<string>();

function visitorId(): string | null {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v || !VISITOR_RE.test(v)) {
      v = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).toLowerCase();
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    // 本机存不了（隐私模式等）：这个人就不计入，不影响他用
    return null;
  }
}

/** 记一次。同一访客同一事件同一天只发一次；发不出去就算了，绝不影响页面 */
export function track(kind: FunnelKind) {
  if (typeof window === 'undefined') return;
  const vid = visitorId();
  if (!vid) return;
  const day = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const key = `kaiwu:f:${kind}:${day}`;
  try {
    if (localStorage.getItem(key) || inFlight.has(key)) return;
  } catch {
    return;
  }
  const body = JSON.stringify({ kind, vid });
  inFlight.add(key);
  fetch('/api/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    .then((response) => {
      if (response.status === 204) {
        try { localStorage.setItem(key, '1'); } catch {}
      }
    })
    .catch(() => {})
    .finally(() => inFlight.delete(key));
}

export interface FunnelCounts {
  landing_view: number;
  landing_try: number;
  register_view: number;
  signup: number;
  activated: number;
  paid: number;
}

export interface FunnelStep {
  key: keyof FunnelCounts;
  label: string;
  count: number;
  /** 占上一步的百分比（第一步为 null） */
  fromPrev: number | null;
}

export const FUNNEL_LABELS: Record<keyof FunnelCounts, string> = {
  landing_view: '打开首页',
  landing_try: '在首页试了一下',
  register_view: '打开注册页',
  signup: '注册成功',
  activated: '出了第一条',
  paid: '付费',
};

/** 拼成一步一步的漏斗；上一步是 0 时比例给 null，不出 NaN、不出 Infinity */
export function buildFunnel(c: FunnelCounts): FunnelStep[] {
  const keys = Object.keys(FUNNEL_LABELS) as (keyof FunnelCounts)[];
  return keys.map((key, i) => {
    const count = Math.max(0, Math.round(Number(c[key]) || 0));
    const prev = i === 0 ? null : Math.max(0, Math.round(Number(c[keys[i - 1]]) || 0));
    return {
      key,
      label: FUNNEL_LABELS[key],
      count,
      fromPrev: prev === null || prev === 0 ? null : Math.round((count / prev) * 100),
    };
  });
}
