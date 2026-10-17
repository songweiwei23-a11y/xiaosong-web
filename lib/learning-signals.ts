/**
 * 「越用越懂你」二期的服务端信号（见 docs/越用越懂你_二期方案_20261017.md）。
 *
 * - 对照组：每个人每天约 10% 的日子，生成时不带「我的创作偏好」。同一人同一天结果一样，
 *   服务端、前端都按 userId + 北京日期算，不用存状态。用来证明「偏好真的有用」。
 * - 生成记录：每次生成完成记一行（板块、档案、是不是对照组、结果开头的指纹），只存指纹不存全文。
 * - 反馈对回生成记录：用户点「有用 / 没用」时，把带来的节选算成同样的指纹，对回最近一次生成，
 *   就知道这条结果是不是对照组生成的。对不上就是 null，不影响反馈本身。
 *
 * 所有写入都是尽力而为：写失败只打日志，不影响生成和反馈。
 */
import { createHash } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';

/** 对照组占比（百分比）。产品方 2026-10-17 确认：约 10% */
export const CONTROL_PERCENT = 10;
/** 反馈和生成记录对回用的时间窗（天） */
export const LINK_WINDOW_DAYS = 7;
/** 指纹取多少个有效字（去掉空白标点后） */
const HEAD_CHARS = 200;

export function beijingDay(now = Date.now()): string {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 这个人今天是不是对照组 */
export function isControlDay(userId: string, now = Date.now()): boolean {
  const h = createHash('sha256').update(`${userId}|pref-control|${beijingDay(now)}`).digest();
  return h.readUInt32BE(0) % 100 < CONTROL_PERCENT;
}

/**
 * 结果开头的指纹：去掉空白和标点，取前 200 字做 sha1。
 * 生成时用全文算，反馈时用带来的节选算，只要开头没被改，两边就对得上。
 * 太短（不足 20 字）不作指纹，避免两条不同的短结果误对。
 */
export function headKey(text: string): string | null {
  const s = text.replace(/[\s\p{P}\p{S}]/gu, '').slice(0, HEAD_CHARS);
  if (s.length < 20) return null;
  return createHash('sha1').update(s).digest('hex');
}

/** 生成完成后记一行。board 用生成的功能名（如 script、review、freeChat） */
export async function recordGenerationSignal(input: { userId: string; profileId: string | null; board: string; result: string; now?: number }): Promise<void> {
  try {
    const now = input.now ?? Date.now();
    const { error } = await getServiceSupabase().from('user_signals').insert({
      user_id: input.userId,
      profile_id: input.profileId,
      kind: 'generation',
      board: input.board,
      control: isControlDay(input.userId, now),
      head_hash: headKey(input.result),
    });
    if (error) console.warn('[learning] 生成记录没写上', error.message);
  } catch (e) {
    console.warn('[learning] 生成记录没写上', (e as Error).message);
  }
}

/** 反馈带来的节选，对回最近一次生成记录，返回那次是不是对照组；对不上返回 null */
export async function controlOfExcerpt(userId: string, excerpt: string, now = Date.now()): Promise<boolean | null> {
  const key = headKey(excerpt);
  if (!key) return null;
  try {
    const since = new Date(now - LINK_WINDOW_DAYS * 86_400_000).toISOString();
    const { data } = await getServiceSupabase()
      .from('user_signals').select('control')
      .eq('user_id', userId).eq('kind', 'generation').eq('head_hash', key).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return typeof data?.control === 'boolean' ? data.control : null;
  } catch {
    return null;
  }
}
