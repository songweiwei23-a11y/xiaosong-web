import { supabase } from "@/lib/supabase/client";
import { getPlan, judgeQuota, sumCountedUsage } from '@/lib/config/plans';

/**
 * 保存生成历史记录到数据库
 * @param taskType - 任务类型（脚本生成、选题策划等）
 * @param inputData - 输入参数
 * @param result - 生成结果
 * @param workId - 所属作品。传了才会把这条记录挂到那条内容下，
 *                 不传就是一条零散记录——两种都合法，用户可能只是
 *                 拿别处的稿子来审一下，不必为此建作品。
 * @returns 是否保存成功
 */
export async function saveGenerationHistory(
  taskType: string,
  inputData: any,
  result: string,
  workId?: string | null
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
        work_id: workId || null,
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
 *
 * @param feature 功能代码。**必须传**——不传的话按「脚本生成」回答，
 *   各页面就会拿脚本的剩余次数去判断自己能不能用：免费版在分镜/审稿/
 *   标题页明明是 0 次却被放行，付费版则会被提前误报额度用完。
 * @returns 剩余配额数量，null 表示未登录，Infinity 表示无限制
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

    // 周期已过的话前端按满额显示，实际重置由服务端在下次请求时完成
    const periodOver = quota?.current_period_end
      ? new Date() > new Date(quota.current_period_end)
      : false;

    // 与服务端 requireUserWithQuota 用的是同一个判定函数，
    // 此前两边各写一套（前端按总量、服务端按单功能），结论会互相矛盾
    if (feature) {
      const verdict = judgeQuota(planId, feature, periodOver ? null : quota);
      return verdict.remaining === -1 ? Number.POSITIVE_INFINITY : verdict.remaining;
    }

    // 兜底：没传功能名时按总量算（付费版）或按脚本算（免费版）。
    // 这条路径不该被走到——走到了说明有调用方忘了传功能名，
    // 它给出的数字对别的功能没有参考意义。
    console.warn('[checkQuota] 未传功能名，返回的剩余次数可能不适用于当前功能');

    if (plan.totalQuota !== null) {
      if (plan.totalQuota === -1) return Number.POSITIVE_INFINITY;
      if (periodOver || !quota) return plan.totalQuota;
      return Math.max(0, plan.totalQuota - sumCountedUsage(quota));
    }

    const scriptLimit = plan.quotas.script;
    if (scriptLimit === -1) return Number.POSITIVE_INFINITY;
    if (periodOver || !quota) return scriptLimit;
    return Math.max(0, scriptLimit - (Number(quota.script_used) || 0));

  } catch (error) {
    console.error("检查配额异常:", error);
    return 0;
  }
}
