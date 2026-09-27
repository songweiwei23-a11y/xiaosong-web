/**
 * 7 天起号计划。守"不报错、只是走不下去"的那类：
 * 第几天算错（晚上开始的人第二天还是第 1 天）、任务链接到一个不存在的页面、
 * 表没建时首页摆一张点了就报错的卡。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { LAUNCH_DAYS, LAUNCH_TOTAL, currentLaunchDay, normalizeDoneDays, toggleDay } from '@/lib/launch-plan';
import { readCode } from './helpers/source';

describe('第几天：按北京时间的日历天', () => {
  it('当天是第 1 天', () => {
    expect(currentLaunchDay('2026-09-28T02:00:00Z', new Date('2026-09-28T10:00:00Z'))).toBe(1);
  });
  it('北京时间晚上 11 点半开始，过了零点就是第 2 天（不是满 24 小时才算）', () => {
    // 15:30Z = 北京 23:30；17:00Z = 北京次日 01:00
    expect(currentLaunchDay('2026-09-28T15:30:00Z', new Date('2026-09-28T17:00:00Z'))).toBe(2);
  });
  it('UTC 同一天、北京时间已跨天也算对', () => {
    // 北京 9/29 07:00 开始（= 9/28 23:00Z），北京 9/29 20:00 看（= 9/29 12:00Z）→ 还是第 1 天
    expect(currentLaunchDay('2026-09-28T23:00:00Z', new Date('2026-09-29T12:00:00Z'))).toBe(1);
  });
  it('过了 7 天返回实际天数，由卡片显示"接着补"', () => {
    expect(currentLaunchDay('2026-09-01T02:00:00Z', new Date('2026-09-28T02:00:00Z'))).toBe(28);
  });
});

describe('打勾', () => {
  it('去重、只留 1~7、排好序', () => {
    expect(normalizeDoneDays([3, 1, 3, 9, 0, '2', 'x', 2.5])).toEqual([1, 2, 3]);
    expect(normalizeDoneDays(null)).toEqual([]);
  });
  it('再点一下是取消', () => {
    expect(toggleDay([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe('七天的任务', () => {
  it('正好 7 天，顺序 1~7，每天都有标题、为什么、按钮', () => {
    expect(LAUNCH_TOTAL).toBe(7);
    expect(LAUNCH_DAYS.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const d of LAUNCH_DAYS) {
      expect(d.title.length, `第${d.day}天`).toBeGreaterThan(4);
      expect(d.why.length, `第${d.day}天`).toBeGreaterThan(4);
      expect(d.cta.length, `第${d.day}天`).toBeGreaterThan(1);
    }
  });

  it('每天的链接都指向真实存在的板块（链到空页面，这一天就走不下去）', () => {
    for (const d of LAUNCH_DAYS) {
      const route = d.href.split('?')[0];
      expect(fs.existsSync(path.join(process.cwd(), 'app', route, 'page.tsx')), d.href).toBe(true);
    }
  });

  it('不考核播放量、不承诺效果', () => {
    expect(LAUNCH_DAYS.map((d) => d.title + d.why).join(' ')).not.toMatch(/保证|一定火|月入|涨粉\d/);
  });
});

describe('接口和卡片', () => {
  it('表没建时接口说"不可用"，卡片整张不出现', () => {
    expect(readCode('app/api/launch-plan/route.ts')).toMatch(/unavailable: true/);
    expect(readCode('components/dashboard/LaunchPlanCard.tsx')).toMatch(/if \(!d \|\| d\.unavailable\) return;/);
  });

  it('只能读写自己的：接口要登录、按本人过滤；表上不开任何浏览器策略', () => {
    const api = readCode('app/api/launch-plan/route.ts');
    expect(api).toContain('requireUser()');
    expect((api.match(/\.eq\('user_id', (guard\.userId!|userId)\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260928_launch_plans.sql'), 'utf8');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });

  it('可以折叠：收起后只剩标题行和进度条，收没收记在本机', () => {
    const card = readCode('components/dashboard/LaunchPlanCard.tsx');
    expect(card).toMatch(/const COLLAPSE_KEY = "kaiwu:launch-plan-collapsed"/);
    expect(card).toMatch(/localStorage\.setItem\(COLLAPSE_KEY, c \? "0" : "1"\)/);
    // 进行中和没开始两种状态都能收
    expect((card.match(/onClick=\{toggleCollapsed\}/g) ?? []).length).toBe(2);
    expect(card).toMatch(/\{!collapsed && \(<>/);
  });

  it('工作台首页挂着它', () => {
    expect(readCode('app/dashboard/page.tsx')).toContain('<LaunchPlanCard className="mb-5" />');
  });
});
