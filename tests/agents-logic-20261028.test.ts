/**
 * 代理分成的纯规则（2026-10-28，lib/agents）：北京时间的月份、只结过完的月、费率输入、
 * 分成按分取整、邮箱脱敏、按月汇总（已结算的用快照，未结算的按当前费率）。
 */
import { describe, expect, it } from 'vitest';
import {
  bucketPaidOrders,
  canSettlePeriod,
  commissionAmount,
  currentPeriod,
  isValidPeriod,
  monthLine,
  monthLines,
  parseRatePercent,
  periodBounds,
  periodOf,
  previousPeriod,
  settlementSnapshot,
  sumAmounts,
} from '@/lib/agents';

describe('月份按北京时间算', () => {
  it('UTC 时间 10-31 16:30 已经是北京时间 11-01 00:30：算进 11 月', () => {
    expect(periodOf('2026-10-31T16:30:00Z')).toBe('2026-11');
  });

  it('北京时间 10-31 23:59:59 还是 10 月', () => {
    expect(periodOf('2026-10-31T15:59:59Z')).toBe('2026-10');
  });

  it('某个月的起止：左闭右开，按北京时间的 0 点', () => {
    expect(periodBounds('2026-10')).toEqual({
      startIso: '2026-09-30T16:00:00.000Z',
      endIso: '2026-10-31T16:00:00.000Z',
    });
  });

  it('上一个月：一月的上一个月是去年十二月', () => {
    expect(previousPeriod(Date.parse('2026-01-05T00:00:00Z'))).toBe('2025-12');
    expect(previousPeriod(Date.parse('2026-10-28T04:00:00Z'))).toBe('2026-09');
  });

  it('当前月份（北京时间）', () => {
    expect(currentPeriod(Date.parse('2026-10-28T04:00:00Z'))).toBe('2026-10');
  });

  it('月份格式只认 YYYY-MM，月份 01 到 12', () => {
    expect(isValidPeriod('2026-10')).toBe(true);
    expect(isValidPeriod('2026-13')).toBe(false);
    expect(isValidPeriod('2026-1')).toBe(false);
    expect(isValidPeriod('2026-10-01')).toBe(false);
    expect(isValidPeriod(202610)).toBe(false);
    expect(() => periodBounds('bad')).toThrow();
  });
});

describe('只结算已经过完的月份', () => {
  const now = Date.parse('2026-10-28T04:00:00Z');

  it('上个月可以结；本月和以后的月份不能结', () => {
    expect(canSettlePeriod('2026-09', now)).toBe(true);
    expect(canSettlePeriod('2026-10', now)).toBe(false);
    expect(canSettlePeriod('2026-11', now)).toBe(false);
  });

  it('格式不对的不能结', () => {
    expect(canSettlePeriod('abc', now)).toBe(false);
  });
});

describe('费率输入：百分比，0 到 100，最多两位小数', () => {
  it('20 是 20%，存成 0.2', () => {
    expect(parseRatePercent(20)).toBe(0.2);
    expect(parseRatePercent('15.5')).toBe(0.155);
    expect(parseRatePercent(0)).toBe(0);
    expect(parseRatePercent(100)).toBe(1);
  });

  it('超出范围、三位小数、非数字都不接受', () => {
    expect(parseRatePercent(101)).toBeNull();
    expect(parseRatePercent(-1)).toBeNull();
    expect(parseRatePercent(20.123)).toBeNull();
    expect(parseRatePercent('abc')).toBeNull();
    expect(parseRatePercent('')).toBeNull();
    expect(parseRatePercent(null)).toBeNull();
    expect(parseRatePercent(Number.NaN)).toBeNull();
  });
});

describe('分成金额：按分取整，没有浮点误差', () => {
  it('99.99 元的 20%：20 元（不是 19.998 这种）', () => {
    expect(commissionAmount(99.99, 0.2)).toBe(20);
  });

  it('0.1 加 0.2 按分相加得 0.3，不是 0.30000000000000004', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
  });

  it('费率为 0 时分成为 0', () => {
    expect(commissionAmount(199, 0)).toBe(0);
  });
});

describe('按月汇总', () => {
  const orders = [
    { user_id: 'u1', amount: 99, reviewed_at: '2026-10-05T04:00:00Z' },
    { user_id: 'u2', amount: 299, reviewed_at: '2026-10-20T04:00:00Z' },
    { user_id: 'u1', amount: 99, reviewed_at: '2026-10-25T04:00:00Z' },
    { user_id: 'u3', amount: 199, reviewed_at: '2026-11-02T04:00:00Z' },
  ];

  it('按北京时间的月份分组，最新的月份在前，同一个人只算一次付费人', () => {
    const totals = bucketPaidOrders(orders);
    expect(totals.map((t) => t.period)).toEqual(['2026-11', '2026-10']);
    const oct = totals[1];
    expect(oct).toEqual({ period: '2026-10', orderCount: 3, payerCount: 2, paidAmount: 497 });
  });

  it('没结算的月份：按当前费率现算，标明未结算', () => {
    const line = monthLine({ period: '2026-10', orderCount: 3, payerCount: 2, paidAmount: 497 }, undefined, 0.2);
    expect(line).toMatchObject({ rate: 0.2, commission: 99.4, settled: false, paidAmount: 497 });
  });

  it('已结算的月份：用结算时的快照（费率、金额都不再跟着当前费率变）', () => {
    const snap = { period: '2026-10', order_count: 3, paid_amount: 497, commission_rate: 0.1, commission_amount: 49.7 };
    const line = monthLine({ period: '2026-10', orderCount: 9, payerCount: 9, paidAmount: 9999 }, snap, 0.3);
    expect(line).toMatchObject({ rate: 0.1, commission: 49.7, settled: true, paidAmount: 497, orderCount: 3 });
  });

  it('结算了、但这个月没有订单：照样显示（分成为 0）', () => {
    const snap = { period: '2026-09', order_count: 0, paid_amount: 0, commission_rate: 0.2, commission_amount: 0 };
    const lines = monthLines([], [snap], 0.2);
    expect(lines).toEqual([
      { period: '2026-09', orderCount: 0, payerCount: 0, paidAmount: 0, rate: 0.2, commission: 0, settled: true },
    ]);
  });

  it('结算快照：单数、充值金额、费率、分成', () => {
    expect(settlementSnapshot(497, 3, 0.2)).toEqual({
      order_count: 3,
      paid_amount: 497,
      commission_rate: 0.2,
      commission_amount: 99.4,
    });
  });
});
