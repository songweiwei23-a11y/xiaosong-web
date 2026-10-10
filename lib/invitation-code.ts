import { randomInt } from 'node:crypto';

/** 去掉了 0/O/1/I/L，口头转述和手抄时最容易认错 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITATION_CODE_LENGTH = 8;

export function generateInvitationCode(): string {
  let s = '';
  for (let i = 0; i < INVITATION_CODE_LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return 'XS' + s;
}

/** 用户输入的码：去空格、转大写；只允许字母数字和连字符，不让通配符进查询 */
export function normalizeInvitationCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9-]{4,32}$/.test(code) ? code : null;
}
