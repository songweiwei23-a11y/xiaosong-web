/**
 * 代理分成的读写（2026-10-28，服务端）。所有函数都接收一个 service_role 客户端，
 * 代理相关的查询一律带上 agent_id，由调用方（API 路由）从会话里取代理身份，不接受前端传来的代理 id。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllRows } from '@/lib/admin-monitor-data';
import { emailsByIds } from '@/lib/admin-users';
import {
  bucketPaidOrders,
  commissionAmount,
  monthLines,
  periodBounds,
  periodOf,
  settlementSnapshot,
  sumAmounts,
  type MonthLine,
  type PaidOrder,
  type SettlementRow,
} from '@/lib/agents';

/** 代理生成的邀请码能被多少人使用（多人共用，不设过期）。上限只是防误用，实际靠代理自己发给客户 */
export const AGENT_CODE_MAX_USES = 100000;

/** 统一费率（0 到 1）。没有这一行时按 0 */
export async function currentRate(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from('agent_program_settings').select('commission_rate').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.commission_rate ?? 0);
}

export interface Referral {
  user_id: string;
  invitation_code: string;
  bound_at: string;
}

/** 这个代理的客户：用它生成的邀请码注册的用户，第一次绑定为准 */
export async function referralsOf(db: SupabaseClient, agentId: string): Promise<Referral[]> {
  return readAllRows<Referral>((from, to) =>
    db
      .from('agent_referrals')
      .select('user_id, invitation_code, bound_at')
      .eq('agent_id', agentId)
      .order('bound_at', { ascending: false })
      .range(from, to)
  );
}

const IN_CHUNK = 200;

/**
 * 这些用户已通过的会员订单（次数包不在 payment_orders 里，所以天然不算）。
 * range 为空时取全部；按 200 个用户一批查，避免 URL 过长。
 */
export async function paidOrdersOf(
  db: SupabaseClient,
  userIds: string[],
  range?: { startIso: string; endIso: string }
): Promise<PaidOrder[]> {
  const out: PaidOrder[] = [];
  for (let i = 0; i < userIds.length; i += IN_CHUNK) {
    let query = db
      .from('payment_orders')
      .select('id, user_id, amount, reviewed_at, plan_name, billing_cycle')
      .in('user_id', userIds.slice(i, i + IN_CHUNK))
      .eq('status', 'approved')
      .not('reviewed_at', 'is', null);
    if (range) query = query.gte('reviewed_at', range.startIso).lt('reviewed_at', range.endIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      out.push({
        id: r.id as string,
        user_id: r.user_id as string,
        amount: Number(r.amount),
        reviewed_at: r.reviewed_at as string,
        plan_name: r.plan_name as string,
        billing_cycle: r.billing_cycle as string,
      });
    }
  }
  return out;
}

export async function settlementsOf(db: SupabaseClient, agentId: string): Promise<SettlementRow[]> {
  const { data, error } = await db
    .from('agent_settlements')
    .select('period, order_count, paid_amount, commission_rate, commission_amount')
    .eq('agent_id', agentId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    period: r.period as string,
    order_count: Number(r.order_count),
    paid_amount: Number(r.paid_amount),
    commission_rate: Number(r.commission_rate),
    commission_amount: Number(r.commission_amount),
  }));
}

export interface AgentSummary {
  displayName: string;
  rate: number;
  currentPeriod: string;
  totals: { customers: number; payers: number; orderCount: number; paidAmount: number; commission: number };
  thisMonth: MonthLine;
  months: MonthLine[];
}

/** 代理首页：统计、每月分成行（已结算的用快照，未结算的按当前费率） */
export async function agentSummary(
  db: SupabaseClient,
  agent: { agentId: string; displayName: string },
  now: number = Date.now()
): Promise<AgentSummary> {
  const [referrals, rate, settlements] = await Promise.all([
    referralsOf(db, agent.agentId),
    currentRate(db),
    settlementsOf(db, agent.agentId),
  ]);
  const orders = await paidOrdersOf(db, [...new Set(referrals.map((r) => r.user_id))]);
  const months = monthLines(bucketPaidOrders(orders), settlements, rate);
  const period = periodOf(now);
  const thisMonth: MonthLine = months.find((m) => m.period === period) ?? {
    period,
    orderCount: 0,
    payerCount: 0,
    paidAmount: 0,
    rate,
    commission: 0,
    settled: false,
  };
  return {
    displayName: agent.displayName,
    rate,
    currentPeriod: period,
    totals: {
      customers: referrals.length,
      payers: new Set(orders.map((o) => o.user_id)).size,
      orderCount: orders.length,
      paidAmount: sumAmounts(orders.map((o) => o.amount)),
      commission: sumAmounts(months.map((m) => m.commission)),
    },
    thisMonth,
    months,
  };
}

export interface CustomerRow {
  user_id: string;
  email: string;
  invitation_code: string;
  bound_at: string;
  orderCount: number;
  paidAmount: number;
}

/** 代理的客户：完整邮箱（2026-10-28 确认），不给生成内容，只给注册时间、用的码、充值情况 */
export async function agentCustomers(db: SupabaseClient, agentId: string): Promise<CustomerRow[]> {
  const referrals = await referralsOf(db, agentId);
  const orders = await paidOrdersOf(db, referrals.map((r) => r.user_id));
  const emails = await emailsByIds(db, referrals.map((r) => r.user_id));
  const byUser = new Map<string, { count: number; amounts: number[] }>();
  for (const o of orders) {
    const b = byUser.get(o.user_id) ?? { count: 0, amounts: [] };
    b.count += 1;
    b.amounts.push(o.amount);
    byUser.set(o.user_id, b);
  }
  return referrals.map((r) => {
    const b = byUser.get(r.user_id);
    return {
      user_id: r.user_id,
      email: emails.get(r.user_id) ?? '（用户已注销）',
      invitation_code: r.invitation_code,
      bound_at: r.bound_at,
      orderCount: b?.count ?? 0,
      paidAmount: b ? sumAmounts(b.amounts) : 0,
    };
  });
}

export interface BillRow {
  id: string;
  email: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  reviewed_at: string;
  period: string;
  rate: number;
  commission: number;
  settled: boolean;
}

/**
 * 代理的账单：这些客户购买会员的已通过订单。period 为空时列出全部月份。
 * 每张单的分成：已结算的月份用结算时的费率，未结算的按当前费率。
 */
export async function agentBills(
  db: SupabaseClient,
  agentId: string,
  period: string | null,
  rate: number,
  settlements: SettlementRow[]
): Promise<BillRow[]> {
  const referrals = await referralsOf(db, agentId);
  const range = period ? periodBounds(period) : undefined;
  const orders = await paidOrdersOf(db, referrals.map((r) => r.user_id), range);
  const emails = await emailsByIds(db, [...new Set(orders.map((o) => o.user_id))]);
  const settledBy = new Map(settlements.map((s) => [s.period, s]));
  return orders
    .map((o) => {
      const p = periodOf(o.reviewed_at);
      const s = settledBy.get(p);
      const r = s ? s.commission_rate : rate;
      return {
        id: o.id ?? '',
        email: emails.get(o.user_id) ?? '（用户已注销）',
        plan_name: o.plan_name ?? '',
        billing_cycle: o.billing_cycle ?? '',
        amount: o.amount,
        reviewed_at: o.reviewed_at,
        period: p,
        rate: r,
        commission: commissionAmount(o.amount, r),
        settled: !!s,
      };
    })
    .sort((a, b) => (a.reviewed_at < b.reviewed_at ? 1 : a.reviewed_at > b.reviewed_at ? -1 : 0));
}

export interface AdminAgentRow {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  status: string;
  created_at: string;
  customers: number;
  payers: number;
  paidAmount: number;
  commissionAtCurrentRate: number;
}

export interface ReferrerInfo {
  agent_id: string;
  /** 代理的显示名；没有填显示名的，用代理的账号邮箱 */
  agent_name: string;
  invitation_code: string;
  bound_at: string;
}

/**
 * 这些用户是哪个代理拉来的（管理员看用户时用）。没有归属的用户不在返回的 Map 里。
 * 代理的显示名为空时，用代理的账号邮箱代替。
 */
export async function referrersOf(db: SupabaseClient, userIds: string[]): Promise<Map<string, ReferrerInfo>> {
  const out = new Map<string, ReferrerInfo>();
  if (!userIds.length) return out;
  const { data, error } = await db
    .from('agent_referrals')
    .select('user_id, agent_id, invitation_code, bound_at')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const agentIds = [...new Set(rows.map((r) => r.agent_id as string))];
  if (!agentIds.length) return out;
  const { data: agents, error: agentError } = await db.from('agents').select('id, user_id, display_name').in('id', agentIds);
  if (agentError) throw new Error(agentError.message);
  const agentRows = agents ?? [];
  const agentEmails = await emailsByIds(db, agentRows.map((a) => a.user_id as string));
  const nameBy = new Map(
    agentRows.map((a) => [
      a.id as string,
      ((a.display_name as string) || agentEmails.get(a.user_id as string)) || '（未命名代理）',
    ])
  );
  for (const r of rows) {
    const agentId = r.agent_id as string;
    out.set(r.user_id as string, {
      agent_id: agentId,
      agent_name: nameBy.get(agentId) ?? '（未命名代理）',
      invitation_code: r.invitation_code as string,
      bound_at: r.bound_at as string,
    });
  }
  return out;
}

/** 管理员：全部代理，带邮箱、客户数、累计充值、当前费率下的累计分成 */
export async function adminAgentList(db: SupabaseClient, rate: number): Promise<AdminAgentRow[]> {
  const { data, error } = await db
    .from('agents')
    .select('id, user_id, display_name, status, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const agents = data ?? [];
  const emails = await emailsByIds(db, agents.map((a) => a.user_id as string));
  const rows: AdminAgentRow[] = [];
  for (const a of agents) {
    const referrals = await referralsOf(db, a.id as string);
    const orders = await paidOrdersOf(db, referrals.map((r) => r.user_id));
    rows.push({
      id: a.id as string,
      user_id: a.user_id as string,
      email: emails.get(a.user_id as string) ?? '（用户已注销）',
      display_name: (a.display_name as string) || '',
      status: a.status as string,
      created_at: a.created_at as string,
      customers: referrals.length,
      payers: new Set(orders.map((o) => o.user_id)).size,
      paidAmount: sumAmounts(orders.map((o) => o.amount)),
      commissionAtCurrentRate: commissionAmount(sumAmounts(orders.map((o) => o.amount)), rate),
    });
  }
  return rows;
}

/**
 * 结算一个月：对每个代理，算出这个月的已通过会员订单总额，写一条快照。
 * 同一代理同一个月只结一次：已经结过的跳过（upsert ignoreDuplicates），所以重复点也不会重复记。
 */
export async function settleAgentsForPeriod(
  db: SupabaseClient,
  period: string,
  rate: number,
  adminId: string
): Promise<{ settled: number; skipped: number; totalCommission: number; agents: { agent_id: string; order_count: number; paid_amount: number; commission_amount: number; skipped: boolean }[] }> {
  const { data, error } = await db.from('agents').select('id');
  if (error) throw new Error(error.message);
  const range = periodBounds(period);
  const result: { agent_id: string; order_count: number; paid_amount: number; commission_amount: number; skipped: boolean }[] = [];
  for (const a of data ?? []) {
    const agentId = a.id as string;
    const referrals = await referralsOf(db, agentId);
    const orders = await paidOrdersOf(db, referrals.map((r) => r.user_id), range);
    const paid = sumAmounts(orders.map((o) => o.amount));
    const snapshot = settlementSnapshot(paid, orders.length, rate);
    const { data: inserted, error: insertError } = await db
      .from('agent_settlements')
      .upsert(
        { agent_id: agentId, period, ...snapshot, settled_by: adminId },
        { onConflict: 'agent_id,period', ignoreDuplicates: true }
      )
      .select('id');
    if (insertError) throw new Error(insertError.message);
    const skipped = (inserted ?? []).length === 0;
    result.push({
      agent_id: agentId,
      order_count: snapshot.order_count,
      paid_amount: snapshot.paid_amount,
      commission_amount: snapshot.commission_amount,
      skipped,
    });
  }
  const settled = result.filter((r) => !r.skipped);
  return {
    settled: settled.length,
    skipped: result.length - settled.length,
    totalCommission: sumAmounts(settled.map((r) => r.commission_amount)),
    agents: result,
  };
}

/** 按邮箱找用户的 id（分页查 auth 用户；管理员手动开通代理时用，不常用） */
export async function findUserIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
