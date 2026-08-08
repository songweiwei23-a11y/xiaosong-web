import { supabase } from "@/lib/supabase/client";
import { notify } from '@/components/ui/feedback';

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
 * 增加用户使用次数
 * @returns 是否成功
 */
export async function incrementUsage(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return false;
    }

    const userId = session.user.id;

    // 获取当前设置
    const { data: settings, error: fetchError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError || !settings) {
      console.error("获取用户设置失败:", fetchError);
      return false;
    }

    // 检查配额
    if (settings.quota_used >= settings.quota_limit) {
      notify("❌ 已达到使用次数上限，请升级会员或联系管理员");
      return false;
    }

    // 增加使用次数
    const { error: updateError } = await supabase
      .from("user_settings")
      .update({ quota_used: settings.quota_used + 1 })
      .eq("user_id", userId);

    if (updateError) {
      console.error("更新使用次数失败:", updateError);
      return false;
    }

    console.log("✅ 使用次数已更新:", settings.quota_used + 1);
    return true;
  } catch (error) {
    console.error("增加使用次数异常:", error);
    return false;
  }
}

/**
 * 检查用户配额
 * @returns 剩余次数，null表示未登录
 */
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
      .single();

    if (!settings) {
      return 0;
    }

    return settings.quota_limit - settings.quota_used;
  } catch (error) {
    console.error("检查配额异常:", error);
    return 0;
  }
}
