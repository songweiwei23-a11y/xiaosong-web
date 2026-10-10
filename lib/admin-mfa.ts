/**
 * 管理员二次验证（2026-10-10 巡检：管理员 MFA）。
 *
 * 规则：已经绑定验证器（TOTP）的管理员，每个会话都要先输入一次性验证码（AAL2），
 * 否则后台接口一律当成「没有管理员权限」。没有绑定的管理员不受影响，
 * 所以不会因为这项改动把人锁在门外；绑定入口在「账号安全」页。
 *
 * Supabase 的 AAL：aal1 = 只用了密码；aal2 = 也通过了第二步。
 * getAuthenticatorAssuranceLevel() 返回 currentLevel 和 nextLevel：
 * 当 nextLevel 是 aal2 而 currentLevel 不是，说明这个账号绑了验证器，但本次会话还没验。
 */

export interface AalInfo {
  currentLevel?: string | null;
  nextLevel?: string | null;
}

/** 纯函数：这个会话是否还差第二步验证 */
export function mfaStepPending(aal: AalInfo | null | undefined): boolean {
  if (!aal) return false;
  return aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
}
