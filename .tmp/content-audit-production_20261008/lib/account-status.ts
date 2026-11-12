/**
 * 后台用户列表里的账号状态：只有真被封了才算「inactive」（界面显示已封禁）。
 *
 * 原来写的是 subscription?.status || 'inactive'——新注册的免费用户没有 subscriptions 行，
 * 于是一注册就显示「已封禁」（2026-09-30 线上两个新号都是这样，管理员只好挨个点解封）。
 * 真正的封禁看两处，和封禁按钮做的两件事对应（app/api/admin/users 的 ban_user）：
 *   1. 认证层 banned_until 还没到期（封禁按钮设的 ban_duration，登录会被拒）
 *   2. 订阅行被置成 inactive（额度守卫 lib/api-guard 读它，生成接口会 403）
 * 两处都没有，就是正常。
 */
export function accountStatus(
  bannedUntil: string | null | undefined,
  subStatus: string | null | undefined,
  now: number = Date.now()
): 'active' | 'inactive' {
  if (bannedUntil && new Date(bannedUntil).getTime() > now) return 'inactive';
  if (subStatus === 'inactive') return 'inactive';
  return 'active';
}
