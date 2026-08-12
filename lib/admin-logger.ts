export enum AdminActions {
  UPDATE_USER_MEMBERSHIP = 'update_user_membership',
  UPDATE_USER_QUOTA = 'update_user_quota',
  RESET_USER_QUOTA = 'reset_user_quota',
  BAN_USER = 'ban_user',
  UNBAN_USER = 'unban_user',
  DELETE_USER = 'delete_user',
  FORCE_LOGOUT = 'force_logout',
  DELETE_CONTENT = 'delete_content',
  UPDATE_SYSTEM_SETTINGS = 'update_system_settings',
  UPDATE_SETTINGS = 'update_settings',
  APPROVE_ORDER = 'approve_order',
  REJECT_ORDER = 'reject_order',
  DELETE_SETTING = 'delete_setting',
  RESET_SUBSCRIPTION_QUOTA = 'reset_subscription_quota',
  CHANGE_USER_PLAN = 'change_user_plan',
}

export async function logAdminAction(
  adminIdOrOptions: string | { admin_id: string; action: AdminActions; [key: string]: any },
  action?: AdminActions,
  details?: Record<string, any>
) {
  try {
    let adminId: string;
    let actionType: AdminActions;
    let actionDetails: Record<string, any>;

    if (typeof adminIdOrOptions === 'object') {
      adminId = adminIdOrOptions.admin_id;
      actionType = adminIdOrOptions.action;
      actionDetails = { ...adminIdOrOptions };
      delete actionDetails.admin_id;
      delete actionDetails.action;
    } else {
      adminId = adminIdOrOptions;
      actionType = action!;
      actionDetails = details || {};
    }

    const logEntry = {
      admin_id: adminId,
      action: actionType,
      details: JSON.stringify(actionDetails),
      ip_address: 'N/A',
      timestamp: new Date().toISOString(),
    };

    console.log(`[缁狅紕鎮婇崨妯绘）韫囨 ${actionType}:`, logEntry);

    return { success: true };
  } catch (error) {
    console.error('[缁狅紕鎮婇崨妯绘）韫囨 鐠佹澘缍嶆径杈Е:', error);
    return { success: false, error };
  }
}
