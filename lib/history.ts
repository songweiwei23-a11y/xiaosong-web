import { supabase } from "@/lib/supabase/client";
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

export async function checkQuota(): Promise<number | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    const userId = session.user.id;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("quota_used, quota_limit")
      .eq("user_id", userId)
      .maybeSingle();

    // 无 settings 记录 或 quota_limit 为 null → 视为未设限（与服务端守卫一致）
    if (!settings || settings.quota_limit == null) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, settings.quota_limit - (settings.quota_used ?? 0));
  } catch (error) {
    console.error("检查配额异常:", error);
    return 0;
  }
}
