/**
 * 首页时钟用的时间说法：星期、农历、节日、今天过了多少。
 * 农历用浏览器自带的 Intl 中国历法算，不引库。
 */

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DAY_TENS = ['初', '十', '廿', '三'];
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function weekdayOf(d: Date) {
  return WEEK[d.getDay()];
}

/** 农历日：1 → 初一，10 → 初十，15 → 十五，20 → 二十，21 → 廿一，30 → 三十 */
export function lunarDayName(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  return DAY_TENS[Math.floor(day / 10)] + DIGITS[day % 10];
}

/** 农历月日，如 { month: '八月', day: 15, text: '八月十五' }。浏览器不支持中国历法时返回 null */
export function lunarOf(d: Date): { month: string; day: number; text: string } | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(d);
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (!month || !Number.isFinite(day)) return null;
    // 腊月、正月的叫法：Intl 给的是"十二月""正月"/"一月"，统一成日常说法
    const m = month === '十二月' ? '腊月' : month === '一月' ? '正月' : month;
    return { month: m, day, text: `${m}${lunarDayName(day)}` };
  } catch {
    return null;
  }
}

const LUNAR_FESTIVALS: Record<string, string> = {
  正月初一: '春节', 正月十五: '元宵', 五月初五: '端午', 七月初七: '七夕',
  八月十五: '中秋', 九月初九: '重阳', 腊月初八: '腊八', 腊月廿三: '小年',
};
const SOLAR_FESTIVALS: Record<string, string> = {
  '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '5-1': '劳动节', '6-1': '儿童节',
  '10-1': '国庆', '12-25': '圣诞',
};

/** 今天是什么节，没有就 null。农历优先 */
export function festivalOf(d: Date): string | null {
  const lunar = lunarOf(d);
  if (lunar && LUNAR_FESTIVALS[lunar.text]) return LUNAR_FESTIVALS[lunar.text];
  return SOLAR_FESTIVALS[`${d.getMonth() + 1}-${d.getDate()}`] ?? null;
}

/** 今天过了多少（0-1） */
export function dayProgress(d: Date): number {
  const ms = d.getHours() * 3600_000 + d.getMinutes() * 60_000 + d.getSeconds() * 1000 + d.getMilliseconds();
  return ms / 86_400_000;
}

/** 按钟点说一句：凌晨 / 早上 / 上午 / 中午 / 下午 / 傍晚 / 晚上 / 深夜 */
export function periodOf(d: Date): string {
  const h = d.getHours();
  if (h < 5) return '凌晨';
  if (h < 8) return '早上';
  if (h < 11) return '上午';
  if (h < 13) return '中午';
  if (h < 17) return '下午';
  if (h < 19) return '傍晚';
  if (h < 23) return '晚上';
  return '深夜';
}

/** "9月25日 星期五"，有农历再接" · 八月十五" */
export function dateLine(d: Date): string {
  const lunar = lunarOf(d);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayOf(d)}${lunar ? ` · 农历${lunar.text}` : ''}`;
}
