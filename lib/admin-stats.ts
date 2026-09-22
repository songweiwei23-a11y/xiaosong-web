/**
 * 后台统计的共用算法。
 *
 * /api/admin/stats 和 /api/admin/analytics 原本各写了一份，同一批错
 * 也就犯了两遍：
 *   - 查 `profiles` 表统计用户数，而数据库里根本没这张表（是 user_profiles），
 *     于是总用户数恒为 0；
 *   - 接着「免费用户 = 总用户 - 付费用户」算出负数，页面上写着「免费用户 -1」；
 *   - 八个功能的用量逐个手写字段名，加功能时漏一个就少算，没人会发现。
 *
 * 收敛到这里之后，字段名从 COUNTED_FEATURES 派生，加功能不用回来改。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { COUNTED_FEATURES } from '@/lib/config/plans';

/** 各功能在后台图表上的图标名，前端按这个字符串映射组件 */
const FEATURE_ICONS: Record<string, string> = {
  script: 'FileText',
  topic: 'Lightbulb',
  positioning: 'Target',
  freeChat: 'MessageCircle',
  storyboard: 'Film',
  review: 'CheckCircle',
  title: 'Tag',
  dealReason: 'DollarSign',
};

/**
 * 用户总数取自认证系统，而不是账号档案表。
 * 一个用户可以建多个档案，也可以一个都没建——拿档案数当用户数两头都不对。
 * listUsers 一页最多 1000，必须翻页，否则用户过千之后统计会停在第一页。
 */
export async function countAuthUsers(supabase: SupabaseClient): Promise<number> {
  let total = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('[admin-stats] 读取用户列表失败:', error.message);
      break;
    }
    total += data.users.length;
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 100) break; // 十万用户的兜底，防止分页出错时空转
  }
  return total;
}

/** 在指定时间之后注册的用户数 */
export async function countNewUsers(supabase: SupabaseClient, since: Date): Promise<number> {
  let count = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    count += data.users.filter((u) => u.created_at && new Date(u.created_at) >= since).length;
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 100) break;
  }
  return count;
}

export interface FeatureUsage {
  name: string;
  key: string;
  usage: number;
  icon: string;
}

/** 把所有用户的 user_quotas 行按功能加总，用量从高到低排 */
export function sumFeatureUsage(quotas: Record<string, unknown>[] | null | undefined): FeatureUsage[] {
  return COUNTED_FEATURES.map((f) => ({
    name: f.name,
    key: f.key as string,
    usage: (quotas ?? []).reduce((sum, q) => sum + (Number(q[f.column]) || 0), 0),
    icon: FEATURE_ICONS[f.key as string] || 'Activity',
  })).sort((a, b) => b.usage - a.usage);
}

export interface PlanDistribution {
  free: number;
  basic: number;
  pro: number;
  enterprise: number;
}

/**
 * 会员分布。没有订阅记录的用户算免费用户。
 * 用 max(0) 兜底：万一订阅记录比用户数还多（脏数据或统计口径偏差），
 * 也不该在页面上显示负数——那是改造前实际发生过的事。
 */
export function buildPlanDistribution(
  subs: { plan?: string | null; status?: string | null }[] | null | undefined,
  totalUsers: number
): { distribution: PlanDistribution; paidUsers: number } {
  const distribution: PlanDistribution = { free: 0, basic: 0, pro: 0, enterprise: 0 };
  let paidUsers = 0;

  for (const s of subs ?? []) {
    const plan = (s.plan || 'free') as keyof PlanDistribution;
    if (plan in distribution) {
      distribution[plan] += 1;
      if (plan !== 'free') paidUsers += 1;
    }
  }

  distribution.free = Math.max(0, totalUsers - paidUsers);
  return { distribution, paidUsers };
}
