import { describe, it, expect } from 'vitest';
import { judgeQuota, sumCountedUsage, SUBSCRIPTION_PLANS, COUNTED_FEATURES } from '@/lib/config/plans';

/**
 * 额度判定是直接对着钱的逻辑，之前出过两次错且都没被发现：
 *   - 付费版宣称「所有功能 150 次/月」，实现却是每个功能各 150，
 *     30 块钱能用出 8 倍的量；
 *   - 前端按总量算、服务端按单功能算，同一个用户在两边得到相反的结论。
 * 这些用例把文案里的承诺钉死。
 */

/** 造一行 user_quotas */
function usage(overrides: Record<string, number> = {}) {
  const row: Record<string, number> = {};
  for (const f of COUNTED_FEATURES) row[f.column] = 0;
  row.knowledge_used = 0;
  return { ...row, ...overrides };
}

describe('免费版：按功能分别限额', () => {
  it('脚本用完了不影响选题', () => {
    const q = usage({ script_used: 20 });
    expect(judgeQuota('free', 'script', q).allowed).toBe(false);
    expect(judgeQuota('free', 'topic', q).allowed).toBe(true);
    expect(judgeQuota('free', 'topic', q).remaining).toBe(3);
  });

  it('额度为 0 的功能提示的是「会员功能」而不是「已用完」', () => {
    const verdict = judgeQuota('free', 'storyboard', usage());
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toContain('会员功能');
    expect(verdict.message).not.toContain('已用完');
  });

  it('用完时的提示写明了是哪个功能、上限多少', () => {
    const verdict = judgeQuota('free', 'script', usage({ script_used: 20 }));
    expect(verdict.message).toContain('脚本生成');
    expect(verdict.message).toContain('20');
  });

  it('知识库无限，不受任何用量影响', () => {
    const q = usage({ script_used: 999, knowledge_used: 999 });
    expect(judgeQuota('free', 'knowledge', q).allowed).toBe(true);
    expect(judgeQuota('free', 'knowledge', q).remaining).toBe(-1);
  });
});

describe('基础会员：所有功能合计 150 次', () => {
  it('八个功能各用 19 次（合计 152）就该拦下来', () => {
    const q = usage({
      script_used: 19, topic_used: 19, positioning_used: 19, free_chat_used: 19,
      storyboard_used: 19, review_used: 19, title_used: 19, deal_reason_used: 19,
    });
    expect(sumCountedUsage(q)).toBe(152);
    const verdict = judgeQuota('basic', 'script', q);
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toContain('150');
  });

  it('全部用在一个功能上，也是 150 就到顶', () => {
    expect(judgeQuota('basic', 'script', usage({ script_used: 149 })).allowed).toBe(true);
    expect(judgeQuota('basic', 'script', usage({ script_used: 150 })).allowed).toBe(false);
  });

  it('剩余次数是总量口径，不是单功能口径', () => {
    const q = usage({ script_used: 100, topic_used: 30 });
    expect(judgeQuota('basic', 'title', q).remaining).toBe(20);
  });

  it('知识库不计入总量，额度用光后仍可查资料', () => {
    const q = usage({ script_used: 150 });
    expect(judgeQuota('basic', 'script', q).allowed).toBe(false);
    expect(judgeQuota('basic', 'knowledge', q).allowed).toBe(true);
  });
});

describe('专业会员 500、企业版无限', () => {
  it('专业会员合计 500', () => {
    expect(judgeQuota('pro', 'script', usage({ script_used: 499 })).allowed).toBe(true);
    expect(judgeQuota('pro', 'script', usage({ script_used: 500 })).allowed).toBe(false);
  });

  it('企业版怎么用都放行', () => {
    const q = usage({ script_used: 99999 });
    expect(judgeQuota('enterprise', 'script', q).allowed).toBe(true);
    expect(judgeQuota('enterprise', 'script', q).remaining).toBe(-1);
  });
});

describe('配置本身的一致性', () => {
  it('付费档的售卖文案与 totalQuota 对得上', () => {
    // 文案里写的数字必须就是实际执行的上限，这正是当初出问题的地方
    expect(SUBSCRIPTION_PLANS.basic.features.join(' ')).toContain(
      String(SUBSCRIPTION_PLANS.basic.totalQuota)
    );
    expect(SUBSCRIPTION_PLANS.pro.features.join(' ')).toContain(
      String(SUBSCRIPTION_PLANS.pro.totalQuota)
    );
  });

  it('计入总量的功能里不包含知识库', () => {
    expect(COUNTED_FEATURES.map((f) => f.key)).not.toContain('knowledge');
  });

  it('每个计费功能都有对应的 quotas 条目', () => {
    for (const f of COUNTED_FEATURES) {
      for (const planId of ['free', 'basic', 'pro', 'enterprise'] as const) {
        expect(
          SUBSCRIPTION_PLANS[planId].quotas[f.key],
          `${planId} 缺少 ${f.key} 的额度配置`
        ).toBeTypeOf('number');
      }
    }
  });

  it('没有配额记录的新用户按满额对待', () => {
    expect(judgeQuota('free', 'script', null).remaining).toBe(20);
    expect(judgeQuota('basic', 'script', null).remaining).toBe(150);
  });
});
