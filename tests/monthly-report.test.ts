/**
 * 月报（体检 F3）：按月汇总。数字从作品和录入的数据里算；没录的写「未录」，不当成 0。
 */
import { describe, it, expect } from 'vitest';
import { readCode } from './helpers/source';
import { buildMonthlyReport, monthOf, nextMonthOf, previousMonth, monthLabel, type ReportWork } from '@/lib/monthly-report';

const works: ReportWork[] = [
  { id: 'a', title: '沙发选购', shoot_status: 'published', shot_at: '2026-10-05T04:00:00Z', published_at: '2026-10-06T04:00:00Z', metrics: { views: 1200, completion: 52 } },
  { id: 'b', title: '预算怎么分', shoot_status: 'published', shot_at: '2026-10-08T04:00:00Z', published_at: '2026-10-09T04:00:00Z', metrics: { views: 800, completion: 38 } },
  { id: 'c', title: '投流的那条', shoot_status: 'published', shot_at: '2026-10-10T04:00:00Z', published_at: '2026-10-11T04:00:00Z', metrics: { views: 9000, completion: 90, paidPromotion: true } },
  { id: 'd', title: '拍了没发', shoot_status: 'shot', shot_at: '2026-10-12T04:00:00Z', published_at: null, metrics: null },
  { id: 'e', title: '九月的', shoot_status: 'published', shot_at: '2026-09-20T04:00:00Z', published_at: '2026-09-21T04:00:00Z', metrics: { views: 5, completion: 10 } },
  { id: 'f', title: '下个月要发', shoot_status: null, planned_at: '2026-11-03T04:00:00Z', metrics: null },
];

describe('月份的换算', () => {
  it('北京时间的月份；上个月；下个月；显示用中文', () => {
    expect(monthOf('2026-10-31T20:00:00Z')).toBe('2026-11');
    expect(previousMonth(Date.parse('2026-10-17T02:00:00Z'))).toBe('2026-09');
    expect(previousMonth(Date.parse('2026-01-05T02:00:00Z'))).toBe('2025-12');
    expect(nextMonthOf('2026-12')).toBe('2027-01');
    expect(monthLabel('2026-10')).toBe('2026年10月');
  });
});

describe('汇总一个月', () => {
  const r = buildMonthlyReport(works, '2026-10');

  it('拍了几条、发了几条、录了数据几条（投流的不算完播）', () => {
    expect(r.shot).toBe(4);
    expect(r.published).toBe(3);
    expect(r.withData).toBe(2);
  });

  it('播放合计（投流的也算播放，因为它确实有播放）；完播中位数不含投流', () => {
    expect(r.totalViews).toBe(1200 + 800 + 9000);
    expect(r.medianCompletion).toBe(45);
  });

  it('表现最好的是不投流的那条里完播最高的', () => {
    expect(r.best).toEqual({ title: '沙发选购', completion: 52 });
  });

  it('下个月计划只列下个月、还没发的：10 月的月报看 11 月的计划，11 月的月报看 12 月的计划', () => {
    expect(r.nextMonthPlan.map((p) => p.title)).toEqual(['下个月要发']);
    const dec = buildMonthlyReport(works, '2026-11');
    expect(dec.nextMonthPlan).toEqual([]);
  });

  it('没录数据的月份：写「还没有录入」，不写 0', () => {
    const empty = buildMonthlyReport([{ id: 'x', title: '只拍了', shoot_status: 'shot', shot_at: '2026-10-02T04:00:00Z' }], '2026-10');
    expect(empty.totalViews).toBeNull();
    expect(empty.medianCompletion).toBeNull();
    expect(empty.lines.join('\n')).toContain('还没有录入完播数据');
    expect(empty.lines.join('\n')).not.toMatch(/合计播放 0/);
  });
});

describe('接线：页面和侧栏、帮助页', () => {
  it('月报页在侧栏「总览」里，并且打印时隐藏侧栏', () => {
    expect(readCode('components/dashboard/Sidebar.tsx')).toMatch(/name: "月报", href: "\/dashboard\/report"/);
    expect(readCode('app/dashboard/report/page.tsx')).toMatch(/@media print \{ aside/);
  });

  it('帮助页说明了月报', () => {
    expect(readCode('app/dashboard/help/page.tsx')).toMatch(/name: "月报"/);
  });
});
