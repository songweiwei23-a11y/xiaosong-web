import { effectivePlanIdAt, SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { matchUsers, type AdminUserRow } from '@/lib/admin-users';

/**
 * 会员管理的视图：把「全部用户」和「订阅记录」合在一起看。
 *
 * 【为什么要有】注册时只给付费用户写订阅记录（app/api/auth/register/route.ts 里 planType !== 'free' 才写），
 * 免费用户没有记录。会员管理原来只数订阅表，免费版的人数因此严重偏少：
 * 2026-10-23 认证系统有 15 人，会员管理只显示免费版 3 人，首页和数据分析却显示 12 人。
 * 现在以认证系统的用户为准，没有有效付费记录的都算免费版，和概览、数据分析的口径一致。
 *
 * 纯函数，不碰数据库；接口（app/api/admin/subscriptions）负责读数据。
 */

export interface SubRow {
  id?: string;
  user_id: string;
  plan: string | null;
  status: string | null;
  start_date?: string | null;
  end_date: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MemberEntry {
  user: AdminUserRow;
  /** 没有订阅记录就是 null（免费用户通常是这样） */
  sub: SubRow | null;
  /** 此刻实际享有的套餐（已按到期判定） */
  effective: string;
}

const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS);
const DAY_MS = 86_400_000;

/** 用户和订阅记录合并。每个用户一条，没有记录的按免费版（effectivePlanIdAt 对 null 返回 free） */
export function buildMembers(users: AdminUserRow[], subs: SubRow[], now: number): MemberEntry[] {
  const byUser = new Map(subs.map((s) => [s.user_id, s]));
  return users.map((user) => {
    const sub = byUser.get(user.id) ?? null;
    return { user, sub, effective: effectivePlanIdAt(sub, now) };
  });
}

/** 付费记录是否在 N 天内到期（不含已经过期的，也不含免费版） */
export function expiringWithin(sub: SubRow | null, now: number, days: number): boolean {
  if (!sub || !sub.plan || sub.plan === 'free' || !sub.end_date) return false;
  const end = new Date(sub.end_date).getTime();
  return !Number.isNaN(end) && end >= now && end <= now + days * DAY_MS;
}

/** 顶部统计：全部用户数、各套餐人数（按实际享有的套餐）、7 天内到期的付费记录数 */
export function countMembers(members: MemberEntry[], subs: SubRow[], now: number, expiringDays = 7): Record<string, number> {
  const out: Record<string, number> = {
    all: members.length,
    expiringSoon: subs.filter((s) => expiringWithin(s, now, expiringDays)).length,
  };
  for (const id of PLAN_IDS) out[id] = members.filter((m) => m.effective === id).length;
  return out;
}

export interface MemberFilter {
  /** 套餐：all 或某个套餐编号。按实际享有的套餐筛 */
  plan: string;
  /** 状态：all，或订阅记录的状态（没有记录的算 active） */
  status: string;
  /** 只看 N 天内到期的付费会员；0 或空表示不限 */
  expiringDays: number;
  /** 邮箱子串或用户编号（用 matchUsers 的规则） */
  q: string;
  now: number;
}

/** 按条件筛选，结果按注册时间从新到旧 */
export function filterMembers(members: MemberEntry[], f: MemberFilter): MemberEntry[] {
  const planFilter = PLAN_IDS.includes(f.plan) ? f.plan : null;
  return members
    .filter((m) => {
      if (planFilter && m.effective !== planFilter) return false;
      if (f.status !== 'all' && (m.sub?.status ?? 'active') !== f.status) return false;
      if (f.expiringDays > 0 && !expiringWithin(m.sub, f.now, f.expiringDays)) return false;
      if (f.q && matchUsers([m.user], f.q).length === 0) return false;
      return true;
    })
    .sort((a, b) => b.user.created_at.localeCompare(a.user.created_at));
}
