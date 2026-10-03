/**
 * 实时监控大屏的纯逻辑。
 *
 * 全部做成不依赖网络和数据库的纯函数，原因有两个：
 *   1. 大屏上的每个数字都要经得起问「这是怎么算出来的」，
 *      算法藏在接口里没法单测，出了偏差只能靠肉眼看。
 *   2. 声音提醒靠的是「这条事件是不是新的」，这个判断错一次，
 *      要么该响的不响，要么每次轮询都把同一条事件再响一遍。
 */

import { effectivePlanId, getPlan, FEATURE_NAMES } from '@/lib/config/plans';

/** 多久没动静就算离线 */
export const ONLINE_WINDOW_MIN = 15;

/** 「最近活跃用户」列多久以内有动静的人 */
export const ACTIVE_WINDOW_HOURS = 24;

export type MonitorEventType = 'usage' | 'signup' | 'order' | 'order_proof';

/** 点开一条动态时去取完整记录用的指针 */
export interface RecordRef {
  kind: 'history' | 'usage';
  id: string;
}

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
  /** 是谁。管理员要知道具体是哪个人，不是「有人」 */
  user?: { id: string; email: string; plan: string };
  /** 用的哪个工作档案（哪个号） */
  profile?: string;
  /** 用的哪个功能 */
  feature?: string;
  /** 输入了什么（一行摘要） */
  summary?: string;
  /** 生成了什么（开头一段） */
  excerpt?: string;
  /** 所属作品 */
  work?: string;
  /** 有完整记录可以点开看 */
  ref?: RecordRef;
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
 * 邮箱打码。
 *
 * 接口一律返回完整邮箱——管理员要知道具体是谁在用（产品方明确要求不隐藏）。
 * 打码只在页面上「投屏打码」开关打开时用：大屏投到会议室或截图外发时，
 * 由管理员自己决定遮不遮。
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
  phone?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

export interface RawGeneration {
  id?: string | number;
  user_id?: string | null;
  task_type?: string | null;
  created_at?: string | null;
  input_data?: unknown;
  result?: string | null;
  work_id?: string | null;
}

/** usage_events：每次成功生成/对话记一条，自由对话只在这里有记录 */
export interface RawUsage {
  id?: string | number;
  user_id?: string | null;
  feature?: string | null;
  task_type?: string | null;
  created_at?: string | null;
  detail?: unknown;
}

export interface RawOrder {
  id?: string;
  user_id?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  amount?: number | null;
  status?: string | null;
  billing_cycle?: string | null;
  created_at?: string | null;
  proof_uploaded_at?: string | null;
  reviewed_at?: string | null;
}

export interface RawProfile {
  id?: string;
  user_id?: string | null;
  profile_name?: string | null;
}

export interface RawSubscription {
  user_id?: string | null;
  plan?: string | null;
  status?: string | null;
  end_date?: string | null;
}

export interface RawWork {
  id?: string;
  title?: string | null;
  profile_id?: string | null;
}

/**
 * 查人用的索引：用户 id → 邮箱/套餐/名下档案，档案 id → 档案名，作品 id → 标题。
 * 事件流和活跃用户都要「把 id 翻译成人话」，建一次、查多次。
 */
export interface Directory {
  users: Map<string, RawUser>;
  planOf: Map<string, string>;
  profileName: Map<string, string>;
  profilesOf: Map<string, string[]>;
  works: Map<string, RawWork>;
}

export function buildDirectory(input: {
  users?: RawUser[];
  profiles?: RawProfile[];
  subscriptions?: RawSubscription[];
  works?: RawWork[];
}): Directory {
  const dir: Directory = {
    users: new Map(),
    planOf: new Map(),
    profileName: new Map(),
    profilesOf: new Map(),
    works: new Map(),
  };
  for (const u of input.users ?? []) if (u.id) dir.users.set(u.id, u);
  for (const s of input.subscriptions ?? []) {
    if (s.user_id) dir.planOf.set(s.user_id, getPlan(effectivePlanId(s)).name);
  }
  for (const p of input.profiles ?? []) {
    const name = (p.profile_name || '').trim() || '未命名档案';
    if (p.id) dir.profileName.set(p.id, name);
    if (p.user_id) dir.profilesOf.set(p.user_id, [...(dir.profilesOf.get(p.user_id) ?? []), name]);
  }
  for (const w of input.works ?? []) if (w.id) dir.works.set(w.id, w);
  return dir;
}

/** 用户 id → 看得见的身份。查不到邮箱也要给出能对上号的东西，不能只写「匿名」 */
export function whoIs(userId: unknown, dir: Directory): { id: string; email: string; plan: string } | undefined {
  if (typeof userId !== 'string' || !userId) return undefined;
  const u = dir.users.get(userId);
  const email = u?.email || u?.phone || `未知用户（${userId.slice(0, 8)}）`;
  return { id: userId, email, plan: dir.planOf.get(userId) ?? getPlan('free').name };
}

/** 生成时输入的各项，翻成中文名。没列到的字段照原名显示，不丢 */
const INPUT_LABELS: Record<string, string> = {
  topic: '主题',
  scriptType: '脚本类型',
  platform: '平台',
  duration: '时长',
  tactic: '打法',
  titleType: '标题类型',
  titleFormula: '标题公式',
  keywordStrategy: '关键词策略',
  abTestCount: '版本数',
  targetAudience: '目标人群',
  openingCards: '开场卡片',
  draftContent: '初稿',
  scriptContent: '脚本内容',
  contentType: '内容类型',
  visualStyle: '画面风格',
  query: '问题',
  category: '分类',
  storeName: '店名',
  storeType: '店型',
  storeFeatures: '店铺特色',
  targetCustomer: '目标客户',
  profileSummary: '档案摘要',
  additionalNotes: '补充说明',
  notes: '备注',
  source: '来源',
  request: '要求',
  question: '提问',
  answer: '回答',
};

/** 内部用的 id 字段，翻不成人话，档案另外单独显示 */
const HIDDEN_INPUT_KEYS = new Set([
  'profile_id', 'profileId', 'profileInfo', 'selectedProfileId', 'positioningId', 'positioning_id', 'deletedTopics',
]);

/** 摘要先挑这些字段——它们最能说明「这次在做什么」 */
const SUMMARY_KEYS = [
  'topic', 'query', 'question', 'request', 'storeName', 'notes', 'additionalNotes',
  'draftContent', 'scriptContent', 'profileSummary',
];

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(stringify).filter(Boolean).join('、');
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** 输入的每一项，原样、完整（点开记录时用） */
export function inputFields(input: unknown): { label: string; value: string }[] {
  if (typeof input === 'string') return input.trim() ? [{ label: '输入', value: input.trim() }] : [];
  const obj = asObject(input);
  if (!obj) return [];
  const out: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (HIDDEN_INPUT_KEYS.has(k)) continue;
    const value = stringify(v);
    if (value) out.push({ label: INPUT_LABELS[k] ?? k, value });
  }
  return out;
}

/** 压成一行、截断 */
export function oneLine(text: unknown, max: number): string {
  const s = stringify(text)
    .replace(/[#>*`|_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 这次输入了什么，一行说清 */
export function inputSummary(input: unknown, max = 60): string {
  const obj = asObject(input);
  if (obj) {
    for (const k of SUMMARY_KEYS) {
      const v = stringify(obj[k]);
      if (v) return `${INPUT_LABELS[k]}：${oneLine(v, max)}`;
    }
  }
  const first = inputFields(input)[0];
  return first ? `${first.label}：${oneLine(first.value, max)}` : '';
}

/** 这条记录属于哪个档案：输入里记了档案就用它，否则看所属作品挂在哪个档案下 */
export function profileOf(input: unknown, workId: unknown, dir: Directory): string {
  const obj = asObject(input);
  const pid = obj?.profile_id ?? obj?.profileId;
  if (typeof pid === 'string' && dir.profileName.has(pid)) return dir.profileName.get(pid)!;
  const info = asObject(obj?.profileInfo);
  if (typeof info?.profile_name === 'string' && info.profile_name.trim()) return info.profile_name.trim();
  const w = typeof workId === 'string' ? dir.works.get(workId) : undefined;
  if (w?.profile_id && dir.profileName.has(w.profile_id)) return dir.profileName.get(w.profile_id)!;
  return '';
}

function featureName(u: RawUsage): string {
  return (u.task_type || FEATURE_NAMES[u.feature ?? ''] || u.feature || '未知功能').trim();
}

export interface ActiveUser {
  id: string;
  email: string;
  plan: string;
  /** 名下所有档案 */
  profiles: string[];
  /** 最后一次动静 */
  lastAt: string;
  minutesAgo: number;
  /** ONLINE_WINDOW_MIN 内有动静 */
  online: boolean;
  /** 最后做了什么 */
  lastAction: string;
  /** 今天用了几次，按功能分 */
  todayCount: number;
  todayFeatures: { name: string; count: number }[];
  registeredAt: string | null;
}

/**
 * 最近活跃的用户，按最后一次动静排。
 *
 * 原来只看 last_sign_in_at——可登录态能保持好几周，天天在用的人这个时间
 * 也纹丝不动，列表里常年空着。现在三种动静取最近的一个：
 * 登录、生成记录（script_history）、使用记录（usage_events，自由对话只在这里）。
 */
export function activeUsers(input: {
  users?: RawUser[];
  generations?: RawGeneration[];
  usage?: RawUsage[];
  dir: Directory;
  now?: number;
}): ActiveUser[] {
  const now = input.now ?? Date.now();
  const last = new Map<string, { t: number; action: string }>();
  const touch = (uid: unknown, at: unknown, action: string) => {
    if (typeof uid !== 'string' || !uid) return;
    const t = parseTime(at);
    if (t === null || t > now + 60_000) return;
    const prev = last.get(uid);
    if (!prev || t > prev.t) last.set(uid, { t, action });
  };

  for (const u of input.users ?? []) touch(u.id, u.last_sign_in_at, '登录');
  for (const g of input.generations ?? []) {
    const s = inputSummary(g.input_data, 30);
    touch(g.user_id, g.created_at, `${g.task_type || '未知功能'}${s ? ` · ${s}` : ''}`);
  }
  for (const u of input.usage ?? []) {
    const q = oneLine(asObject(u.detail)?.question, 30);
    touch(u.user_id, u.created_at, `${featureName(u)}${q ? ` · 提问：${q}` : ''}`);
  }

  // 今天的次数：usage_events 是准的（删了历史也不少）；表还没建时退回生成记录
  const todaySource: { uid: unknown; name: string; at: unknown }[] = (input.usage ?? []).length
    ? (input.usage ?? []).map((u) => ({ uid: u.user_id, name: featureName(u), at: u.created_at }))
    : (input.generations ?? []).map((g) => ({ uid: g.user_id, name: g.task_type || '未知功能', at: g.created_at }));
  const today = new Map<string, Map<string, number>>();
  for (const r of todaySource) {
    if (typeof r.uid !== 'string' || !isToday(r.at, now)) continue;
    const m = today.get(r.uid) ?? new Map<string, number>();
    m.set(r.name, (m.get(r.name) ?? 0) + 1);
    today.set(r.uid, m);
  }

  const out: ActiveUser[] = [];
  for (const [uid, { t, action }] of last) {
    const m = Math.max(0, Math.floor((now - t) / 60000));
    if (m > ACTIVE_WINDOW_HOURS * 60) continue;
    const who = whoIs(uid, input.dir)!;
    const feats = [...(today.get(uid) ?? new Map<string, number>()).entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    out.push({
      ...who,
      profiles: input.dir.profilesOf.get(uid) ?? [],
      lastAt: new Date(t).toISOString(),
      minutesAgo: m,
      online: m <= ONLINE_WINDOW_MIN,
      lastAction: action,
      todayCount: feats.reduce((s, f) => s + f.count, 0),
      todayFeatures: feats,
      registeredAt: input.dir.users.get(uid)?.created_at ?? null,
    });
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/** 北京时间当天零点到此刻，不受服务器时区影响，也不计未来记录。 */
export function isToday(v: unknown, now = Date.now()): boolean {
  const t = parseTime(v);
  if (t === null) return false;
  const offset = 8 * 60 * 60 * 1000;
  const start = Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset;
  return t >= start && t <= now;
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
    if ((parseTime(r.created_at) ?? Infinity) > now) continue;
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

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '待付款',
  reviewing: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
};

const CYCLE_LABEL: Record<string, string> = { monthly: '月付', yearly: '年付' };

const EMPTY_DIR = buildDirectory({});

/**
 * 把各路原始数据拧成一条按时间倒序的事件流。
 *
 * 每条都写清是谁（完整邮箱、套餐）、哪个档案、输入了什么、生成了什么。
 * 原来只写「有人在用「脚本生成」」——管理员看完不知道是谁、做的什么内容，
 * 也就没法据此判断产品该往哪走。
 *
 * id 必须稳定：前端靠「这个 id 见过没有」来决定响不响铃。
 * 用 `类型:主键` 而不是下标或时间戳拼接——下标会随数据增减错位，
 * 时间戳在同一毫秒有多条时会撞。
 */
export function buildEvents(input: {
  generations?: RawGeneration[];
  usage?: RawUsage[];
  users?: RawUser[];
  orders?: RawOrder[];
  dir?: Directory;
  now?: number;
}): MonitorEvent[] {
  const now = input.now ?? Date.now();
  const dir = input.dir ?? EMPTY_DIR;
  const events: MonitorEvent[] = [];

  for (const g of input.generations ?? []) {
    const at = g.created_at;
    if (parseTime(at) === null) continue;
    const who = whoIs(g.user_id, dir);
    const feature = g.task_type || '未知功能';
    const summary = inputSummary(g.input_data);
    const work = typeof g.work_id === 'string' ? dir.works.get(g.work_id)?.title ?? '' : '';
    events.push({
      id: `usage:${g.id ?? at}`,
      type: 'usage',
      at: at as string,
      title: `${who?.email ?? '有人'} 用了「${feature}」`,
      detail: summary,
      level: 'info',
      user: who,
      profile: profileOf(g.input_data, g.work_id, dir) || undefined,
      feature,
      summary: summary || undefined,
      excerpt: oneLine(g.result, 140) || undefined,
      work: work || undefined,
      ref: g.id !== undefined ? { kind: 'history', id: String(g.id) } : undefined,
    });
  }

  /*
   * usage_events 里别的功能都和上面的生成记录重复（一次生成两边各记一条），
   * 只取自由对话——它不写生成记录，不从这里取就完全看不见。
   */
  for (const u of input.usage ?? []) {
    if (u.feature !== 'freeChat') continue;
    const at = u.created_at;
    if (parseTime(at) === null) continue;
    const who = whoIs(u.user_id, dir);
    const d = asObject(u.detail);
    const q = oneLine(d?.question, 60);
    events.push({
      id: `chat:${u.id ?? at}`,
      type: 'usage',
      at: at as string,
      title: `${who?.email ?? '有人'} 用了「${featureName(u)}」`,
      detail: q ? `提问：${q}` : '',
      level: 'info',
      user: who,
      profile: profileOf(d, null, dir) || undefined,
      feature: featureName(u),
      summary: q ? `提问：${q}` : undefined,
      excerpt: oneLine(d?.answer, 140) || undefined,
      ref: u.id !== undefined ? { kind: 'usage', id: String(u.id) } : undefined,
    });
  }

  for (const u of input.users ?? []) {
    const at = u.created_at;
    if (parseTime(at) === null) continue;
    // 注册事件本身就带着这个人，不用再去目录里查
    const who = {
      id: u.id ?? '',
      email: u.email || u.phone || `未知用户（${(u.id ?? '').slice(0, 8)}）`,
      plan: (u.id && dir.planOf.get(u.id)) || getPlan('free').name,
    };
    events.push({
      id: `signup:${u.id ?? at}`,
      type: 'signup',
      at: at as string,
      title: '新用户注册',
      detail: who.email,
      level: 'good',
      user: who.id ? who : undefined,
    });
  }

  for (const o of input.orders ?? []) {
    const plan = PLAN_LABEL[o.plan_id ?? ''] || o.plan_name || o.plan_id || '未知套餐';
    const cycle = CYCLE_LABEL[o.billing_cycle ?? ''] ?? '';
    const status = ORDER_STATUS_LABEL[o.status ?? ''] ?? o.status ?? '';
    const who = whoIs(o.user_id, dir);
    const money = `${plan}${cycle ? `（${cycle}）` : ''} ¥${o.amount ?? '?'}`;
    const at = o.created_at;
    if (parseTime(at) !== null) {
      events.push({
        id: `order:${o.id ?? at}`,
        type: 'order',
        at: at as string,
        title: `${who?.email ?? '有人'} 要充值`,
        detail: `${money}${status ? ` · 当前：${status}` : ''}`,
        level: 'urgent',
        user: who,
      });
    }
    // 传了凭证＝等着你审，单独算一条事件，这条才是真正要立刻处理的
    if (parseTime(o.proof_uploaded_at) !== null) {
      events.push({
        id: `proof:${o.id ?? o.proof_uploaded_at}`,
        type: 'order_proof',
        at: o.proof_uploaded_at as string,
        title: `${who?.email ?? '有人'} 已上传凭证，等你审核`,
        detail: `${money}${status ? ` · 当前：${status}` : ''}`,
        level: 'urgent',
        user: who,
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
