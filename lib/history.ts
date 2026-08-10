import { supabase } from "@/lib/supabase/client";
import { getPlan } from '@/lib/config/plans';

/**
 * 保存生成历史记录到数据库
 * @param taskType - 任务类型（脚本生成、选题策划等）
 * @param inputData - 输入参数
 * @param result - 生成结果
 * @returns 是否保存成功
 */
export async function saveGenerationHistory(
  taskType: string,
  inputData: any,
  result: string
): Promise<boolean> {
  try {
    console.log("💾 保存生成历史记录...");
    
    // 获取当前用户
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn("⚠️ 未登录，无法保存历史记录");
      return false;
    }

    const userId = session.user.id;

    // 保存到数据库
    const { error } = await supabase
      .from("script_history")
      .insert({
        user_id: userId,
        task_type: taskType,
        input_data: inputData,
        result: result,
      });

    if (error) {
      console.error("❌ 保存历史记录失败:", error);
      return false;
    }

    console.log("✅ 历史记录已保存");
    return true;
  } catch (error) {
    console.error("❌ 保存历史记录异常:", error);
    return false;
  }
}

/**
 * 检查用户配额（新系统：使用 user_quotas + subscriptions 表）
 * @returns 剩余配额数量，null表示未登录，Infinity表示无限制
 */
export async function checkQuota(feature?: string): Promise<number | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    const userId = session.user.id;

    // 获取用户订阅信息
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle();

    // 如果用户被封禁
    if (subscription?.status === 'inactive') {
      return 0;
    }

    const planId = subscription?.status === 'active' ? subscription.plan : 'free';
    const plan = getPlan(planId);

    // 企业版无限使用
    if (planId === 'enterprise') {
      return Number.POSITIVE_INFINITY;
    }

    // 获取用户配额使用情况
    const { data: quota } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!quota) {
      // 新用户，返回对应套餐的初始配额
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
          return allowedQuota === -1 ? Number.POSITIVE_INFINITY : allowedQuota;
        }
      }
      // 返回基础套餐的总配额
      const totalLimit = plan.quotas.script;
      return totalLimit === -1 ? Number.POSITIVE_INFINITY : totalLimit;
    }

    // 检查是否需要重置配额（周期已结束）
    const now = new Date();
    const periodEnd = new Date(quota.current_period_end || now);
    
    if (now > periodEnd) {
      // 周期结束，返回满额配额（前端显示用，实际重置由后端处理）
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
          return allowedQuota === -1 ? Number.POSITIVE_INFINITY : allowedQuota;
        }
      }
      const totalLimit = plan.quotas.script;
      return totalLimit === -1 ? Number.POSITIVE_INFINITY : totalLimit;
    }

    // 检查具体功能的配额
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

        if (allowedQuota === -1) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.max(0, allowedQuota - currentUsed);
      }
    }

    // 如果没有指定功能，返回总配额剩余（用于basic/pro套餐）
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
      
      if (totalLimit === -1) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.max(0, totalLimit - totalUsed);
    }

    // 免费版：返回脚本生成的剩余配额作为默认值
    const scriptUsed = quota.script_used || 0;
    const scriptLimit = plan.quotas.script;
    
    if (scriptLimit === -1) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, scriptLimit - scriptUsed);

  } catch (error) {
    console.error("检查配额异常:", error);
    return 0;
  }
}
