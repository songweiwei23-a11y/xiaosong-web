import { describe, it, expect } from 'vitest';
import {
  judgeQuota,
  SUBSCRIPTION_PLANS,
  COUNTED_FEATURES,
  quotaSummary,
  unsupportedFeatures,
  planSellingPoints,
} from '@/lib/config/plans';

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

/*
 * 下面几条原来把「5 次」这个数字写死在断言里。额度是会调的——
 * 体检发现免费版走不完引导路径后就从 5 改成了 8——一调就红一片，
 * 而红的原因跟逻辑对不对无关，只是数字变了。
 *
 * 所以改成从配置里取上限，断言的是边界行为：到上限前放行、到了就拦。
 * 「够不够走完一条内容」这个产品要求由文件末尾那组用例单独守。
 */
const FREE_SCRIPT = SUBSCRIPTION_PLANS.free.quotas.script;
const FREE_TOPIC = SUBSCRIPTION_PLANS.free.quotas.topic;

describe('免费版：按功能分别限额', () => {
  it('脚本用完了不影响选题', () => {
    const q = usage({ script_used: FREE_SCRIPT });
    expect(judgeQuota('free', 'script', q).allowed).toBe(false);
    expect(judgeQuota('free', 'topic', q).allowed).toBe(true);
    expect(judgeQuota('free', 'topic', q).remaining).toBe(FREE_TOPIC);
  });

  it('到上限前仍可用，到了上限才拦', () => {
    expect(judgeQuota('free', 'script', usage({ script_used: FREE_SCRIPT - 1 })).allowed).toBe(true);
    expect(judgeQuota('free', 'script', usage({ script_used: FREE_SCRIPT })).allowed).toBe(false);
  });

  it('额度为 0 的功能提示的是「会员功能」而不是「已用完」', () => {
    // 免费版现在各板块都 ≥5，没有额度为 0 的了；机制还要留着，临时设一个 0 来验
    const quotas = SUBSCRIPTION_PLANS.free.quotas as Record<string, number>;
    const saved = quotas.storyboard;
    quotas.storyboard = 0;
    try {
      const verdict = judgeQuota('free', 'storyboard', usage());
      expect(verdict.allowed).toBe(false);
      expect(verdict.message).toContain('会员功能');
      expect(verdict.message).not.toContain('已用完');
    } finally {
      quotas.storyboard = saved;
    }
  });

  it('免费版：自由对话、知识库各 10 次，前采建档 3 次，其余每个板块 5 次（2026-09-29 定），分镜、审稿、标题、成交理由也能用', () => {
    for (const [k, v] of Object.entries(SUBSCRIPTION_PLANS.free.quotas)) {
      const want = k === 'freeChat' || k === 'knowledge' ? 10 : k === 'interview' ? 3 : 5;
      expect(v as number, `免费版 ${k}`).toBe(want);
    }
    for (const f of ['storyboard', 'review', 'title', 'dealReason']) {
      expect(judgeQuota('free', f, usage()).allowed, f).toBe(true);
    }
  });

  it('用完时的提示写明了是哪个功能、上限多少', () => {
    const verdict = judgeQuota('free', 'script', usage({ script_used: FREE_SCRIPT }));
    expect(verdict.message).toContain('脚本生成');
    expect(verdict.message).toContain(String(FREE_SCRIPT));
  });

  it('知识库也有限额了，用满就拦', () => {
    const limit = SUBSCRIPTION_PLANS.free.quotas.knowledge as number;
    expect(judgeQuota('free', 'knowledge', usage({ knowledge_used: limit - 1 })).allowed).toBe(true);
    expect(judgeQuota('free', 'knowledge', usage({ knowledge_used: limit })).allowed).toBe(false);
  });

  it('知识库和创作额度互不影响', () => {
    // 分功能制的本意：查资料查完了不该连脚本都不能生成
    const q = usage({ knowledge_used: SUBSCRIPTION_PLANS.free.quotas.knowledge as number });
    expect(judgeQuota('free', 'knowledge', q).allowed).toBe(false);
    expect(judgeQuota('free', 'script', q).allowed).toBe(true);
  });
});

describe('基础会员：每个功能各 50 次', () => {
  it('每个功能各算各的，脚本用满不影响分镜', () => {
    const q = usage({ script_used: 50 });
    expect(judgeQuota('basic', 'script', q).allowed).toBe(false);
    expect(judgeQuota('basic', 'storyboard', q).allowed).toBe(true);
    expect(judgeQuota('basic', 'storyboard', q).remaining).toBe(50);
  });

  it('第 50 次仍可用，第 51 次才拦', () => {
    expect(judgeQuota('basic', 'script', usage({ script_used: 49 })).allowed).toBe(true);
    expect(judgeQuota('basic', 'script', usage({ script_used: 50 })).allowed).toBe(false);
  });

  it('九个功能全部开放，没有额度为 0 的', () => {
    for (const f of COUNTED_FEATURES) {
      expect(
        SUBSCRIPTION_PLANS.basic.quotas[f.key],
        `基础会员的 ${f.name} 不该是 0`
      ).toBeGreaterThan(0);
    }
  });

  it('创作额度用光后仍可查资料（知识库是独立的桶）', () => {
    const q = usage({ script_used: 50, topic_used: 50 });
    expect(judgeQuota('basic', 'script', q).allowed).toBe(false);
    expect(judgeQuota('basic', 'knowledge', q).allowed).toBe(true);
  });
});

describe('专业会员每个功能 120 次、企业版无限', () => {
  it('专业会员单功能 120 到顶', () => {
    expect(judgeQuota('pro', 'script', usage({ script_used: 119 })).allowed).toBe(true);
    expect(judgeQuota('pro', 'script', usage({ script_used: 120 })).allowed).toBe(false);
  });

  it('专业会员每个功能都比基础会员宽', () => {
    for (const f of COUNTED_FEATURES) {
      expect(
        SUBSCRIPTION_PLANS.pro.quotas[f.key],
        `专业会员的 ${f.name} 不该少于基础会员`
      ).toBeGreaterThan(SUBSCRIPTION_PLANS.basic.quotas[f.key]);
    }
  });

  it('企业版怎么用都放行', () => {
    const q = usage({ script_used: 99999 });
    expect(judgeQuota('enterprise', 'script', q).allowed).toBe(true);
    expect(judgeQuota('enterprise', 'script', q).remaining).toBe(-1);
  });
});

/**
 * 文案与执行同源：曾经文案写「所有功能 150次/月」而实际每个功能各 150 次，
 * 一份套餐卖出了 8 倍的量。现在页面上的话由 quotaSummary 从 quotas 现算。
 */
describe('额度文案由配置现算', () => {
  it('付费档创作额度一致时合并成一句', () => {
    expect(quotaSummary('basic').join(' ')).toContain('每个创作功能各 50 次/月');
    expect(quotaSummary('pro').join(' ')).toContain('每个创作功能各 120 次/月');
  });

  it('合并那一句不能把知识库也说进去', () => {
    /*
     * 知识库的额度和创作功能不是一个数（基础 50 / 100，专业 120 / 300）。
     * 如果这句还写成「每个功能各 50 次/月」，用户会按 50 去理解知识库，
     * 而它实际是 100——说少了同样是说错。
     */
    for (const planId of ['basic', 'pro'] as const) {
      const lines = quotaSummary(planId);
      const merged = lines.find((l) => l.includes('每个'))!;
      expect(merged, `${planId} 的合并句还在说"每个功能"`).not.toMatch(/每个功能各/);
      // 知识库必须另起一行，且写的是它自己的数
      const kb = SUBSCRIPTION_PLANS[planId].quotas.knowledge as number;
      expect(lines.join(' '), `${planId} 没有单独写知识库的额度`).toContain(`知识库查询：${kb} 次/月`);
    }
  });

  it('付费档卡片不会因为知识库变成九行', () => {
    // 合并逻辑一旦被知识库带崩，这里会从 2 行变成 9 行
    expect(quotaSummary('basic').length).toBe(2);
    expect(quotaSummary('pro').length).toBe(2);
  });

  it('只有企业版还写"知识库不限次数"', () => {
    expect(quotaSummary('enterprise').join(' ')).toContain('不限次数');
    for (const planId of ['free', 'basic', 'pro'] as const) {
      expect(
        quotaSummary(planId).join(' '),
        `${planId} 还在承诺知识库不限次数，而它已经有额度了`
      ).not.toContain('知识库：不限次数');
    }
  });

  it('免费档逐条列出，说得清哪些能用', () => {
    const lines = quotaSummary('free').join(' ');
    // 同样从配置取数，避免调额度时这里跟着红
    // 免费版是新账号一次性体验（2026-09-27 起全部功能都不按月重置），
    // 所以写「N 次」不写「N 次/月」——详见 payment-flow.test.ts 里那组用例
    expect(lines).toContain(`脚本生成：${SUBSCRIPTION_PLANS.free.quotas.script} 次`);
    expect(lines).toContain(`选题策划：${SUBSCRIPTION_PLANS.free.quotas.topic} 次`);
    expect(lines).toContain(`账号定位：${SUBSCRIPTION_PLANS.free.quotas.positioning} 次`);
    expect(lines).not.toContain('次/月');
    expect(quotaSummary('free')[0]).toContain('一次性');
  });

  it('免费档不把额度为 0 的功能写成「0 次」，而是归入不支持', () => {
    // 同上：临时设一个 0 验证机制
    const quotas = SUBSCRIPTION_PLANS.free.quotas as Record<string, number>;
    const saved = quotas.storyboard;
    quotas.storyboard = 0;
    try {
      expect(quotaSummary('free').join(' ')).not.toContain('：0 次');
      expect(unsupportedFeatures('free').join(' ')).toContain('分镜脚本');
    } finally {
      quotas.storyboard = saved;
    }
    // 现在的免费版：没有不支持的功能
    expect(unsupportedFeatures('free')).toEqual([]);
  });

  it('企业版直接写不限次数', () => {
    expect(quotaSummary('enterprise').join(' ')).toContain('不限次数');
  });

  it('文案里的数字必须等于实际配额', () => {
    for (const planId of ['free', 'basic', 'pro'] as const) {
      const text = quotaSummary(planId).join(' ');
      for (const f of COUNTED_FEATURES) {
        const limit = SUBSCRIPTION_PLANS[planId].quotas[f.key] as number;
        if (limit > 0) {
          expect(text, `${planId} 的文案里找不到 ${f.name} 的 ${limit}`).toContain(String(limit));
        }
      }
    }
  });
});

describe('配置本身的一致性', () => {
  /*
   * 原来这里断言的是套餐自带的 features 文案里能找到 50 / 120 / 5次。
   * 那份手写文案已经删掉了——它和 quotas 是同一件事写两遍，
   * 而价格页正是读的那一份，改额度时会悄悄留在旧数字上。
   *
   * 现在只有一个来源，所以改成断言"卖点里不许再出现额度数字"，
   * 防止哪天有人又把次数写回文案里。
   */
  it('卖点文案里不含额度数字——额度只能有一个来源', () => {
    for (const planId of ['free', 'basic', 'pro', 'enterprise'] as const) {
      const text = planSellingPoints(planId).join(' ');
      expect(text, `${planId} 的卖点里出现了数字，额度文案该由 quotaSummary 现算`).not.toMatch(
        /\d+\s*次/
      );
    }
  });

  it('额度文案确实由 quotas 现算', () => {
    expect(quotaSummary('basic').join(' ')).toContain('50');
    expect(quotaSummary('pro').join(' ')).toContain('120');
    expect(quotaSummary('enterprise').join(' ')).toContain('不限次数');
  });

  /*
   * 这条原来断言的是相反的事：「计入总量的功能里不包含知识库」。
   * 当时知识库是无限的，放进那张表等于查几次资料就吃掉创作次数。
   *
   * 现在它有了限额，就必须进表——COUNTED_FEATURES 是全站的分发点，
   * 用量提醒、管理后台统计、价格对比表、额度清零都从它派生。
   * 不在表里的后果不是报错，而是：限额照样拦人，但用户在任何地方
   * 都看不到自己还剩几次，只会在某一次查询时突然撞上 402。
   */
  it('知识库在计费功能表里——否则限额拦得住人却没人看得见', () => {
    expect(COUNTED_FEATURES.map((f) => f.key)).toContain('knowledge');
  });

  it('超额提示里的功能名和用量提醒里的是同一个', async () => {
    /*
     * FEATURE_NAMES 以前是手写的第二份名单，和 COUNTED_FEATURES 的 name
     * 立刻就走偏了：一个叫「知识库」、一个叫「知识库查询」，
     * 于是 402 弹窗和额度提醒对同一个功能给出两个名字。
     */
    const { FEATURE_NAMES } = await import('@/lib/config/plans');
    for (const f of COUNTED_FEATURES) {
      expect(FEATURE_NAMES[f.key], `${f.key} 在两处的名字不一致`).toBe(f.name);
    }
  });

  it('知识库用满时的提示说得清是哪个功能、上限多少', () => {
    const limit = SUBSCRIPTION_PLANS.free.quotas.knowledge as number;
    const verdict = judgeQuota('free', 'knowledge', usage({ knowledge_used: limit }));
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toContain('知识库');
    expect(verdict.message).toContain(String(limit));
    // 不能说成"会员功能"——免费版是有知识库的，只是用完了
    expect(verdict.message).not.toContain('会员功能');
  });

  it('每个计费功能都能查到 user_quotas 的列名', async () => {
    // usedColumnOf 查不到列名时，扣减会被静默跳过——用了不计次
    const { usedColumnOf } = await import('@/lib/config/plans');
    for (const f of COUNTED_FEATURES) {
      expect(usedColumnOf(f.key), `${f.name} 查不到列名，扣减会被静默跳过`).toBe(f.column);
    }
  });

  it('知识库按等级递增，企业版才是无限', () => {
    const kb = (id: keyof typeof SUBSCRIPTION_PLANS) =>
      SUBSCRIPTION_PLANS[id].quotas.knowledge as number;
    expect(kb('free')).toBeGreaterThan(0);
    expect(kb('basic')).toBeGreaterThan(kb('free'));
    expect(kb('pro')).toBeGreaterThan(kb('basic'));
    expect(kb('enterprise')).toBe(-1);
  });

  it('知识库额度不低于同档的创作额度', () => {
    /*
     * 定额时的原则：查资料是为创作服务的辅助动作，不能比创作先用完。
     * 否则用户会遇到"还能写脚本，但查不了资料"这种说不通的状态。
     */
    for (const planId of ['free', 'basic', 'pro'] as const) {
      const kb = SUBSCRIPTION_PLANS[planId].quotas.knowledge as number;
      const maxCreation = Math.max(
        ...COUNTED_FEATURES.filter((f) => f.key !== 'knowledge').map(
          (f) => SUBSCRIPTION_PLANS[planId].quotas[f.key] as number
        )
      );
      expect(kb, `${planId} 的知识库(${kb})比创作额度(${maxCreation})还紧`).toBeGreaterThanOrEqual(
        maxCreation
      );
    }
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
    for (const id of ['free', 'basic', 'pro'] as const) {
      expect(judgeQuota(id, 'script', null).remaining).toBe(SUBSCRIPTION_PLANS[id].quotas.script);
    }
  });

  it('月付价是正整数（2026-09-27 起只卖月付）', () => {
    for (const id of ['basic', 'pro', 'enterprise'] as const) {
      const p = SUBSCRIPTION_PLANS[id];
      expect(Number.isInteger(p.price) && p.price > 0, `${id} 月付价不对`).toBe(true);
    }
  });

  it('额度用完的提示：免费版不叫人"等下月"（它不会重置）', () => {
    const full = { script_used: 999 };
    expect(judgeQuota('free', 'script', full).message).toContain('不按月重置');
    expect(judgeQuota('free', 'script', full).message).not.toContain('下月');
    expect(judgeQuota('basic', 'script', full).message).toContain('本期');
  });
});

/**
 * 价格曾经在四个地方各写一份：lib/config/plans.ts、首页、会员页、收款页。
 * 结果企业版在首页写 199、收款页收 599，用户看到一个价点进去是另一个价；
 * 基础版 29 和 30 并存；额度写着 50/200 而实际执行 150/500。
 *
 * 现在四处都从 plans.ts 取值。这组用例守住「没有第二处价格」这件事。
 */
describe('价格只有一个源头', () => {
  const PAGES = [
    'app/page.tsx',
    'app/payment/page.tsx',
    'app/dashboard/membership/page.tsx',
  ];

  it('展示价格的页面都从 plans.ts 取值，不自己写价目表', async () => {
    const fs = await import('node:fs');
    for (const page of PAGES) {
      const src = fs.readFileSync(page, 'utf8');
      expect(src, `${page} 没有引入 lib/config/plans`).toMatch(/@\/lib\/config\/plans/);
    }
  });

  it('页面里不再出现写死的套餐价', async () => {
    const fs = await import('node:fs');
    // 注释里可以提这些数字（用来解释当初为什么出错），代码里不行
    const priceLike = /(?:price|yearly|yearlyPrice)\s*[:=]\s*(\d{2,4})/g;
    for (const page of PAGES) {
      const src = fs
        .readFileSync(page, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      const hits = [...src.matchAll(priceLike)].map((m) => m[1]);
      expect(hits, `${page} 里仍有写死的价格：${hits.join('、')}`).toEqual([]);
    }
  });
});

/**
 * 免费版必须能走完产品自己引导的路径。
 *
 * 这是体检时发现的：positioning 桶是四个板块共用的，而免费版只给 1 次。
 * 首页「先打地基」却把 档案→定位→简报 标成 1-2-3 步让用户按顺序做——
 * 第 2 步用掉唯一一次，第 3 步没额度。而简报正是让其他板块用上账号信息
 * 的那一环，免费用户永远走不到产品最值钱的地方，然后就走了。
 *
 * 这类问题不报错、不影响构建，只体现为"用户试了一下就不来了"。
 */
describe('免费版走得完引导路径', () => {
  /** 板块 → 额度桶，与 lib/task-type.ts 保持一致 */
  const BOARD_BUCKET: Record<string, string> = {
    账号定位: 'positioning',
    创作简报: 'positioning',
    选题策划: 'topic',
    开篇钩子: 'script',
    脚本生成: 'script',
  };

  const freeQuota = (bucket: string) =>
    SUBSCRIPTION_PLANS.free.quotas[bucket as keyof typeof SUBSCRIPTION_PLANS.free.quotas] as number;

  /** 走一遍某条路径要消耗的各桶次数 */
  const cost = (boards: string[]) => {
    const need: Record<string, number> = {};
    for (const b of boards) need[BOARD_BUCKET[b]] = (need[BOARD_BUCKET[b]] ?? 0) + 1;
    return need;
  };

  it('首页「先打地基」这三步能做完', () => {
    // 档案不计费，定位和简报都吃 positioning
    const need = cost(['账号定位', '创作简报']);
    for (const [bucket, n] of Object.entries(need)) {
      expect(
        freeQuota(bucket),
        `免费版 ${bucket} 只有 ${freeQuota(bucket)} 次，而走完地基要 ${n} 次`
      ).toBeGreaterThanOrEqual(n);
    }
  });

  it('首页主流程至少能完整走通一条内容', () => {
    // 选题 → 开篇 → 脚本（分镜和标题免费版本来就不开放，不算在内）
    const need = cost(['选题策划', '开篇钩子', '脚本生成']);
    for (const [bucket, n] of Object.entries(need)) {
      expect(
        freeQuota(bucket),
        `免费版 ${bucket} 只有 ${freeQuota(bucket)} 次，走通一条内容要 ${n} 次`
      ).toBeGreaterThanOrEqual(n);
    }
  });

  it('地基 + 一条内容加起来也够', () => {
    const need = cost(['账号定位', '创作简报', '选题策划', '开篇钩子', '脚本生成']);
    for (const [bucket, n] of Object.entries(need)) {
      expect(
        freeQuota(bucket),
        `免费版 ${bucket} 不够：有 ${freeQuota(bucket)} 次，需要 ${n} 次`
      ).toBeGreaterThanOrEqual(n);
    }
  });

  it('共用同一个桶的板块都登记在这张表里', async () => {
    // 新板块接进来时如果忘了登记，上面几条就会变成空检查
    const { TASK_TYPE_TO_FEATURE } = await import('@/lib/task-type');
    for (const [board, bucket] of Object.entries(BOARD_BUCKET)) {
      expect(TASK_TYPE_TO_FEATURE[board], `${board} 在 task-type 里的桶变了`).toBe(bucket);
    }
  });
});
