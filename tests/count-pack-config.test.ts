/**
 * 次数包配置（2026-10-20）：19.9 元尝鲜包面向所有用户开放，不限购。
 * 这组测试守住：销售关闭时仍能拦截下单（用参数验证）；开放时有定价才能下单；次数包和会员套餐的 id 不混在一起。
 */
import { describe, it, expect } from 'vitest';
import {
  COUNT_PACK_SALES_ENABLED,
  COUNT_PACKS,
  COUNT_PACK_RULES,
  costOfFeature,
  countPackById,
  countPackExpiry,
  countPackPurchaseBlock,
  isCountPackId,
} from '@/lib/config/count-packs';
import { SUBSCRIPTION_PLANS } from '@/lib/config/plans';

const TRIAL = 'count_pack_trial_19_9';

describe('销售入口', () => {
  it('销售开放（产品方 2026-10-20 确认面向所有用户开放）：有定价的尝鲜包可以下单', () => {
    expect(COUNT_PACK_SALES_ENABLED).toBe(true);
    expect(countPackPurchaseBlock(TRIAL)).toBeNull();
  });

  it('销售关闭时（用参数验证）：下单被拒，理由写明暂未开放', () => {
    expect(countPackPurchaseBlock(TRIAL, false)).toMatch(/暂未开放/);
  });

  it('没有这个包或没有定价，都不能下单', () => {
    expect(countPackPurchaseBlock('count_pack_nope')).toMatch(/没有这个次数包/);
    expect(countPackPurchaseBlock(null)).toMatch(/没有这个次数包/);
    expect(countPackPurchaseBlock('count_pack_nope', true)).toMatch(/没有这个次数包/);
  });

});

describe('尝鲜包的配置', () => {
  it('价格 19.9 元，次数 20、没有时间限制、不限购（产品方 2026-10-20 决定）', () => {
    const pack = countPackById(TRIAL)!;
    expect(pack.price).toBe(19.9);
    expect(pack.credits).toBe(20);
    expect(pack.validDays).toBeNull(); // 没有时间限制，次数不过期
    expect(pack.maxPurchasesPerAccount).toBeNull();
  });

  it('只有一个尝鲜包，名字不写「测试配置」（已对外开放）', () => {
    expect(COUNT_PACKS).toHaveLength(1);
    expect(COUNT_PACKS[0].name).not.toMatch(/测试配置/);
    expect(COUNT_PACKS[0].displayName).not.toMatch(/测试配置/);
    expect(COUNT_PACKS[0].testConfig).toBe(false);
  });

  it('没有时间限制：当前配置下次数不过期，到期时间为 null', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    expect(countPackExpiry(countPackById(TRIAL)!, now)).toBeNull();
  });

  it('如果以后又加上有效期：按天数算到期时间', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    const expiry = countPackExpiry({ ...countPackById(TRIAL)!, validDays: 365 }, now);
    expect(expiry).toBe(new Date(now.getTime() + 365 * 86_400_000).toISOString());
  });
});

describe('扣减规则', () => {
  it('每次创作扣 1 次；知识库不计入次数包', () => {
    expect(COUNT_PACK_RULES.costPerCreation).toBe(1);
    expect(costOfFeature('script')).toBe(1);
    expect(costOfFeature('knowledge')).toBeNull();
  });

  it('会员额度优先：扣减顺序写死为 membership_first，退款未定', () => {
    expect(COUNT_PACK_RULES.deductionOrder).toBe('membership_first');
    expect(COUNT_PACK_RULES.refundPolicy).toBe('undecided');
  });
});

describe('和会员套餐互不混淆', () => {
  it('次数包的 id 以 count_pack_ 开头，不会和会员套餐 id 撞上', () => {
    expect(isCountPackId(TRIAL)).toBe(true);
    for (const planId of Object.keys(SUBSCRIPTION_PLANS)) {
      expect(isCountPackId(planId)).toBe(false);
    }
    expect(isCountPackId('basic')).toBe(false);
  });
});
