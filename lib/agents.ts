/**
 * 代理分成的纯规则（2026-10-28）：月份（北京时间）、分成金额（按分取整）、费率输入、邮箱脱敏、按月汇总。
 * 不碰数据库，前后端和测试都能用。读库和写库在 lib/agent-data。
 *
 * 规则（编导在 2026-10-28 确认）：
 * - 费率全部统一，一个比例；
 * - 代理只看自己生成的邀请码带来的用户，以及这些用户购买会员的账单（次数包不算）；
 * - 每月结算一次，管理员手动结；只结已经过完的月份；
 * - 功能上线前的老用户不算。
 */

/** 北京时间 = UTC+8，没有夏令时 */
const BEIJING_OFFSET_MS = 8 * 3600_000;
const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidPeriod(value: unknown): value is string {
  return typeof value === 'string' && PERIOD_RE.test(value);
}

/** 某个时间点在北京时间属于哪个月，格式 YYYY-MM */
export function periodOf(at: number | string | Date): string {
  const d = new Date(new Date(at).getTime() + BEIJING_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentPeriod(now: number = Date.now()): string {
  return periodOf(now);
}

/** 上一个月（北京时间）。默认结算的就是它：这个月还没过完，不能结 */
export function previousPeriod(now: number = Date.now()): string {
  const [y, m] = currentPeriod(now).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 某个月在北京时间的起止（ISO 字符串，左闭右开），用来按 reviewed_at 查订单 */
export function periodBounds(period: string): { startIso: string; endIso: string } {
  if (!isValidPeriod(period)) throw new Error(`月份格式不对：${period}`);
  const [y, m] = period.split('-').map(Number);
  const start = Date.UTC(y, m - 1, 1) - BEIJING_OFFSET_MS;
  const end = Date.UTC(y, m, 1) - BEIJING_OFFSET_MS;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/** 只结已经过完的月份：本月和未来的月份都不能结 */
export function canSettlePeriod(period: string, now: number = Date.now()): boolean {
  return isValidPeriod(period) && period < currentPeriod(now);
}

/**
 * 后台输入的费率是百分比（20 = 20%），存成 0 到 1 的小数。
 * 只接受 0 到 100 之间、最多两位小数的数；其它返回 null。
 */
export function parseRatePercent(input: unknown): number | null {
  const n = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) return null;
  const hundredths = Math.round(n * 100);
  if (Math.abs(hundredths - n * 100) > 1e-6) return null;
  return hundredths / 10000;
}

/** 分成金额（元，两位小数）。按分取整，避免 0.1 + 0.2 这类浮点误差 */
export function commissionAmount(paidAmount: number, rate: number): number {
  const paidCents = Math.round(paidAmount * 100);
  return Math.round(paidCents * rate) / 100;
}

/** 把若干金额加起来，按分计算，结果保留两位小数 */
export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((cents, a) => cents + Math.round(a * 100), 0) / 100;
}

export interface PaidOrder {
  id?: string;
  user_id: string;
  amount: number;
  reviewed_at: string;
  plan_name?: string;
  billing_cycle?: string;
}

export interface PeriodTotal {
  period: string;
  orderCount: number;
  payerCount: number;
  paidAmount: number;
}

/** 已通过的会员订单按北京时间的月份汇总，最新的月份在前 */
export function bucketPaidOrders(orders: PaidOrder[]): PeriodTotal[] {
  const map = new Map<string, { orders: number; payers: Set<string>; amounts: number[] }>();
  for (const o of orders) {
    const period = periodOf(o.reviewed_at);
    const bucket = map.get(period) ?? { orders: 0, payers: new Set<string>(), amounts: [] };
    bucket.orders += 1;
    bucket.payers.add(o.user_id);
    bucket.amounts.push(o.amount);
    map.set(period, bucket);
  }
  return [...map.entries()]
    .map(([period, b]) => ({ period, orderCount: b.orders, payerCount: b.payers.size, paidAmount: sumAmounts(b.amounts) }))
    .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
}

export interface SettlementRow {
  period: string;
  order_count: number;
  paid_amount: number;
  commission_rate: number;
  commission_amount: number;
}

export interface MonthLine {
  period: string;
  orderCount: number;
  payerCount: number;
  paidAmount: number;
  rate: number;
  commission: number;
  settled: boolean;
}

/**
 * 一个月的分成行。已结算的月份用结算时的快照（费率、金额都不再变）；
 * 没结算的按当前费率现算，页面上会标明「未结算」。
 */
export function monthLine(total: PeriodTotal, settlement: SettlementRow | undefined, currentRate: number): MonthLine {
  if (settlement) {
    return {
      period: total.period,
      orderCount: settlement.order_count,
      payerCount: total.payerCount,
      paidAmount: settlement.paid_amount,
      rate: settlement.commission_rate,
      commission: settlement.commission_amount,
      settled: true,
    };
  }
  return {
    period: total.period,
    orderCount: total.orderCount,
    payerCount: total.payerCount,
    paidAmount: total.paidAmount,
    rate: currentRate,
    commission: commissionAmount(total.paidAmount, currentRate),
    settled: false,
  };
}

/** 把有订单的月份和已结算的月份合在一起（结算了但当月没有订单，也要显示） */
export function monthLines(totals: PeriodTotal[], settlements: SettlementRow[], currentRate: number): MonthLine[] {
  const totalBy = new Map(totals.map((t) => [t.period, t]));
  const settledBy = new Map(settlements.map((s) => [s.period, s]));
  const periods = [...new Set([...totalBy.keys(), ...settledBy.keys()])].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return periods.map((period) => {
    const total = totalBy.get(period) ?? { period, orderCount: 0, payerCount: 0, paidAmount: 0 };
    return monthLine(total, settledBy.get(period), currentRate);
  });
}

/** 结算一个月时写进快照的内容（管理员点结算时算一次，之后不再变） */
export function settlementSnapshot(paidAmount: number, orderCount: number, rate: number): Omit<SettlementRow, 'period'> {
  return {
    order_count: orderCount,
    paid_amount: paidAmount,
    commission_rate: rate,
    commission_amount: commissionAmount(paidAmount, rate),
  };
}
