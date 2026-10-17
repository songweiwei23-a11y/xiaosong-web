/**
 * 发布计划（体检 F2）：哪些作品计划在本周发，按日期排。纯函数，首页「本周要发」用。
 */

export interface PlanItem {
  id: string;
  title: string;
  planned_at?: string | null;
  shoot_status?: string | null;
}

const DAY = 86_400_000;

/** 本地日期的 0 点（按北京时间算：服务器和浏览器都按这个时区看「今天」） */
export function startOfDay(ms: number): number {
  const d = new Date(ms + 8 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 8 * 3600_000;
}

/** 今天往后 7 天内（含今天），还没发的，按计划日期从早到晚 */
export function plannedThisWeek<T extends PlanItem>(items: T[], now = Date.now()): T[] {
  const from = startOfDay(now);
  const to = from + 7 * DAY;
  return items
    .filter((w) => {
      if (!w.planned_at || w.shoot_status === 'published') return false;
      const t = new Date(w.planned_at).getTime();
      return !Number.isNaN(t) && t >= from && t < to;
    })
    .sort((a, b) => new Date(a.planned_at!).getTime() - new Date(b.planned_at!).getTime());
}

/** 「今天 / 明天 / 周三」这样的短说法 */
export function planLabel(iso: string, now = Date.now()): string {
  const day = startOfDay(new Date(iso).getTime());
  const diff = Math.round((day - startOfDay(now)) / DAY);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(day + 8 * 3600_000).getUTCDay()];
  return `周${weekday}`;
}

/** 日期输入框用的 yyyy-mm-dd（按北京时间） */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 日期输入框的值 → 存库的 ISO（取北京时间中午，避免时区把日期推到前一天） */
export function fromDateInput(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T12:00:00+08:00`).toISOString();
}
