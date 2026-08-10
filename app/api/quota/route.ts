import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getPlan } from '@/lib/config/plans';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, feature } = await request.json();

    if (!userId || !feature) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 获取用户订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single();

    const planId = subscription?.status === 'active' ? subscription.plan : 'free';
    const plan = getPlan(planId);

    // 获取用户当前额度
    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quota) {
      // 如果不存在，创建一个
      const { data: newQuota, error: createError } = await supabase
        .from('user_quotas')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: '创建额度记录失败' }, { status: 500 });
      }
    }

    // 检查是否需要重置额度（周期已结束）
    const now = new Date();
    const periodEnd = new Date(quota?.current_period_end || now);
    
    if (now > periodEnd) {
      // 重置额度
      await supabase
        .from('user_quotas')
        .update({
          knowledge_used: 0,
          positioning_used: planId === 'free' ? quota?.positioning_used : 0,
          topic_used: 0,
          script_used: 0,
          free_chat_used: 0,
          storyboard_used: 0,
          review_used: 0,
          title_used: 0,
          deal_reason_used: 0,
          current_period_start: now.toISOString(),
          current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', userId);

      // 重新获取
      const { data: refreshedQuota } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (refreshedQuota) {
        quota.knowledge_used = refreshedQuota.knowledge_used;
        quota.positioning_used = refreshedQuota.positioning_used;
        quota.topic_used = refreshedQuota.topic_used;
        quota.script_used = refreshedQuota.script_used;
        quota.free_chat_used = refreshedQuota.free_chat_used;
        quota.storyboard_used = refreshedQuota.storyboard_used;
        quota.review_used = refreshedQuota.review_used;
        quota.title_used = refreshedQuota.title_used;
        quota.deal_reason_used = refreshedQuota.deal_reason_used;
      }
    }

    // 获取功能对应的配额
    const featureMap: Record<string, keyof typeof plan.quotas> = {
      knowledge: 'knowledge',
      positioning: 'positioning',
      topic: 'topic',
      script: 'script',
      freeChat: 'freeChat',
      storyboard: 'storyboard',
      review: 'review',
      title: 'title',
      dealReason: 'dealReason'
    };

    const quotaKey = featureMap[feature];
    if (!quotaKey) {
      return NextResponse.json({ error: '未知功能' }, { status: 400 });
    }

    const allowedQuota = plan.quotas[quotaKey];
    const usedKey = `${feature.replace(/([A-Z])/g, '_$1').toLowerCase()}_used`;
    const currentUsed = quota?.[usedKey as keyof typeof quota] || 0;

    // 检查是否超额
    if (allowedQuota !== -1 && currentUsed >= allowedQuota) {
      return NextResponse.json({ 
        allowed: false, 
        message: `${planId === 'free' ? '免费' : plan.name}额度已用完，请升级会员`,
        remaining: 0
      }, { status: 403 });
    }

    // 扣除额度
    const { error: updateError } = await supabase
      .from('user_quotas')
      .update({ 
        [usedKey]: currentUsed + 1,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      return NextResponse.json({ error: '更新额度失败' }, { status: 500 });
    }

    const remaining = allowedQuota === -1 ? '无限' : allowedQuota - currentUsed - 1;

    return NextResponse.json({ 
      allowed: true, 
      remaining,
      plan: planId,
      message: '额度扣除成功'
    });

  } catch (error: any) {
    console.error('Quota check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 查询剩余额度
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    // 获取用户订阅
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single();

    const planId = subscription?.status === 'active' ? subscription.plan : 'free';
    const plan = getPlan(planId);

    // 获取当前使用情况
    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quota) {
      return NextResponse.json({ 
        plan: planId,
        quotas: plan.quotas,
        used: {}
      });
    }

    return NextResponse.json({
      plan: planId,
      planName: plan.name,
      quotas: plan.quotas,
      used: {
        knowledge: quota.knowledge_used,
        positioning: quota.positioning_used,
        topic: quota.topic_used,
        script: quota.script_used,
        freeChat: quota.free_chat_used,
        storyboard: quota.storyboard_used,
        review: quota.review_used,
        title: quota.title_used,
        dealReason: quota.deal_reason_used
      },
      periodEnd: quota.current_period_end
    });

  } catch (error: any) {
    console.error('Get quota error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}