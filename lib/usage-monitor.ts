import { COUNTED_FEATURES, FEATURE_NAMES, effectivePlanIdAt } from '@/lib/config/plans';

/**
 * 后台「用户使用监控」的计算。纯函数：输入是已经取好的记录，输出是板块要显示的数字。
 *
 * 定义（口径写在这里，页面上的说明也从这里取）：
 * - 活跃：窗口内至少有一次创作（usage_events 里的一条）。
 * - 新用户：注册时间落在窗口内。
 * - 付费：有过已通过的订单（会员或次数包）。
 * - 五维（雷达图，每维 0–100）：
 *     活跃度   近 30 天活跃 / 注册用户
 *     使用深度 活跃用户人均创作次数 / 参考值（20 次）
 *     功能广度 活跃用户人均用过的创作功能数 / 创作功能总数
 *     付费转化 付费用户 / 注册用户
 *     留存     近 7 天活跃 / 近 30 天活跃
 * - 四率：
 *     激活率   窗口内注册的新用户中，有创作的比例
 *     周活跃率 近 7 天活跃 / 注册用户
 *     付费率   付费用户 / 注册用户
 *     复购率   付费过两次及以上 / 付费用户
 */

/** 使用深度的参考值：活跃用户人均 20 次创作记为满分（可以按数据再调） */
export const REFERENCE_CREATIONS_PER_ACTIVE = 20;

/** 创作功能（不含知识库）的数量：功能广度的分母 */
export const CREATION_FEATURE_COUNT = COUNTED_FEATURES.filter((f) => f.key !== 'knowledge').length;

export interface MonitorUser {
  id: string;
  email?: string | null;
  createdAt: string | null;
  lastSignInAt?: string | null;
}
export interface MonitorSubscription { userId: string; plan: string | null; status: string | null; endDate: string | null }
export interface MonitorUsageEvent { userId: string; feature: string; createdAt: string }
export interface MonitorEvidence {
  userId: string;
  feature: string;
  completedAt: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}
export interface MonitorQuota { userId: string; periodUsed: number }
export interface MonitorPackLot { userId: string; creditsRemaining: number; expiresAt: string | null; creditsTotal: number }
export interface MonitorOrder { userId: string; planId: string; status: string }

export interface MonitorInput {
  users: MonitorUser[];
  subscriptions: MonitorSubscription[];
  events: MonitorUsageEvent[];
  evidence: MonitorEvidence[];
  quotas: MonitorQuota[];
  packLots: MonitorPackLot[];
  orders: MonitorOrder[];
  days: number;
  now: Date;
  /** 每百万 tokens 的单价（元）。未配置时为 null，成本显示「未配置单价」 */
  tokenPricePerMillion: number | null;
}

export interface MonitorUserRow {
  userId: string;
  email: string | null;
  plan: string;
  registeredAt: string | null;
  lastActiveAt: string | null;
  creationsInWindow: number;
  activeDaysInWindow: number;
  featuresUsedInWindow: number;
  tokensInWindow: number;
  periodUsed: number;
  packBalance: number;
  packPurchases: number;
  paidOrders: number;
}

export interface MonitorFeatureRow { feature: string; name: string; creations: number; tokens: number; users: number }

export interface MonitorOutput {
  days: number;
  generatedAt: string;
  summary: {
    registered: number;
    newUsers: number;
    activeInWindow: number;
    active7: number;
    active30: number;
    creations: number;
    tokens: { total: number; prompt: number; completion: number; perCreation: number | null };
    /** 按单价估算的成本（元）。未配置单价时为 null */
    estimatedCostCny: number | null;
    packBalance: number;
    packPurchases: number;
    paidUsers: number;
  };
  dimensions: { label: string; score: number; raw: string; note: string }[];
  rates: { label: string; value: number | null; numerator: number; denominator: number; note: string }[];
  daily: { date: string; creations: number; tokens: number }[];
  features: MonitorFeatureRow[];
  users: MonitorUserRow[];
}

const DAY_MS = 86_400_000;

/**
 * 模型单价（元 / 百万 tokens）。未配置时为 null：成本一栏显示「未配置单价」，不估算。
 * 线上的 Dify 回传 total_price 全为 0，只能从模型服务的账单拿单价，确认后再填。
 */
export const TOKEN_PRICE_CNY_PER_MILLION: number | null = null;

/** 邮箱打码：保留首字母和域名，中间用 *** 代替。没有邮箱返回 null */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** 上海时区的日期 YYYY-MM-DD */
export function shanghaiDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const clampScore = (x: number): number => Math.max(0, Math.min(100, Math.round(x)));

export function buildUsageMonitor(input: MonitorInput): MonitorOutput {
  const { users, subscriptions, events, evidence, quotas, packLots, orders, days, now } = input;
  const windowStart = now.getTime() - days * DAY_MS;
  const start7 = now.getTime() - 7 * DAY_MS;
  const start30 = now.getTime() - 30 * DAY_MS;
  const inWindow = (iso: string) => new Date(iso).getTime() >= windowStart;

  const subByUser = new Map(subscriptions.map((s) => [s.userId, s]));
  const quotaByUser = new Map(quotas.map((q) => [q.userId, q.periodUsed]));

  // 每个用户在窗口内的创作、天数、功能、tokens；以及 7 天 / 30 天内是否活跃
  type Agg = { creations: number; days: Set<string>; features: Set<string>; tokens: number; last: number; active7: boolean; active30: boolean };
  const agg = new Map<string, Agg>();
  const ensure = (userId: string): Agg => {
    let a = agg.get(userId);
    if (!a) {
      a = { creations: 0, days: new Set(), features: new Set(), tokens: 0, last: 0, active7: false, active30: false };
      agg.set(userId, a);
    }
    return a;
  };
  const dailyMap = new Map<string, { creations: number; tokens: number }>();
  const featureMap = new Map<string, { creations: number; tokens: number; users: Set<string> }>();

  // 最近一次创作（不限窗口，用来显示「最近活跃」）
  const lastEver = new Map<string, number>();
  for (const e of events) {
    lastEver.set(e.userId, Math.max(lastEver.get(e.userId) ?? 0, new Date(e.createdAt).getTime()));
  }

  for (const e of events) {
    const t = new Date(e.createdAt).getTime();
    if (t >= start30) ensure(e.userId).active30 = true;
    if (t >= start7) ensure(e.userId).active7 = true;
    if (!inWindow(e.createdAt)) continue;
    const a = ensure(e.userId);
    a.creations += 1;
    a.days.add(shanghaiDate(e.createdAt));
    a.features.add(e.feature);
    a.last = Math.max(a.last, t);
    const day = shanghaiDate(e.createdAt);
    const d = dailyMap.get(day) ?? { creations: 0, tokens: 0 };
    d.creations += 1;
    dailyMap.set(day, d);
    const f = featureMap.get(e.feature) ?? { creations: 0, tokens: 0, users: new Set<string>() };
    f.creations += 1;
    f.users.add(e.userId);
    featureMap.set(e.feature, f);
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  for (const ev of evidence) {
    if (!inWindow(ev.completedAt)) continue;
    const a = ensure(ev.userId);
    a.tokens += ev.totalTokens;
    totalTokens += ev.totalTokens;
    promptTokens += ev.promptTokens;
    completionTokens += ev.completionTokens;
    const day = shanghaiDate(ev.completedAt);
    const d = dailyMap.get(day) ?? { creations: 0, tokens: 0 };
    d.tokens += ev.totalTokens;
    dailyMap.set(day, d);
    const f = featureMap.get(ev.feature) ?? { creations: 0, tokens: 0, users: new Set<string>() };
    f.tokens += ev.totalTokens;
    featureMap.set(ev.feature, f);
  }

  // 付费：已通过的订单（会员或次数包）
  const paidOrdersByUser = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== 'approved') continue;
    paidOrdersByUser.set(o.userId, (paidOrdersByUser.get(o.userId) ?? 0) + 1);
  }
  const packPurchasesByUser = new Map<string, number>();
  for (const lot of packLots) {
    packPurchasesByUser.set(lot.userId, (packPurchasesByUser.get(lot.userId) ?? 0) + 1);
  }
  const packBalanceByUser = new Map<string, number>();
  for (const lot of packLots) {
    const alive = !lot.expiresAt || new Date(lot.expiresAt).getTime() > now.getTime();
    if (!alive) continue;
    packBalanceByUser.set(lot.userId, (packBalanceByUser.get(lot.userId) ?? 0) + lot.creditsRemaining);
  }

  const registered = users.length;
  const newUsersList = users.filter((u) => u.createdAt && inWindow(u.createdAt));
  const newUsers = newUsersList.length;
  const activeWindowIds = [...agg.entries()].filter(([, a]) => a.creations > 0).map(([id]) => id);
  const activeInWindow = activeWindowIds.length;
  const active7 = [...agg.values()].filter((a) => a.active7).length;
  const active30 = [...agg.values()].filter((a) => a.active30).length;
  const creations = events.filter((e) => inWindow(e.createdAt)).length;

  const paidUserIds = new Set<string>([...paidOrdersByUser.keys()]);
  const paidUsers = paidUserIds.size;
  const repeatPaid = [...paidOrdersByUser.values()].filter((n) => n >= 2).length;
  const newActive = newUsersList.filter((u) => (agg.get(u.id)?.creations ?? 0) > 0).length;

  const activeAgg = activeWindowIds.map((id) => agg.get(id)!);
  const avgCreations = activeInWindow > 0 ? creations / activeInWindow : 0;
  const avgFeatures = activeInWindow > 0 ? activeAgg.reduce((s, a) => s + a.features.size, 0) / activeInWindow : 0;

  const dimensions = [
    {
      label: '活跃度',
      score: registered > 0 ? clampScore((active30 / registered) * 100) : 0,
      raw: `近30天活跃 ${active30} / 注册 ${registered}`,
      note: '近 30 天有过创作的用户占注册用户的比例',
    },
    {
      label: '使用深度',
      score: clampScore((avgCreations / REFERENCE_CREATIONS_PER_ACTIVE) * 100),
      raw: `活跃用户人均 ${avgCreations.toFixed(1)} 次`,
      note: `活跃用户人均创作次数，${REFERENCE_CREATIONS_PER_ACTIVE} 次为满分`,
    },
    {
      label: '功能广度',
      score: clampScore((avgFeatures / CREATION_FEATURE_COUNT) * 100),
      raw: `人均用过 ${avgFeatures.toFixed(1)} / ${CREATION_FEATURE_COUNT} 个功能`,
      note: '活跃用户人均用过的创作功能占全部创作功能的比例',
    },
    {
      label: '付费转化',
      score: registered > 0 ? clampScore((paidUsers / registered) * 100) : 0,
      raw: `付费 ${paidUsers} / 注册 ${registered}`,
      note: '付过费（会员或次数包）的用户占注册用户的比例',
    },
    {
      label: '留存',
      score: active30 > 0 ? clampScore((active7 / active30) * 100) : 0,
      raw: `近7天活跃 ${active7} / 近30天 ${active30}`,
      note: '近 7 天还在用的，占近 30 天用过的',
    },
  ];

  const rates = [
    {
      label: '激活率',
      value: pct(newActive, newUsers),
      numerator: newActive,
      denominator: newUsers,
      note: '窗口内注册的新用户中，已经有过创作的比例',
    },
    { label: '周活跃率', value: pct(active7, registered), numerator: active7, denominator: registered, note: '近 7 天活跃 / 注册用户' },
    { label: '付费率', value: pct(paidUsers, registered), numerator: paidUsers, denominator: registered, note: '付过费 / 注册用户' },
    {
      label: '复购率',
      value: pct(repeatPaid, paidUsers),
      numerator: repeatPaid,
      denominator: paidUsers,
      note: '付过两次及以上 / 付费用户',
    },
  ];

  const tokenPrice = input.tokenPricePerMillion;
  const estimatedCostCny = tokenPrice === null ? null : Math.round((totalTokens / 1_000_000) * tokenPrice * 100) / 100;

  const packBalanceTotal = [...packBalanceByUser.values()].reduce((s, n) => s + n, 0);
  const packPurchases = [...packPurchasesByUser.values()].reduce((s, n) => s + n, 0);

  const userRows: MonitorUserRow[] = users.map((u) => {
    const a = agg.get(u.id);
    const sub = subByUser.get(u.id);
    return {
      userId: u.id,
      email: maskEmail(u.email),
      // 套餐按统一的判定（状态 + 到期时间），和会员页、服务端放行保持一致
      plan: effectivePlanIdAt({ plan: sub?.plan, status: sub?.status, end_date: sub?.endDate }, now.getTime()),
      registeredAt: u.createdAt,
      lastActiveAt: lastEver.has(u.id) ? new Date(lastEver.get(u.id)!).toISOString() : null,
      creationsInWindow: a?.creations ?? 0,
      activeDaysInWindow: a?.days.size ?? 0,
      featuresUsedInWindow: a?.features.size ?? 0,
      tokensInWindow: a?.tokens ?? 0,
      periodUsed: quotaByUser.get(u.id) ?? 0,
      packBalance: packBalanceByUser.get(u.id) ?? 0,
      packPurchases: packPurchasesByUser.get(u.id) ?? 0,
      paidOrders: paidOrdersByUser.get(u.id) ?? 0,
    };
  });

  const features: MonitorFeatureRow[] = [...featureMap.entries()]
    .map(([feature, f]) => ({
      feature,
      name: FEATURE_NAMES[feature] ?? feature,
      creations: f.creations,
      tokens: f.tokens,
      users: f.users.size,
    }))
    .sort((a, b) => b.creations - a.creations);

  const daily: MonitorOutput['daily'] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = shanghaiDate(new Date(now.getTime() - i * DAY_MS));
    const d = dailyMap.get(date) ?? { creations: 0, tokens: 0 };
    daily.push({ date, creations: d.creations, tokens: d.tokens });
  }

  return {
    days,
    generatedAt: now.toISOString(),
    summary: {
      registered,
      newUsers,
      activeInWindow,
      active7,
      active30,
      creations,
      tokens: {
        total: totalTokens,
        prompt: promptTokens,
        completion: completionTokens,
        perCreation: creations > 0 ? Math.round(totalTokens / creations) : null,
      },
      estimatedCostCny,
      packBalance: packBalanceTotal,
      packPurchases,
      paidUsers,
    },
    dimensions,
    rates,
    daily,
    features,
    users: userRows.sort((a, b) => b.creationsInWindow - a.creationsInWindow || b.tokensInWindow - a.tokensInWindow),
  };
}
