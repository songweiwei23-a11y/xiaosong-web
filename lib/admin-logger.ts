import { getServiceSupabase } from '@/lib/admin-auth';

/**
 * 管理员操作留痕。
 *
 * 【改造前这个函数什么也没做】它只 console.log 一行然后返回 success，
 * 从不写数据库。而生产构建配置了 removeConsole，连那一行日志也会被删掉。
 * 也就是说：审核订单、改用户套餐、封禁用户、授权管理员——
 * 这些涉及钱和权限的动作，线上没有留下任何记录。
 *
 * admin_logs 表是存在的（里面还躺着一条 2026-08 的历史记录，
 * 说明早先某个版本是真写过的，后来这个函数被改坏了）。
 *
 * 写入失败一律吞掉：留痕是附加动作，不该因为它让审核本身失败。
 * 但失败要 console.error——线上保留了 error 级别。
 */

export enum AdminActions {
  UPDATE_USER_MEMBERSHIP = 'update_user_membership',
  UPDATE_USER_QUOTA = 'update_user_quota',
  RESET_USER_QUOTA = 'reset_user_quota',
  BAN_USER = 'ban_user',
  UNBAN_USER = 'unban_user',
  DELETE_CONTENT = 'delete_content',
  UPDATE_SYSTEM_SETTINGS = 'update_system_settings',
  UPDATE_SETTINGS = 'update_settings',
  APPROVE_ORDER = 'approve_order',
  REJECT_ORDER = 'reject_order',
  DELETE_SETTING = 'delete_setting',
  RESET_SUBSCRIPTION_QUOTA = 'reset_subscription_quota',
  CHANGE_USER_PLAN = 'change_user_plan',
  GRANT_ADMIN = 'grant_admin',
  REVOKE_ADMIN = 'revoke_admin',
  GENERATE_INVITATIONS = 'generate_invitations',
  REVOKE_INVITATION = 'revoke_invitation',
}

interface LogOptions {
  admin_id: string;
  action: AdminActions | string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function logAdminAction(
  adminIdOrOptions: string | LogOptions,
  action?: AdminActions | string,
  details?: Record<string, unknown>
) {
  try {
    let adminId: string;
    let actionType: string;
    let targetType: string | undefined;
    let targetId: string | undefined;
    let actionDetails: Record<string, unknown>;

    if (typeof adminIdOrOptions === 'object') {
      adminId = adminIdOrOptions.admin_id;
      actionType = String(adminIdOrOptions.action);
      targetType = adminIdOrOptions.target_type;
      targetId = adminIdOrOptions.target_id;
      // 调用方有时把细节平铺在顶层，有时放在 details 里，两种都收
      const rest = { ...adminIdOrOptions } as Record<string, unknown>;
      delete rest.admin_id;
      delete rest.action;
      delete rest.target_type;
      delete rest.target_id;
      delete rest.details;
      actionDetails = { ...(adminIdOrOptions.details ?? {}), ...rest };
    } else {
      adminId = adminIdOrOptions;
      actionType = String(action ?? 'unknown');
      actionDetails = details ?? {};
    }

    if (!adminId) {
      console.error('[admin-logger] 缺少 admin_id，本次操作未留痕:', actionType);
      return { success: false };
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('admin_logs').insert({
      admin_id: adminId,
      action: actionType,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      // 表里 details 是 jsonb，直接给对象，不要先 JSON.stringify 成字符串
      details: actionDetails,
    });

    if (error) {
      console.error('[admin-logger] 写入失败:', error.message, { action: actionType });
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('[admin-logger] 异常:', error);
    return { success: false, error };
  }
}
