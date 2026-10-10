/**
 * 后台权限矩阵（2026-10-10 巡检 L2）。
 *
 * 原来所有管理员都只调 requireAdmin()，不论角色，权限完全一样：运营也能删用户、授予管理员。
 * 现在按动作分权限，路由用 requireAdminPermission(perm) 校验。
 *
 * 默认值的取舍（产品方可以改）：
 *   - admin、developer：全部权限。这是现有管理员的既有行为，不改变他们能做的事。
 *   - operator（运营）：日常审单、改会员、封禁、看内容。不能授权管理员、删用户、改收款码、换密钥、导出。
 *   - 其它角色：一律没有权限（默认拒绝）。
 */

export type AdminPermission =
  | 'manage_admins'      // 授予、撤销管理员
  | 'delete_user'        // 删除用户（不可恢复）
  | 'manage_users'       // 封禁、解封、重置密码、清额度
  | 'manage_membership'  // 改套餐、到期日、延期、重置订阅额度
  | 'review_orders'      // 通过或驳回订单
  | 'manage_invitations' // 生成、作废邀请码
  | 'manage_payments'    // 收款二维码的上传、启用、停用
  | 'manage_secrets'     // 联网搜索密钥
  | 'export_data'        // 导出 CSV
  | 'view_content';      // 查看用户的生成全文

const ALL: readonly AdminPermission[] = [
  'manage_admins', 'delete_user', 'manage_users', 'manage_membership', 'review_orders',
  'manage_invitations', 'manage_payments', 'manage_secrets', 'export_data', 'view_content',
];

export const ROLE_PERMISSIONS: Record<string, readonly AdminPermission[]> = {
  developer: ALL,
  admin: ALL,
  operator: ['manage_users', 'manage_membership', 'review_orders', 'manage_invitations', 'view_content'],
};

/** 角色是否拥有某项权限。未知角色一律 false（默认拒绝） */
export function hasPermission(role: string | null | undefined, perm: AdminPermission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(perm);
}
