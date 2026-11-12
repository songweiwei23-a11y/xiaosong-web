import { randomInt } from 'node:crypto';

/**
 * 密码相关的纯逻辑。只在服务端用（依赖 node:crypto）。
 *
 * 【为什么"忘记密码"不走邮件】
 * 常规做法是 resetPasswordForEmail 发一封重置邮件。但这个项目
 * **没有配置发信服务**（见 app/api/auth/register/route.ts 里的
 * email_confirm: true），用户邮箱也从未验证过——做一个发邮件的按钮，
 * 就是一个点了没反应的按钮。
 *
 * 所以按现在的运营方式来：用户找客服微信 → 管理员在后台一键重置，
 * 拿到临时密码发给他 → 他登录后在「我的账户」里自己改掉。
 * 等以后配了发信服务，再加自助找回。
 */

/** 注册时的下限就是 6 位，改密码不能比注册还松，也不能更严（老用户会改不了） */
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt 只看前 72 字节，再长没有意义

/**
 * 临时密码去掉容易认错的字符。
 * 它是要人工抄给用户（多半是微信发过去）再由用户手输的，
 * 0/O、1/l/I 认错一个就登不进去，又得再重置一次。
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** 生成临时密码。用 crypto.randomInt，不用 Math.random——后者不适合做凭证 */
export function generateTempPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** 校验新密码，返回给用户看的错误；合法返回 null */
export function validateNewPassword(pw: unknown, current?: string): string | null {
  if (typeof pw !== 'string') return '请填写新密码';
  if (pw.length < MIN_PASSWORD_LENGTH) return `新密码至少 ${MIN_PASSWORD_LENGTH} 位`;
  if (pw.length > MAX_PASSWORD_LENGTH) return `新密码最多 ${MAX_PASSWORD_LENGTH} 位`;
  if (/^\s|\s$/.test(pw)) return '密码首尾不能是空格';
  if (current !== undefined && pw === current) return '新密码不能和当前密码一样';
  return null;
}
