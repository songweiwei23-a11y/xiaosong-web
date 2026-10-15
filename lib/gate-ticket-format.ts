/**
 * 首页门票的纯规则（2026-10-16）：前后端共用，不碰数据库。
 * 门口的提示页、后台的门票列表、服务端的兑换都用这里的同一份说明和默认值。
 */

export type TicketKind = 'invite' | 'admin';
export type TicketStatus = 'active' | 'revoked' | 'expired' | 'full';

export const INVITE_CLAIM_DAYS = { min: 1, max: 30, default: 7 } as const;
export const INVITE_MAX_DEVICES = { min: 1, max: 50, default: 3 } as const;

const SECRET_RE = /^[A-Za-z0-9_-]{24,64}$/;

/** 从粘贴的内容里取出门票：可以是门票原文，也可以是整条邀请链接（?invite=…） */
export function extractTicket(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const t = new URL(raw).searchParams.get('invite');
    return t && SECRET_RE.test(t) ? t : null;
  } catch {
    // 不是完整网址，按门票原文处理
  }
  return SECRET_RE.test(raw) ? raw : null;
}

/** 进门后要回去的页面：只接受站内路径，防止被拿来跳到外部网站 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

const CLAIM_MESSAGE: Record<string, string> = {
  not_found: '邀请链接无效，请向发给你的人确认',
  revoked: '这张门票已经被撤销，请向发给你的人重新要一张',
  expired: '这张门票已经过了进门期限，请向发给你的人重新要一张',
  full: '这张门票可用的设备数已经用完，请向发给你的人重新要一张',
  invalid: '这张门票无效',
  unavailable: '暂时无法核对门票，请稍后再试',
  limited: '尝试太频繁了，请 15 分钟后再试',
};

export function claimMessage(reason: string): string {
  return CLAIM_MESSAGE[reason] ?? CLAIM_MESSAGE.invalid;
}

/** 门票现在是什么状态（后台列表显示用） */
export function ticketStatus(
  t: { kind: TicketKind; revoked_at: string | null; claim_until: string | null; devices_used: number; max_devices: number },
  now: number = Date.now(),
): TicketStatus {
  if (t.revoked_at) return 'revoked';
  if (t.kind === 'invite' && t.claim_until && new Date(t.claim_until).getTime() <= now) return 'expired';
  if (t.devices_used >= t.max_devices) return 'full';
  return 'active';
}
