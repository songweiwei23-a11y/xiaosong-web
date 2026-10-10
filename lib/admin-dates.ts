/**
 * 后台的到期日统一按北京时间处理。
 *
 * 【为什么要单独抽出来】改造前，编辑框用 `toISOString().split("T")[0]` 取日期，
 * 那是 UTC 日期；北京时间 0–8 点的到期时间，UTC 日期是前一天。管理员打开「改会员」、
 * 什么都没改直接保存，到期时间就被改早了 0–1 天（2026-10-10 后台巡检 H2）。
 *
 * 约定：页面选的日期 YYYY-MM-DD 指的是北京时间那一天；到期 = 那一天 23:59:59（北京时间）。
 */

export const BEIJING_TZ = 'Asia/Shanghai';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 到期时刻 → 北京时间的日期（YYYY-MM-DD），给日期输入框用。取不到就返回空串 */
export function beijingDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: BEIJING_TZ });
}

/**
 * 页面选的日期 → 到期时刻（ISO）。
 * YYYY-MM-DD 视为北京时间那一天的 23:59:59；其它格式按 Date 解析。
 * 空值或无法解析都返回 null；要区分「永久」和「格式错」，用 parseEndDateInput。
 */
export function endOfBeijingDay(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (DATE_ONLY.test(s)) return new Date(`${s}T23:59:59+08:00`).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 服务端用：区分「没填（永久）」「填了且合法」「填了但格式不对」。
 * 不合法时 ok 为 false，调用方应返回 400，而不是把 Invalid Date 写进库。
 */
export function parseEndDateInput(
  input: unknown
): { ok: true; endIso: string | null } | { ok: false } {
  if (input === null || input === undefined || input === '') return { ok: true, endIso: null };
  if (typeof input !== 'string') return { ok: false };
  const iso = endOfBeijingDay(input);
  return iso ? { ok: true, endIso: iso } : { ok: false };
}
