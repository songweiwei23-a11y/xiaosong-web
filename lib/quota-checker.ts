import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 检查用户额度（使用数据库quota_plans表）
 * @param userId - 用户ID
 * @param feature - 功能名称
 * @returns { allowed: boolean, remaining: number, limit: number }
 */
export async function checkUserQuota(
  userId: string,
  feature: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  try {
    // 1. 检查账号是否激活
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_activated')
      .eq('user_id', userId)
      .single();
    
    if (!profile?.account_activated) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0
      };
    }
    
    // 2. 使用数据库函数获取用户额度限制
    const { data: limitData, error: limitError } = await supabase
      .rpc('get_user_quota_limit', {
        p_user_id: userId,
        p_feature: feature
      });
    
    if (limitError) {
      console.error('获取额度限制失败:', limitError);
      return { allowed: false, remaining: 0, limit: 0 };
    }
    
    const limit = limitData || 0;
    
    // 3. 获取已使用次数
    const usedColumn = `${feature}_used`;
    const { data: quota } = await supabase
      .from('user_quotas')
      .select(usedColumn)
      .eq('user_id', userId)
      .single();
    
    const used = (quota as any)?.[usedColumn] || 0;
    const remaining = Math.max(0, limit - used);
    
    return {
      allowed: remaining > 0,
      remaining,
      limit
    };
    
  } catch (error) {
    console.error('检查额度异常:', error);
    return { allowed: false, remaining: 0, limit: 0 };
  }
}

/**
 * 增加用户功能使用次数
 * @param userId - 用户ID
 * @param feature - 功能名称
 */
export async function incrementQuotaUsage(
  userId: string,
  feature: string
): Promise<boolean> {
  try {
    const usedColumn = `${feature}_used`;
    
    // 使用PostgreSQL的原子操作增加计数
    const { error } = await supabase
      .rpc('increment_quota_used', {
        p_user_id: userId,
        p_feature: feature
      });
    
    if (error) {
      console.error('增加使用次数失败:', error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('增加使用次数异常:', error);
    return false;
  }
}

/**
 * 获取用户所有功能的额度信息
 * @param userId - 用户ID
 */
export async function getUserQuotaSummary(userId: string) {
  try {
    // 获取用户套餐
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .single();
    
    const plan = subscription?.plan || 'free';
    
    // 获取额度配置
    const { data: planConfig } = await supabase
      .from('quota_plans')
      .select('*')
      .eq('plan_name', plan)
      .eq('is_active', true)
      .single();
    
    if (!planConfig) {
      return null;
    }
    
    // 获取已使用情况
    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    const features = [
      'script', 'topic', 'positioning', 'storyboard',
      'review', 'title', 'free_chat', 'deal_reason', 'knowledge'
    ];
    
    const summary: Record<string, any> = {
      plan,
      features: {}
    };
    
    features.forEach(feature => {
      const limitKey = `${feature}_limit`;
      const usedKey = `${feature}_used`;
      
      const limit = planConfig[limitKey] || 0;
      const used = quota?.[usedKey] || 0;
      const remaining = Math.max(0, limit - used);
      
      summary.features[feature] = {
        limit,
        used,
        remaining,
        percentage: limit > 0 ? Math.round((used / limit) * 100) : 0
      };
    });
    
    return summary;
    
  } catch (error) {
    console.error('获取额度摘要异常:', error);
    return null;
  }
}

