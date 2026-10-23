/**
 * 手动回归的节流（2026-10-23）。每次回归约 10 次模型调用，管理员手点太勤会白花钱。
 * 规则：两次手动回归之间至少隔 30 分钟；最近 24 小时内最多 5 次。夜间定时任务不受限制。
 * 纯函数：runTimes 由接口从库里读（手动回归每次写进去的 created_at）。
 */
export const MANUAL_COOLDOWN_MS = 30 * 60_000;
export const MANUAL_DAILY_CAP = 5;

/** 能不能再跑一次。返回 null 表示可以；否则是给管理员看的原因 */
export function manualRunBlock(runTimes: string[], now: number): string | null {
  const times = runTimes.map((t) => Date.parse(t)).filter((t) => !Number.isNaN(t)).sort((a, b) => b - a);
  if (times.length >= MANUAL_DAILY_CAP) {
    return `最近 24 小时内已经手动回归 ${times.length} 次，达到上限 ${MANUAL_DAILY_CAP} 次，过一阵再跑`;
  }
  const last = times[0];
  if (last !== undefined && now - last < MANUAL_COOLDOWN_MS) {
    const wait = Math.ceil((MANUAL_COOLDOWN_MS - (now - last)) / 60_000);
    return `上一次手动回归刚跑完，还需等 ${wait} 分钟再跑`;
  }
  return null;
}
