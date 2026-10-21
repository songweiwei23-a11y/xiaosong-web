/**
 * 后台「用户使用监控」的计算（lib/usage-monitor.ts）。
 * 输入是手工造的一小批记录，期望值按口径手算：窗口 7 天，现在是上海时间 2026-10-20 12:00。
 */
import { describe, it, expect } from 'vitest';
import {
  buildUsageMonitor,
  maskEmail,
  shanghaiDate,
  CREATION_FEATURE_COUNT,
  REFERENCE_CREATIONS_PER_ACTIVE,
  TOKEN_PRICE_CNY_PER_MILLION,
  type MonitorInput,
} from '@/lib/usage-monitor';

const NOW = new Date('2026-10-20T04:00:00.000Z');

function baseInput(overrides: Partial<MonitorInput> = {}): MonitorInput {
  return {
    users: [
      { id: 'u1', email: 'alice@example.com', createdAt: '2026-10-18T00:00:00.000Z', lastSignInAt: null },
      { id: 'u2', email: 'bob@example.com', createdAt: '2026-06-01T00:00:00.000Z', lastSignInAt: null },
      { id: 'u3', email: null, createdAt: '2026-06-01T00:00:00.000Z', lastSignInAt: null },
    ],
    subscriptions: [{ userId: 'u2', plan: 'pro', status: 'active', endDate: null }],
    events: [
      { userId: 'u1', feature: 'script', createdAt: '2026-10-19T02:00:00.000Z' },
      { userId: 'u1', feature: 'topic', createdAt: '2026-10-19T03:00:00.000Z' },
      // 在 30 天内、不在 7 天内：算近 30 天活跃，不算本窗口的创作
      { userId: 'u2', feature: 'script', createdAt: '2026-10-10T01:00:00.000Z' },
    ],
    evidence: [
      { userId: 'u1', feature: 'script', completedAt: '2026-10-19T02:05:00.000Z', totalTokens: 1000, promptTokens: 600, completionTokens: 400 },
      // 窗口之外的 Token 不计入
      { userId: 'u2', feature: 'script', completedAt: '2026-10-10T01:05:00.000Z', totalTokens: 5000, promptTokens: 3000, completionTokens: 2000 },
    ],
    quotas: [{ userId: 'u1', periodUsed: 12 }],
    packLots: [
      { userId: 'u1', creditsTotal: 15, creditsRemaining: 10, expiresAt: '2027-10-20T00:00:00.000Z' },
      { userId: 'u1', creditsTotal: 15, creditsRemaining: 0, expiresAt: null },
      // 已过期的批次：计入购买批数，不计入余额
      { userId: 'u3', creditsTotal: 15, creditsRemaining: 5, expiresAt: '2026-10-01T00:00:00.000Z' },
    ],
    orders: [
      { userId: 'u2', planId: 'pro', status: 'approved' },
      { userId: 'u2', planId: 'count_pack_trial_19_9', status: 'approved' },
      { userId: 'u3', planId: 'basic', status: 'pending' },
    ],
    days: 7,
    now: NOW,
    tokenPricePerMillion: null,
    ...overrides,
  };
}

describe('maskEmail / shanghaiDate', () => {
  it('邮箱打码：保留首字母和域名', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('noat')).toBe('***');
  });

  it('日期按上海时间：UTC 16:30 已经是上海次日 00:30', () => {
    expect(shanghaiDate('2026-10-19T16:30:00.000Z')).toBe('2026-10-20');
    expect(shanghaiDate('2026-10-19T14:30:00.000Z')).toBe('2026-10-19');
  });
});

describe('buildUsageMonitor 汇总', () => {
  const out = buildUsageMonitor(baseInput());

  it('注册、新用户、活跃、创作次数按窗口计算', () => {
    expect(out.summary.registered).toBe(3);
    expect(out.summary.newUsers).toBe(1); // u1 注册于 10-18，在窗口内
    expect(out.summary.activeInWindow).toBe(1); // 只有 u1 在 7 天内有创作
    expect(out.summary.active7).toBe(1);
    expect(out.summary.active30).toBe(2); // u1、u2（u2 的创作在 10-10，30 天内）
    expect(out.summary.creations).toBe(2);
    expect(out.summary.paidUsers).toBe(1);
  });

  it('Token 只计窗口内的创作完成记录，并算出每次创作的平均', () => {
    expect(out.summary.tokens.total).toBe(1000);
    expect(out.summary.tokens.prompt).toBe(600);
    expect(out.summary.tokens.completion).toBe(400);
    expect(out.summary.tokens.perCreation).toBe(500); // 1000 / 2 次创作
  });

  it('没有单价时成本为 null，不估算', () => {
    expect(TOKEN_PRICE_CNY_PER_MILLION).toBeNull();
    expect(out.summary.estimatedCostCny).toBeNull();
  });

  it('配置单价后按百万 tokens 估算成本（保留两位小数）', () => {
    const priced = buildUsageMonitor(baseInput({ tokenPricePerMillion: 10 }));
    expect(priced.summary.estimatedCostCny).toBe(0.01); // 1000 / 1e6 * 10
  });

  it('次数包：余额只计未过期批次，购买批数计全部批次', () => {
    expect(out.summary.packBalance).toBe(10);
    expect(out.summary.packPurchases).toBe(3);
  });
});

describe('五维与四率', () => {
  const out = buildUsageMonitor(baseInput());
  const dim = (label: string) => out.dimensions.find((d) => d.label === label)!;
  const rate = (label: string) => out.rates.find((r) => r.label === label)!;

  it('五维得分（每维 0–100）', () => {
    expect(out.dimensions.map((d) => d.label)).toEqual(['活跃度', '使用深度', '功能广度', '付费转化', '留存']);
    expect(dim('活跃度').score).toBe(67); // 2 / 3
    expect(dim('使用深度').score).toBe(Math.round((2 / REFERENCE_CREATIONS_PER_ACTIVE) * 100)); // 人均 2 次
    expect(dim('功能广度').score).toBe(Math.round((2 / CREATION_FEATURE_COUNT) * 100)); // u1 用过 2 个功能
    expect(dim('付费转化').score).toBe(33); // 1 / 3
    expect(dim('留存').score).toBe(50); // 近 7 天 1 / 近 30 天 2
    for (const d of out.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('四率：激活、周活跃、付费、复购', () => {
    expect(rate('激活率').value).toBe(100); // 1 个新用户，已创作
    expect(rate('周活跃率').value).toBe(33.3); // 1 / 3
    expect(rate('付费率').value).toBe(33.3); // 1 / 3
    expect(rate('复购率').value).toBe(100); // 付费用户 u2 买了 2 单
  });

  it('分母为 0 时比率为 null、维度为 0，不算成 NaN', () => {
    const empty = buildUsageMonitor(baseInput({ users: [], subscriptions: [], events: [], evidence: [], quotas: [], packLots: [], orders: [] }));
    expect(empty.rates.every((r) => r.value === null)).toBe(true);
    expect(empty.dimensions.every((d) => d.score === 0)).toBe(true);
    expect(empty.summary.tokens.perCreation).toBeNull();
  });
});

describe('明细、功能、每日', () => {
  const out = buildUsageMonitor(baseInput());

  it('用户明细按创作次数排序，邮箱已打码，套餐只认有效订阅', () => {
    expect(out.users.map((u) => u.userId)).toEqual(['u1', 'u2', 'u3']);
    const u1 = out.users[0];
    expect(u1.email).toBe('a***@example.com');
    expect(u1.creationsInWindow).toBe(2);
    expect(u1.activeDaysInWindow).toBe(1);
    expect(u1.featuresUsedInWindow).toBe(2);
    expect(u1.tokensInWindow).toBe(1000);
    expect(u1.periodUsed).toBe(12);
    expect(u1.packBalance).toBe(10);
    expect(u1.plan).toBe('free');
    expect(u1.lastActiveAt).toBe('2026-10-19T03:00:00.000Z');

    const u2 = out.users[1];
    expect(u2.plan).toBe('pro');
    expect(u2.paidOrders).toBe(2);
    expect(u2.creationsInWindow).toBe(0);
    expect(u2.tokensInWindow).toBe(0); // 窗口外的 5000 不计

    expect(out.users[2].email).toBeNull();
  });

  it('到期的订阅不算会员（和会员页、服务端放行的判定一致）', () => {
    const expired = buildUsageMonitor(
      baseInput({ subscriptions: [{ userId: 'u2', plan: 'pro', status: 'active', endDate: '2026-10-01T00:00:00.000Z' }] })
    );
    expect(expired.users.find((u) => u.userId === 'u2')!.plan).toBe('free');
  });

  it('功能表：次数、Token、用户数；按次数降序', () => {
    const script = out.features.find((f) => f.feature === 'script')!;
    expect(script.creations).toBe(1);
    expect(script.tokens).toBe(1000);
    expect(script.users).toBe(1);
    expect(out.features[0].creations).toBeGreaterThanOrEqual(out.features[out.features.length - 1].creations);
  });

  it('每日走势：天数与窗口一致，最后一天是今天（上海时间）', () => {
    expect(out.daily).toHaveLength(7);
    expect(out.daily[out.daily.length - 1].date).toBe('2026-10-20');
    const d19 = out.daily.find((d) => d.date === '2026-10-19')!;
    expect(d19.creations).toBe(2);
    expect(d19.tokens).toBe(1000);
  });
});
