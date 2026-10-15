/**
 * 首页访问码的规则（2026-10-15）。纯函数，前后端共用：后台生成、校验，接口再校验一遍。
 *
 * 8–64 位，只用字母、数字、短横线和下划线。去掉了容易看错的 0 O 1 I l，方便念、方便抄。
 */

export const SITE_ACCESS_CODE_MIN = 8;
export const SITE_ACCESS_CODE_MAX = 64;
const SITE_ACCESS_CODE_RE = /^[A-Za-z0-9_-]+$/;
const GENERATE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function validSiteAccessCode(code: unknown): code is string {
  return typeof code === 'string'
    && code.length >= SITE_ACCESS_CODE_MIN
    && code.length <= SITE_ACCESS_CODE_MAX
    && SITE_ACCESS_CODE_RE.test(code);
}

/** 随机生成一个 12 位的访问码（密码学随机数，不用 Math.random） */
export function generateSiteAccessCode(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => GENERATE_ALPHABET[b % GENERATE_ALPHABET.length]).join('');
}
