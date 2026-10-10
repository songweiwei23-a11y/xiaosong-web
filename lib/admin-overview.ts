/** 北京时间（UTC+8）的一天从几点开始，返回毫秒时间戳 */
export function startOfBeijingDay(now: number = Date.now()): number {
  const shifted = new Date(now + 8 * 3600_000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 3600_000;
}

/** 最近 n 天（含今天），从旧到新。每一天是北京时间的 [start, end) */
export function dayWindows(n: number, now: number = Date.now()) {
  const today = startOfBeijingDay(now);
  const out: { label: string; start: string; end: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = today - i * 86400_000;
    const end = start + 86400_000;
    const d = new Date(start + 8 * 3600_000);
    out.push({
      label: `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
  }
  return out;
}

/** 金额求和，忽略非数字 */
export function sumAmounts(rows: { amount?: unknown }[]): number {
  return rows.reduce((s, r) => s + (Number.isFinite(Number(r.amount)) ? Number(r.amount) : 0), 0);
}
