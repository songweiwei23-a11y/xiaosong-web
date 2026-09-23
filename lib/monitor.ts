/**
 * 实时监控大屏的纯逻辑。
 *
 * 全部做成不依赖网络和数据库的纯函数，原因有两个：
 *   1. 大屏上的每个数字都要经得起问「这是怎么算出来的」，
 *      算法藏在接口里没法单测，出了偏差只能靠肉眼看。
 *   2. 声音提醒靠的是「这条事件是不是新的」，这个判断错一次，
 *      要么该响的不响，要么每次轮询都把同一条事件再响一遍。
 */

/** 多久没动静就算离线 */
export const ONLINE_WINDOW_MIN = 15;

export type MonitorEventType = 'usage' | 'signup' | 'order' | 'order_proof';

export interface MonitorEvent {
  /** 稳定且唯一：同一条事件在多次轮询里必须是同一个 id，否则会重复响铃 */
  id: string;
  type: MonitorEventType;
  /** ISO 时间 */
  at: string;
  title: string;
  detail: string;
  /** 越高越需要人立刻处理，决定用哪种提示音 */
  level: 'info' | 'good' | 'urgent';
}

/**
 * 时间解析。
 *
 * Postgres 的时间戳微秒位数不固定，实测出现过 `...T13:28:36.92906+00:00`
 * 这种 5 位微秒——探测脚本里的 Python 当场抛了 Invalid isoformat。
 * JS 的 Date 能吃下，但仍要挡住 null 和脏字符串，
 * 否则一条坏数据会让整块大屏白屏。
 */
export function parseTime(v: unknown): number | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/** 距今多少分钟；解析不了返回 null */
export function minutesAgo(v: unknown, now = Date.now()): number | null {
  const t = parseTime(v);
  return t === null ? null : Math.max(0, Math.floor((now - t) / 60000));
}

/**
 * 邮箱脱敏。
 *
 * 大屏是会投到屏幕上、也可能被截图发出去的。完整邮箱属于个人信息，
 * 没有任何必要显示——看板要回答的是「有几个人在用」，不是「谁在用」。
 */
export function maskEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.includes('@')) return '匿名用户';
  const [name, domain] = email.split('@');
  const head = name.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, Math.min(4, name.length - 2)))}@${domain}`;
}

export interface RawUser {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

export interface OnlineUser {
  name: string;
  minutesAgo: number;
}

/**
 * 「在线」是估算，不是真的长连接。
 * 依据是 last_sign_in_at——这是现有数据里唯一能反映「人还在」的信号。
 * 叫「最近活跃」比叫「在线」诚实，界面上也要这么写。
 */
export function onlineUsers(users: RawUser[], now = Date.now()): OnlineUser[] {
  const out: OnlineUser[] = [];
  for (const u of users ?? []) {
    const m = minutesAgo(u.last_sign_in_at, now);
    if (m === null || m > ONLINE_WINDOW_MIN) continue;
    out.push({ name: maskEmail(u.email), minutesAgo: m });
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/** 当天 0 点（按服务器本地时区）之后算「今天」 */
export function isToday(v: unknown, now = Date.now()): boolean {
  const t = parseTime(v);
  if (t === null) return false;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return t >= d.getTime();
}

export interface RawGeneration {
  id?: string | number;
  task_type?: string | null;
  created_at?: string | null;
}

export interface RawOrder {
  id?: string;
  plan_id?: string | null;
  plan_name?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  proof_uploaded_at?: string | null;
}

/**
 * 最近一小时的活跃脉搏，按分钟分桶。
 * 桶是固定 60 个、从旧到新，缺的分钟补 0——
 * 不补的话折线会因为「没数据的分钟直接跳过」而把时间轴压缩，看着像一直很忙。
 */
export function pulseByMinute(
  rows: RawGeneration[],
  now = Date.now(),
  buckets = 60
): number[] {
  const out = new Array(buckets).fill(0);
  for (const r of rows ?? []) {
    const m = minutesAgo(r.created_at, now);
    if (m === null || m >= buckets) continue;
    out[buckets - 1 - m] += 1;
  }
  return out;
}

/** 今天各功能被用了多少次，多的排前面 */
export function featureBreakdown(
  rows: RawGeneration[],
  now = Date.now()
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    if (!isToday(r.created_at, now)) continue;
    const name = (r.task_type || '未知').trim();
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const PLAN_LABEL: Record<string, string> = {
  basic: '基础会员',
  pro: '专业会员',
  enterprise: '企业版',
};

/**
 * 把各路原始数据拧成一条按时间倒序的事件流。
 *
 * id 必须稳定：前端靠「这个 id 见过没有」来决定响不响铃。
 * 用 `类型:主键` 而不是下标或时间戳拼接——下标会随数据增减错位，
 * 时间戳在同一毫秒有多条时会撞。
 */
export function buildEvents(input: {
  generations?: RawGeneration[];
  users?: RawUser[];
  orders?: RawOrder[];
  now?: number;
}): MonitorEvent[] {
  const now = input.now ?? Date.now();
  const events: MonitorEvent[] = [];

  for (const g of input.generations ?? []) {
    const at = g.created_at;
    if (parseTime(at) === null) continue;
    events.push({
      id: `usage:${g.id ?? at}`,
      type: 'usage',
      at: at as string,
      title: `有人在用「${g.task_type || '未知功能'}」`,
      detail: '',
      level: 'info',
    });
  }

  for (const u of input.users ?? []) {
    const at = u.created_at;
    if (parseTime(at) === null) continue;
    events.push({
      id: `signup:${u.id ?? at}`,
      type: 'signup',
      at: at as string,
      title: '新用户注册',
      detail: maskEmail(u.email),
      level: 'good',
    });
  }

  for (const o of input.orders ?? []) {
    const at = o.created_at;
    if (parseTime(at) !== null) {
      const plan = PLAN_LABEL[o.plan_id ?? ''] || o.plan_name || o.plan_id || '未知套餐';
      events.push({
        id: `order:${o.id ?? at}`,
        type: 'order',
        at: at as string,
        title: '有人要充值',
        detail: `${plan} ¥${o.amount ?? '?'}`,
        level: 'urgent',
      });
    }
    // 传了凭证＝等着你审，单独算一条事件，这条才是真正要立刻处理的
    if (parseTime(o.proof_uploaded_at) !== null) {
      events.push({
        id: `proof:${o.id ?? o.proof_uploaded_at}`,
        type: 'order_proof',
        at: o.proof_uploaded_at as string,
        title: '凭证已上传，等你审核',
        detail: `${PLAN_LABEL[o.plan_id ?? ''] || o.plan_name || ''} ¥${o.amount ?? '?'}`,
        level: 'urgent',
      });
    }
  }

  return events
    .filter((e) => (parseTime(e.at) ?? 0) <= now + 60_000) // 挡住时钟偏差造成的"未来事件"
    .sort((a, b) => (parseTime(b.at) ?? 0) - (parseTime(a.at) ?? 0));
}

/**
 * 挑出「上次看过之后」的新事件。
 *
 * 【只认 id，不比时间戳】第一版还拿事件时间和"上次轮询的服务器时间"比，
 * 结果实测一次都不响。原因是这两个时间根本没有可比性：
 *
 *     事件 created_at = T
 *     上次轮询 now    = T + 0.2 秒   ← 那一刻这条记录还没被查到
 *     下次轮询查到了  → at < sinceMs → 判成旧事件丢掉，永远静默
 *
 * 写入和查到之间只要有一点时差（提交延迟、主从复制、时钟偏差），
 * 事件就被永久吞掉。而 id 集合是精确的：见过就是见过。
 * 「首次进页面不补响历史」由调用方的 firstLoad 标志管，不归这里。
 */
export function newEventsSince(
  events: MonitorEvent[],
  seenIds: Set<string>,
  isFirstLoad: boolean
): MonitorEvent[] {
  if (isFirstLoad) return [];
  return events.filter((e) => !seenIds.has(e.id));
}

/**
 * 已见 id 集合的上限。
 * 大屏会连着开几天，不设上限就是一个慢速内存泄漏。
 * 超了就只保留当前这批事件的 id——它们是唯一还可能被再次返回的。
 */
export const SEEN_CAP = 2000;

export function rememberSeen(
  seen: Set<string>,
  events: MonitorEvent[]
): Set<string> {
  for (const e of events) seen.add(e.id);
  if (seen.size <= SEEN_CAP) return seen;
  return new Set(events.map((e) => e.id));
}

/**
 * 已入账的金额。
 *
 * 只算 approved 的单。把 pending/reviewing 也算进"今日收入"是自欺——
 * 那是意向不是钱，看板上写着进账了、银行卡里没有，比不显示更糟。
 */
export function effectiveRevenue(orders: RawOrder[]): number {
  return (orders ?? [])
    .filter((o) => o.status === 'approved')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
}

/** 事件对应的提示音强度。urgent 要盖过其他声音 */
export function soundFor(type: MonitorEventType): 'ping' | 'chime' | 'alert' {
  if (type === 'order' || type === 'order_proof') return 'alert';
  if (type === 'signup') return 'chime';
  return 'ping';
}

/** 相对时间，给事件流用 */
export function relativeTime(v: unknown, now = Date.now()): string {
  const m = minutesAgo(v, now);
  if (m === null) return '';
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}
