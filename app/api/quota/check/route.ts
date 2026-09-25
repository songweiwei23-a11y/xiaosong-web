import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { getPlan, COUNTED_FEATURES, sumCountedUsage, judgeQuota, effectivePlanId } from '@/lib/config/plans';
import { monthStartShanghai } from '@/lib/usage-month';

/**
 * 本月（北京时间自然月）实际生成了几次。
 *
 * 读 usage_events：每次成功生成记一条、只增不删。计数器 totalUsed 跟着订阅周期滚，
 * 和"本月"对不上，而且企业版的周期曾经一直没重置过（见 api-guard），首页因此长期显示 0。
 * 表还没建（迁移没跑）时退回数本月的生成记录——删过记录会少算，但总比 0 接近真相。
 */
async function countMonthUsage(supabase: ReturnType<typeof getServiceSupabase>, userId: string): Promise<number> {
  const since = monthStartShanghai().toISOString();
  const events = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (!events.error) return events.count ?? 0;

  const history = await supabase
    .from('script_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  return history.count ?? 0;
}

/**
 * 当前登录用户的额度概况：已用多少、还剩多少、哪些功能快见底了。
 *
 * 用户身份从登录会话取，不再从 URL 参数取。
 * 此前是 `?userId=<任意uuid>` + service_role，等于任何人（含未登录的）
 * 都能查到别人的套餐和全部用量。参数保留但忽略，老页面不会因此报错。
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const userId = guard.userId!;

  try {
    // 身份已确认，用 service_role 读自己的两张表，不受 RLS 配置差异影响
    const supabase = getServiceSupabase();

    /*
     * 两张表一起查。
     *
     * 原来是串行：先 await subscriptions，回来了再 await user_quotas。
     * 这两条查询互不依赖，却要排队——实测每条往返 0.9 秒，
     * 白白多花将近一秒。而这个接口是工作台首页四个并发请求里最慢的一条，
     * 整个页面都在等它。
     */
    const [{ data: subscription }, { data: quota }] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan, status, end_date')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    // 与 api-guard 共用同一份到期判定，两边不能各写各的
    const planId = effectivePlanId(subscription);
    const plan = getPlan(planId);
    const monthUsed = await countMonthUsage(supabase, userId);

    const empty = {
      warnings: [] as unknown[],
      exhausted: false,
      plan: planId,
      planName: plan.name,
      totalUsed: 0,
      totalLimit: plan.totalQuota === -1 ? 0 : plan.totalQuota ?? 0,
      monthUsed,
    };

    if (!quota) return NextResponse.json(empty);

    // 周期已结束 = 额度即将在下次请求时重置，此刻不该报警
    if (quota.current_period_end && new Date() > new Date(quota.current_period_end)) {
      return NextResponse.json({ ...empty, periodEnd: quota.current_period_end });
    }

    const totalUsed = sumCountedUsage(quota);

    // ---- 总量制（基础/专业/企业）----
    // 这些套餐只有一个池子，逐功能报警没有意义，用户关心的是总数还剩多少
    if (plan.totalQuota !== null) {
      if (plan.totalQuota === -1) {
        return NextResponse.json({
          warnings: [],
          exhausted: false,
          plan: planId,
          planName: plan.name,
          periodEnd: quota.current_period_end,
          totalUsed,
          monthUsed,
          totalLimit: 0, // 0 表示不限量，前端只显示用量
        });
      }

      const remaining = Math.max(0, plan.totalQuota - totalUsed);
      const percentage = Math.round((totalUsed / plan.totalQuota) * 100);
      const warnings =
        percentage >= 80
          ? [{
              feature: 'total',
              featureName: '全部功能',
              used: totalUsed,
              total: plan.totalQuota,
              remaining,
              percentage: Math.min(100, percentage),
            }]
          : [];

      return NextResponse.json({
        warnings,
        exhausted: remaining === 0,
        plan: planId,
        planName: plan.name,
        periodEnd: quota.current_period_end,
        totalUsed,
        monthUsed,
        totalLimit: plan.totalQuota,
      });
    }

    // ---- 分功能制（免费版、基础版、专业版）----
    const warnings = [];
    let hasExhausted = false;
    /** 用得最紧的那个功能，用于在首页点名，而不是只给一个没意义的总数 */
    let tightest: { featureName: string; used: number; total: number; remaining: number; percentage: number } | null = null;

    for (const feature of COUNTED_FEATURES) {
      const verdict = judgeQuota(planId, feature.key, quota);
      if (verdict.limit === -1) continue; // 无限的不参与警告

      // 上限本来就是 0 的功能（免费版的分镜/审稿/标题等）不报警：
      // 它不是「用完了」，而是这个档位没有，天天提醒只会变成噪音
      if (verdict.limit === 0) continue;

      const percentage = Math.round((verdict.used / verdict.limit) * 100);
      const row = {
        feature: feature.key,
        featureName: feature.name,
        used: verdict.used,
        total: verdict.limit,
        remaining: verdict.remaining,
        percentage: Math.min(100, percentage),
      };

      if (!tightest || percentage > tightest.percentage) {
        tightest = {
          featureName: row.featureName,
          used: row.used,
          total: row.total,
          remaining: row.remaining,
          percentage: row.percentage,
        };
      }

      if (verdict.remaining === 0) {
        hasExhausted = true;
        warnings.push(row);
      } else if (percentage >= 80) {
        warnings.push(row);
      }
    }

    return NextResponse.json({
      warnings,
      exhausted: hasExhausted,
      plan: planId,
      planName: plan.name,
      periodEnd: quota.current_period_end,
      totalUsed,
      monthUsed,
      /*
       * 分功能制下不给总分母。
       *
       * 各功能额度加起来（基础版 8×50=400）是个真实存在但会误导人的数字：
       * 用户看到「20 / 400」会以为还早得很，实际他的脚本生成可能已经
       * 50 次用满。首页因此改为只显示已用次数，另外点名最紧的那个功能。
       */
      totalLimit: 0,
      tightest,
    });
  } catch (error: any) {
    console.error('[quota/check] 查询失败:', error);
    return NextResponse.json({ error: '额度查询失败' }, { status: 500 });
  }
}
