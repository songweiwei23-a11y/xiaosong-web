import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '@/lib/admin-auth';
import { getPlan } from '@/lib/config/plans';

export interface GuardResult {
  ok: boolean;
  userId?: string;
  response?: Response;
}

/**
 * API 守卫：仅要求已登录，不检查也不扣减配额。
 * 适用于 CRUD 类接口（读写自己的数据），生成类接口请用 requireUserWithQuota。
 *
 * - 未登录 -> 401
 */
export async function requireUser(): Promise<GuardResult> {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * API 守卫：要求已登录，并检查用户仍有可用配额（不扣减）。
 * 扣减由 incrementUsageServer 完成，应在 Dify 生成成功后调用。
 *
 * - 未登录 -> 401
 * - 超额   -> 402（需要付费/升级）
 */
export async function requireUserWithQuota(feature?: string): Promise<GuardResult> {
  const supabase = await getServerSupabase();
  const serviceSupabase = getServiceSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    };
  }

  // 获取用户订阅信息
  const { data: subscription } = await serviceSupabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single();

  // 如果用户被封禁
  if (subscription?.status === 'inactive') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '您的账户已被封禁，请联系管理员' },
        { status: 403 }
      ),
    };
  }

  const planId = subscription?.status === 'active' ? subscription.plan : 'free';
  const plan = getPlan(planId);

  // 企业版无限使用
  if (planId === 'enterprise') {
    return { ok: true, userId: user.id };
  }

  // 获取用户当前配额使用情况
  const { data: quota } = await serviceSupabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!quota) {
    // 如果没有配额记录，创建一个
    const { error: createError } = await serviceSupabase
      .from('user_quotas')
      .insert({ user_id: user.id });

    if (createError) {
      console.error('[api-guard] 创建配额记录失败:', createError);
    }
    
    // 新用户，允许继续
    return { ok: true, userId: user.id };
  }

  // 检查是否需要重置配额（周期已结束）
  const now = new Date();
  const periodEnd = new Date(quota.current_period_end || now);
  
  if (now > periodEnd) {
    // 自动重置配额
    await serviceSupabase
      .from('user_quotas')
      .update({
        knowledge_used: 0,
        positioning_used: planId === 'free' ? quota.positioning_used : 0, // 免费版定位永久
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
      .eq('user_id', user.id);

    // 重置后允许继续
    return { ok: true, userId: user.id };
  }

  // 检查具体功能的配额（如果指定了feature）
  if (feature) {
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
    if (quotaKey) {
      const allowedQuota = plan.quotas[quotaKey];
      const usedKey = `${feature.replace(/([A-Z])/g, '_$1').toLowerCase()}_used`;
      const currentUsed = quota[usedKey as keyof typeof quota] || 0;

      // 检查是否超额
      if (allowedQuota !== -1 && currentUsed >= allowedQuota) {
        return {
          ok: false,
          response: NextResponse.json(
            { 
              error: `${plan.name}额度已用完（${allowedQuota}次/月），请升级会员或等待下月重置`,
              used: currentUsed,
              limit: allowedQuota
            },
            { status: 402 }
          ),
        };
      }
    }
  } else {
    // 如果没有指定功能，检查总使用量（用于basic/pro套餐）
    if (planId === 'basic' || planId === 'pro') {
      const totalUsed = (
        (quota.script_used || 0) +
        (quota.topic_used || 0) +
        (quota.positioning_used || 0) +
        (quota.free_chat_used || 0) +
        (quota.storyboard_used || 0) +
        (quota.review_used || 0) +
        (quota.title_used || 0) +
        (quota.deal_reason_used || 0)
      );

      const totalLimit = plan.quotas.script; // basic=150, pro=500
      
      if (totalLimit !== -1 && totalUsed >= totalLimit) {
        return {
          ok: false,
          response: NextResponse.json(
            { 
              error: `${plan.name}总额度已用完（${totalLimit}次/月），请升级会员或等待下月重置`,
              used: totalUsed,
              limit: totalLimit
            },
            { status: 402 }
          ),
        };
      }
    }
  }

  return { ok: true, userId: user.id };
}

/**
 * 服务端配额扣减：在生成成功后由 API 路由调用，将对应功能的 used +1。
 * 使用 service_role 客户端直接原子操作，无竞态风险。
 * 若扣减失败仅记录日志，不影响已返回的流式内容。
 */
export async function incrementUsageServer(userId: string, feature: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    const featureMap: Record<string, string> = {
      knowledge: 'knowledge_used',
      positioning: 'positioning_used',
      topic: 'topic_used',
      script: 'script_used',
      freeChat: 'free_chat_used',
      storyboard: 'storyboard_used',
      review: 'review_used',
      title: 'title_used',
      dealReason: 'deal_reason_used'
    };

    const usedColumn = featureMap[feature];
    if (!usedColumn) {
      console.error('[api-guard] 未知的功能类型:', feature);
      return;
    }

    // 获取当前值
    const { data: quota } = await supabase
      .from('user_quotas')
      .select(usedColumn)
      .eq('user_id', userId)
      .single();

    if (quota) {
      const currentValue = (quota[usedColumn as keyof typeof quota] as number) || 0;
      
      // 更新 +1
      const { error: updateError } = await supabase
        .from('user_quotas')
        .update({ 
          [usedColumn]: currentValue + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[api-guard] incrementUsageServer update error:', updateError);
      } else {
        console.log(`[api-guard] 配额扣减成功: ${feature} -> ${currentValue + 1}`);
      }
    }
  } catch (err) {
    console.error('[api-guard] incrementUsageServer exception:', err);
  }
}
