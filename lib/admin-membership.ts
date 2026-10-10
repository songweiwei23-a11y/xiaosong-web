/**
 * 管理员手动延长会员天数。
 *
 * 还没到期：从原到期日往后加；已经到期或从来没有到期日（永久）：从现在起加。
 * 永久会员不延期——它本来就不会过期，再加天数没有意义，应该由管理员改成具体日期。
 */
export function extendEndDate(
  currentEnd: string | null | undefined,
  days: number,
  now: number = Date.now()
): { endDate: string } | { error: string } {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return { error: '延长天数要在 1 到 3650 之间' };
  }
  if (currentEnd === null || currentEnd === undefined || currentEnd === '') {
    return { error: '这个会员是永久有效的，不需要延期。要设置到期日，请直接改到期时间' };
  }
  const end = new Date(currentEnd).getTime();
  const base = Number.isNaN(end) || end < now ? now : end;
  return { endDate: new Date(base + days * 86400_000).toISOString() };
}
