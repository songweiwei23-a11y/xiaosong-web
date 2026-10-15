/**
 * 首页应急登录（2026-10-17）：门票丢了的管理员，在提示页用「邮箱 + 密码 + 验证器码」换一台设备的通行。
 *
 * 规则：
 * - 默认关闭，后台「首页门票」里开关；关闭时一律失败。
 * - 只有绑定了验证器（TOTP）的管理员账号能用。没绑定的不接受密码登录。
 * - 密码、验证码对了，还要是管理员身份，三者都满足才发通行。
 * - 失败只说「不能用应急登录」，不说是哪一步错，免得被拿来探测账号。
 *
 * 这里只是流程，每一步的真实动作（登录、查管理员、校验验证码、发通行）由调用方注入。
 */

export interface AdminLoginInput {
  email: string;
  password: string;
  code: string;
}

/** 检查提交的内容格式。不合格返回 null（不告诉具体哪里不对） */
export function parseAdminLogin(body: unknown): AdminLoginInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const code = typeof b.code === 'string' ? b.code.replace(/\s/g, '') : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (password.length < 6 || password.length > 200) return null;
  if (!/^\d{6}$/.test(code)) return null;
  return { email, password, code };
}

export interface AdminLoginDeps {
  /** 应急登录开着吗 */
  enabled: () => Promise<boolean>;
  /** 邮箱 + 密码能登录吗。返回用户编号；不对返回 null */
  signIn: (email: string, password: string) => Promise<{ userId: string } | null>;
  /** 这个账号是管理员吗 */
  isAdmin: (userId: string) => Promise<boolean>;
  /** 验证器码对吗。没绑定验证器也返回 false */
  verifyTotp: (userId: string, code: string) => Promise<boolean>;
  /** 给这个管理员发一台设备的通行，返回 Cookie 原文 */
  issuePass: (userId: string) => Promise<string>;
}

export type AdminLoginOutcome = { ok: true; userId: string; devicePass: string } | { ok: false };

export async function adminEmergencyLogin(input: AdminLoginInput, deps: AdminLoginDeps): Promise<AdminLoginOutcome> {
  if (!(await deps.enabled())) return { ok: false };
  const session = await deps.signIn(input.email, input.password);
  if (!session) return { ok: false };
  if (!(await deps.isAdmin(session.userId))) return { ok: false };
  if (!(await deps.verifyTotp(session.userId, input.code))) return { ok: false };
  return { ok: true, userId: session.userId, devicePass: await deps.issuePass(session.userId) };
}

/** 日志和告警里用的邮箱：只留开头两个字和域名，不记完整邮箱 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '***';
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}
