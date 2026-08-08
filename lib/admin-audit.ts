import { getServiceSupabase } from '@/lib/admin-auth';

/**
 * 记录管理员操作日志。
 * 需在 Supabase 创建 admin_logs 表：
 *   - id (uuid, pk, default gen_random_uuid())
 *   - created_at (timestamptz, default now())
 *   - admin_user_id (uuid, not null)
 *   - action (text, not null) — 例如 "update_quota", "grant_admin", "delete_user"
 *   - target_user_id (uuid, nullable)
 *   - details (jsonb, nullable) — 记录修改前后值、IP 等
 *
 * 调用方式：
 *   await logAdminAction(adminId, 'update_quota', targetUserId, { old: 10, new: 100 })
 */
export async function logAdminAction(
  adminUserId: string,
  action: string,
  targetUserId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('admin_logs').insert({
      admin_user_id: adminUserId,
      action,
      target_user_id: targetUserId || null,
      details: details || null,
    });
    if (error) {
      console.error('[admin-audit] 写入审计日志失败:', error);
    }
  } catch (err) {
    console.error('[admin-audit] 审计日志异常:', err);
  }
}
