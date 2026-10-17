/**
 * 发布计划（体检 F2）与素材位置（F4）：本周要发的筛选、日期的换算、接口和页面的接线。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { fromDateInput, plannedThisWeek, planLabel, startOfDay, toDateInput } from '@/lib/publish-plan';

const NOW = Date.parse('2026-10-17T04:00:00Z'); // 北京时间 10-17 12:00
const iso = (dayOffset: number, hour = 12) => new Date(startOfDay(NOW) + dayOffset * 86_400_000 + (hour - 8) * 3600_000).toISOString();

describe('本周要发', () => {
  const works = [
    { id: 'a', title: '今天的', planned_at: iso(0), shoot_status: 'shot' },
    { id: 'b', title: '明天的', planned_at: iso(1), shoot_status: null },
    { id: 'c', title: '七天后的', planned_at: iso(7), shoot_status: null },
    { id: 'd', title: '昨天的', planned_at: iso(-1), shoot_status: null },
    { id: 'e', title: '已经发了', planned_at: iso(2), shoot_status: 'published' },
    { id: 'f', title: '没定日期', planned_at: null, shoot_status: null },
  ];

  it('只留 7 天内（含今天）、还没发的，按日期从早到晚', () => {
    expect(plannedThisWeek(works, NOW).map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('日期标签：今天、明天、周几', () => {
    expect(planLabel(iso(0), NOW)).toBe('今天');
    expect(planLabel(iso(1), NOW)).toBe('明天');
    expect(planLabel(iso(3), NOW)).toMatch(/^周[日一二三四五六]$/);
  });

  it('日期输入框和存库的时间互相换算，不会被时区推到前一天', () => {
    const stored = fromDateInput('2026-10-20');
    expect(stored).toBe('2026-10-20T04:00:00.000Z');
    expect(toDateInput(stored)).toBe('2026-10-20');
    expect(fromDateInput('不是日期')).toBeNull();
    expect(toDateInput(null)).toBe('');
  });
});

describe('接线：作品接口和页面', () => {
  it('作品更新接口接受计划日期和素材位置，缺列时给一句人话', () => {
    const route = readCode('app/api/works/route.ts');
    expect(route).toMatch(/patch\.planned_at = /);
    expect(route).toMatch(/patch\.material_note = /);
    expect(route).toMatch(/发布计划暂时不可用/);
  });

  it('作品卡片有计划日期和素材位置两栏', () => {
    expect(readCode('components/works/WorkCard.tsx')).toMatch(/<WorkPlanRow work=\{w\} \/>/);
    const row = readCode('components/works/WorkPlanRow.tsx');
    expect(row).toMatch(/aria-label="计划发布日期"/);
    expect(row).toMatch(/aria-label="素材位置"/);
  });

  it('首页有「本周要发」', () => {
    expect(readCode('app/dashboard/page.tsx')).toMatch(/<PlanThisWeek works=\{works\} \/>/);
  });
});
