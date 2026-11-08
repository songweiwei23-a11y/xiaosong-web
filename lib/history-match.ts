/**
 * 从历史记录里认回「页面上这份正文」是哪一条（2026-11-08）。
 *
 * 各板块「继续创作」要带上这份结果当时的设置和原始内容，原来只认正文一字不差的那条：
 * 页面显示的是润色、改写后的最终版，历史里存的可能是润色前的；多一个空格也对不上。
 * 对不上就退回「当前表单的设置」，旧选题、旧方向带过去的就成了现在表单里的东西。
 *
 * 认法：一字不差 → 去掉空白和加粗符号后相同 → 相同的行占到 6 成以上里最像的那条（润色只改几条标题）。
 */
type Row = { result: string; input_data?: Record<string, unknown> | null };

const norm = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, '');
const lineSet = (s: string) => new Set(s.split('\n').map(norm).filter((l) => l.length >= 2));

export function findHistoryRecord<T extends Row>(result: string, history: T[]): T | undefined {
  if (!result.trim() || !history.length) return undefined;
  const exact = history.find((item) => item.result === result);
  if (exact) return exact;
  const n = norm(result);
  const same = history.find((item) => typeof item.result === 'string' && norm(item.result) === n);
  if (same) return same;
  const mine = lineSet(result);
  if (!mine.size) return undefined;
  let best: T | undefined;
  let bestScore = 0;
  for (const item of history) {
    if (typeof item.result !== 'string') continue;
    const theirs = lineSet(item.result);
    if (!theirs.size) continue;
    let shared = 0;
    for (const l of mine) if (theirs.has(l)) shared++;
    const score = shared / Math.max(mine.size, theirs.size);
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 0.6 ? best : undefined;
}
