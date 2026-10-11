/**
 * 给模型一个「今天」：日期和季节按北京时间算，不受服务器时区影响。
 *
 * 为什么要有（2026-10-11 线上实测）：创作方向的输入里写着「秋天了」，输出却整篇写冬天——
 * 提示词里没有今天的日期，模型只能顺着档案和历史产出的时令走（档案里的冬季棚子、
 * 上一轮的冬季方向）。所以生成请求统一带上这一行，季节、节令以它为准。
 */
export function seasonOf(month: number): '春季' | '夏季' | '秋季' | '冬季' {
  if (month >= 3 && month <= 5) return '春季';
  if (month >= 6 && month <= 8) return '夏季';
  if (month >= 9 && month <= 11) return '秋季';
  return '冬季';
}

export function timeAnchor(now: number = Date.now()): string {
  const d = new Date(now + 8 * 3600_000); // 北京时间 = UTC+8，用 UTC 取字段，与服务器时区无关
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `【当前时间】今天是${y}年${m}月${day}日（北京时间，${seasonOf(m)}）。所有季节、节令、时间点都以今天为准：档案、定位、访谈和历史产出里写到的冬季等时令，若与今天不符，只能当作过去的事或计划，不能当成当下；本轮输入写到的季节与时间优先于其他来源。`;
}
