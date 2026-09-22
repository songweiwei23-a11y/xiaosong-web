import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { getPlan, COUNTED_FEATURES, sumCountedUsage, judgeQuota } from '@/lib/config/plans';

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

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();

    const planId = subscription?.status === 'active' ? subscription.plan : 'free';
    const plan = getPlan(planId);

    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const empty = {
      warnings: [] as unknown[],
      exhausted: false,
      plan: planId,
      planName: plan.name,
      totalUsed: 0,
      totalLimit: plan.totalQuota === -1 ? 0 : plan.totalQuota ?? 0,
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
        totalLimit: plan.totalQuota,
      });
    }

    // ---- 分功能制（免费版）----
    const warnings = [];
    let hasExhausted = false;
    let totalLimit = 0;

    for (const feature of COUNTED_FEATURES) {
      const verdict = judgeQuota(planId, feature.key, quota);
      if (verdict.limit === -1) continue; // 无限的不参与警告
      totalLimit += verdict.limit;

      // 上限本来就是 0 的功能（免费版的分镜/审稿/标题等）不报警：
      // 它不是「用完了」，而是这个档位没有，天天提醒只会变成噪音
      if (verdict.limit === 0) continue;

      const percentage = Math.round((verdict.used / verdict.limit) * 100);
      if (verdict.remaining === 0) {
        hasExhausted = true;
        warnings.push({
          feature: feature.key,
          featureName: feature.name,
          used: verdict.used,
          total: verdict.limit,
          remaining: 0,
          percentage: 100,
        });
      } else if (percentage >= 80) {
        warnings.push({
          feature: feature.key,
          featureName: feature.name,
          used: verdict.used,
          total: verdict.limit,
          remaining: verdict.remaining,
          percentage,
        });
      }
    }

    return NextResponse.json({
      warnings,
      exhausted: hasExhausted,
      plan: planId,
      planName: plan.name,
      periodEnd: quota.current_period_end,
      totalUsed,
      totalLimit,
    });
  } catch (error: any) {
    console.error('[quota/check] 查询失败:', error);
    return NextResponse.json({ error: '额度查询失败' }, { status: 500 });
  }
}
