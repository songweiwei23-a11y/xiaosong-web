/**
 * 后台权限矩阵。
 *
 * 2026-10-10 巡检 L2：原来所有管理员都只调 requireAdmin()，不论角色，权限完全一样。
 * 2026-10-22（后台扩展方案 P0-5、P1-1）：
 *   - 每个接口都用 requireAdminPermission(perm) 声明自己要的权限（读取类也一样），不再只看「是不是管理员」；
 *   - 未知角色一律拒绝（默认拒绝）：requireAdmin() 不认识的角色直接返回 null；
 *   - 新增只读类权限（view_*）和三个新角色（finance、support、analyst），新角色目前没有分配给任何人。
 *
 * 现有角色的权限没有减少，只新增了显式的读取权限。唯一的收紧（已列入方案）：
 *   operator 不再能看审计日志（view_logs）和管理员名单（view_admins）。
 */

export type AdminPermission =
  // —— 写操作（原有）——
  | 'manage_admins'      // 授予、撤销管理员
  | 'delete_user'        // 删除用户（不可恢复）
  | 'manage_users'       // 封禁、解封、重置密码、清额度
  | 'manage_membership'  // 改套餐、到期日、延期、重置订阅额度
  | 'review_orders'      // 通过或驳回订单
  | 'manage_invitations' // 生成、作废邀请码
  | 'manage_payments'    // 收款二维码的上传、启用、停用
  | 'manage_secrets'     // 联网搜索密钥
  | 'manage_quality'     // 启动一次完整的质量回归（会调用模型，有成本）
  | 'export_data'        // 导出 CSV
  | 'view_content'       // 查看用户的生成全文（必须写理由，见 record 接口）
  // —— 读取（新增，显式声明）——
  | 'view_dashboard'     // 概览、统计、漏斗
  | 'view_users'         // 用户列表与详情、订阅列表
  | 'view_orders'        // 订单列表、收款码
  | 'view_monitor'       // 实时监控大屏（不含全文）
  | 'view_analytics'     // 数据分析、学习统计
  | 'view_quality'       // 质量检查、用户反馈
  | 'view_usage'         // 用量监控、额度对账记录
  | 'view_system'        // 健康检查、迁移状态
  | 'view_logs'          // 审计日志（谁在什么时候做了什么）
  | 'view_admins';       // 管理员名单

const ALL: readonly AdminPermission[] = [
  'manage_admins', 'delete_user', 'manage_users', 'manage_membership', 'review_orders',
  'manage_invitations', 'manage_payments', 'manage_secrets', 'manage_quality', 'export_data', 'view_content',
  'view_dashboard', 'view_users', 'view_orders', 'view_monitor', 'view_analytics', 'view_quality',
  'view_usage', 'view_system', 'view_logs', 'view_admins',
];

export const ROLE_PERMISSIONS: Record<string, readonly AdminPermission[]> = {
  // 现有角色：开发者和管理员，全部权限（与之前一致）
  developer: ALL,
  admin: ALL,
  // 现有角色：运营。与之前相比：不再能看审计日志和管理员名单（见文件顶部说明）
  operator: [
    'manage_users', 'manage_membership', 'review_orders', 'manage_invitations', 'view_content',
    'view_dashboard', 'view_users', 'view_orders', 'view_monitor', 'view_analytics', 'view_quality',
    'view_usage', 'view_system',
  ],
  // 新角色（尚未分配给任何人）：财务。查订单和收入，审单，导出财务数据；不看内容、不改额度
  finance: [
    'review_orders', 'view_orders', 'view_dashboard', 'view_analytics', 'export_data',
  ],
  // 新角色（尚未分配）：客服。查用户和订单，处理封禁、重置密码、清额度；不改会员、不审单、不看全文
  support: [
    'view_users', 'view_orders', 'view_dashboard', 'manage_users',
  ],
  // 新角色（尚未分配）：只读分析。看汇总和监控，不看用户内容，不做任何写入
  analyst: [
    'view_dashboard', 'view_analytics', 'view_monitor', 'view_usage',
  ],
};

/** 认得的角色（只有这些角色能进后台；其它角色视为无权限） */
export function isKnownRole(role: string | null | undefined): boolean {
  return !!role && Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role);
}

/** 角色是否拥有某项权限。未知角色一律 false（默认拒绝） */
export function hasPermission(role: string | null | undefined, perm: AdminPermission): boolean {
  if (!isKnownRole(role)) return false;
  return (ROLE_PERMISSIONS[role!] ?? []).includes(perm);
}
