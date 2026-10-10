import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { beijingDate, endOfBeijingDay, parseEndDateInput } from '@/lib/admin-dates';

/**
 * 后台到期日统一按北京时间（2026-10-10 巡检 H2）。
 */
describe('北京时间日期', () => {
  it('UTC 16:00 之后的到期时刻，北京时间已经是第二天', () => {
    // 2026-11-09 19:00 UTC = 2026-11-10 03:00 北京
    expect(beijingDate('2026-11-09T19:00:00Z')).toBe('2026-11-10');
  });

  it('北京时间当天 23:59 之前，仍然是当天', () => {
    expect(beijingDate('2026-11-09T15:59:00Z')).toBe('2026-11-09');
  });

  it('取不到的值返回空串', () => {
    expect(beijingDate(null)).toBe('');
    expect(beijingDate('not-a-date')).toBe('');
  });

  it('日期 → 当天 23:59:59（北京时间）', () => {
    expect(endOfBeijingDay('2026-11-10')).toBe('2026-11-10T15:59:59.000Z');
  });

  it('来回换算不漂移：选的日期读回来还是那一天', () => {
    const iso = endOfBeijingDay('2026-11-10') as string;
    expect(beijingDate(iso)).toBe('2026-11-10');
  });

  it('完整时间戳按原样解析；空串返回 null', () => {
    expect(endOfBeijingDay('2026-11-10T08:00:00Z')).toBe('2026-11-10T08:00:00.000Z');
    expect(endOfBeijingDay('   ')).toBeNull();
  });

  it('parseEndDateInput：空值是永久，乱填是 ok=false', () => {
    expect(parseEndDateInput(null)).toEqual({ ok: true, endIso: null });
    expect(parseEndDateInput('')).toEqual({ ok: true, endIso: null });
    expect(parseEndDateInput('2026-11-10')).toEqual({ ok: true, endIso: '2026-11-10T15:59:59.000Z' });
    expect(parseEndDateInput('abc')).toEqual({ ok: false });
    expect(parseEndDateInput(123)).toEqual({ ok: false });
  });
});

describe('页面不再用 UTC 日期回填编辑框', () => {
  const pages = ['app/admin/users/page.tsx', 'app/admin/subscriptions/page.tsx'];
  for (const rel of pages) {
    it(`${rel} 不含 toISOString().split 或 split("T")`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/toISOString\(\)\.split/);
      expect(src).not.toMatch(/endDate\.split\("T"\)/);
      expect(src).toMatch(/beijingDate\(/);
    });
  }
});
