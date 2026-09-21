import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getPlan } from '@/lib/config/plans';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    // 获取用户订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single();

    const planId = subscription?.status === 'active' ? subscription.plan : 'free';
    const plan = getPlan(planId);

    // 获取用户配额使用情况
    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quota) {
      return NextResponse.json({
        warnings: [],
        exhausted: false,
        plan: planId,
        planName: plan.name
      });
    }

    // 检查是否需要重置配额（周期已结束）
    const now = new Date();
    const periodEnd = new Date(quota.current_period_end || now);
    
    if (now > periodEnd) {
      // 周期已结束，额度已重置，无需警告
      return NextResponse.json({
        warnings: [],
        exhausted: false,
        plan: planId,
        planName: plan.name
      });
    }

    // 检查各功能额度并生成警告
    const warnings: Array<{
      feature: string;
      featureName: string;
      used: number;
      total: number;
      remaining: number;
      percentage: number;
    }> = [];

    let hasExhausted = false;

    const features = [
      { key: 'script', name: '脚本生成', usedField: 'script_used' },
      { key: 'topic', name: '选题策划', usedField: 'topic_used' },
      { key: 'positioning', name: '账号定位', usedField: 'positioning_used' },
      { key: 'freeChat', name: '自由对话', usedField: 'free_chat_used' },
      { key: 'storyboard', name: '分镜脚本', usedField: 'storyboard_used' },
      { key: 'review', name: '脚本评审', usedField: 'review_used' },
      { key: 'title', name: '标题生成', usedField: 'title_used' },
      { key: 'dealReason', name: '成交理由', usedField: 'deal_reason_used' },
    ];

    // 全部功能的合计。首页要显示「本月已用多少次」，此前接口只给
    // 接近上限的那几项警告，拿不到总数，页面上只能显示 0。
    // 无限额度的功能计入已用但不计入上限，否则总额会变成 -1 的累加。
    let totalUsed = 0;
    let totalLimit = 0;
    let unlimited = false;

    for (const feature of features) {
      const quotaKey = feature.key as keyof typeof plan.quotas;
      const allowedQuota = plan.quotas[quotaKey];
      const usedCount = Number(quota[feature.usedField as keyof typeof quota] || 0);
      totalUsed += usedCount;

      if (allowedQuota === -1) {
        unlimited = true;
      } else {
        totalLimit += allowedQuota;
      }

      // -1 表示无限制，不参与额度警告
      if (allowedQuota === -1) continue;

      const used = quota[feature.usedField as keyof typeof quota] || 0;
      const remaining = Math.max(0, allowedQuota - used);
      const percentage = allowedQuota > 0 ? (used / allowedQuota) * 100 : 0;

      // 额度用尽
      if (remaining === 0) {
        hasExhausted = true;
        warnings.push({
          feature: feature.key,
          featureName: feature.name,
          used,
          total: allowedQuota,
          remaining: 0,
          percentage: 100
        });
      }
      // 额度不足20%
      else if (percentage >= 80) {
        warnings.push({
          feature: feature.key,
          featureName: feature.name,
          used,
          total: allowedQuota,
          remaining,
          percentage: Math.round(percentage)
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
      // 有任一功能不限量时，总上限没有意义，返回 0 让前端只显示用量
      totalLimit: unlimited ? 0 : totalLimit
    });

  } catch (error: any) {
    console.error('Quota check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}