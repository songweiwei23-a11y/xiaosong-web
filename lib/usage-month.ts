/**
 * "本月"按北京时间的自然月算。
 *
 * 服务器跑在 UTC：直接 new Date(y, m, 1) 得到的是 UTC 的 1 号零点，
 * 北京时间 1 号早上八点之前生成的那几条会被算进上个月。
 */
const OFFSET_MS = 8 * 60 * 60 * 1000;

export function monthStartShanghai(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS);
}
