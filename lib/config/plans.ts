// 会员套餐配置
//
// 三种计量方式，由 totalQuota 决定用哪一种：
//
//   totalQuota === null  → 分功能限额。各功能互不相通，脚本用完了
//                          选题仍然能用。免费版、基础版、专业版都走这一档。
//   totalQuota 是数字    → 总量制。所有功能共享一个池子。
//                          目前没有套餐用它，但机制留着，随时可以切。
//   totalQuota === -1    → 无限（企业版）。
//
// 【历史】这里曾经出过一次事：文案写「所有功能 150次/月」，而 quotas 里
// 每个功能都配着 150，且 api-guard 每次都带 feature 走分功能分支——
// 于是一份卖 150 次的套餐实际可用 8 个功能 × 150 = 1200 次。
// 现在计量方式是套餐的显式属性，文案和执行由 quotaSummary() 同源产出，
// 不会再出现「说的是一套、跑的是另一套」。
//
// 【知识库为什么改成限额】
// 原来所有档位都是 -1（无限）。但一次知识库查询就是一次完整的 Dify 调用——
// 先跑 5 个检索节点，再让模型写答案，成本和生成一条脚本是一个量级。
// 「无限」等于免费档有一个不封顶的成本口子，而且它恰恰是这个产品最值钱的
// 那部分（五个专题库的资料），白送没有道理。
//
// 定额的原则：知识库是**查资料**，是为了创作而做的辅助动作，
// 所以每一档都设得比该档的创作额度更宽——不能让"查资料"先于"出内容"用完。
//   免费 20（与自由对话对齐）／基础 100（创作额度的 2 倍）／
//   专业 300（2.5 倍，约每天 10 次）／企业 无限
// 改数字只改下面 quotas 里的那一个值，文案、价格对比表、用量提醒、
// 管理后台统计全都跟着走。
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "免费版",
    price: 0,
    yearlyPrice: 0,
    totalQuota: null as number | null, // 按功能分别限额
    // 这里原来还有一份手写的 features 文案，和下面的 quotas 是同一件事写两遍。
    // 已删除——额度文案一律由 quotaSummary() 现算，卖点由 SELLING_POINTS 提供。
    quotas: {
      // 和自由对话对齐（同样是 20）。这两个都是"问一句"的动作、成本也一样，
      // 给两个不同的数字对用户来说是没道理的差别
      knowledge: 20,
      /*
       * 2026-09-26 起：各板块至少 10 次（产品方定的），分镜、审稿、标题、成交理由
       * 原来免费版是 0（不能用），现在也放开 10 次——让免费用户把一条内容从选题走到标题。
       * 自由对话和知识库本来就是 20，不往下调。
       *
       * positioning 这个桶是四个板块共用的：账号定位、商业定位、内容定位、创作简报。
       * 免费版的它是一次性额度，不按月重置（见 FREE_ONE_TIME_FEATURES）。
       *
       * script 这个桶也是三个板块共用：脚本生成、起号方案、开篇钩子。
       */
      positioning: 10,
      topic: 10,           // 每月
      script: 10,          // 每月
      freeChat: 20,        // 每月
      storyboard: 10,
      review: 10,
      title: 10,
      dealReason: 10
    }
  },
  basic: {
    id: "basic",
    name: "基础会员",
    price: 49,
    yearlyPrice: 470,     // 49 * 12 * 0.8 ≈ 470
    totalQuota: null as number | null, // 按功能分别限额，每个功能各 50 次
    quotas: {
      knowledge: 100,      // 创作额度的 2 倍，查资料不会先于出内容用完
      positioning: 50,
      topic: 50,
      script: 50,
      freeChat: 50,
      storyboard: 50,
      review: 50,
      title: 50,
      dealReason: 50
    }
  },
  pro: {
    id: "pro",
    name: "专业会员",
    price: 99,
    yearlyPrice: 950,     // 99 * 12 * 0.8 ≈ 950
    totalQuota: null as number | null, // 按功能分别限额，每个功能各 120 次
    quotas: {
      knowledge: 300,      // 2.5 倍，约每天 10 次
      positioning: 120,
      topic: 120,
      script: 120,
      freeChat: 120,
      storyboard: 120,
      review: 120,
      title: 120,
      dealReason: 120
    }
  },
  enterprise: {
    id: "enterprise",
    name: "企业版",
    // 改造前这里有两个价：首页和配置写 199，会员页和收款页写 599，
    // 用户在首页看到 199 点进去要付 599。已确认以 199 为准。
    price: 199,
    yearlyPrice: 1910,    // 199 * 12 * 0.8 ≈ 1910
    totalQuota: -1 as number | null, // 无限
    quotas: {
      knowledge: -1,       // 企业版是唯一还无限的档位
      positioning: -1,
      topic: -1,
      script: -1,
      freeChat: -1,
      storyboard: -1,
      review: -1,
      title: -1,
      dealReason: -1
    }
  }
};

// 获取套餐信息
export function getPlan(planId: string) {
  return SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.free;
}

/**
 * 所有计费功能，及其在 user_quotas 表里的列名。
 *
 * 这张表是全站的分发点，加一项等于同时接上六处：
 *   app/api/quota/check    用量提醒、首页"最紧的那个功能"
 *   lib/admin-stats        管理后台的分功能统计
 *   app/pricing            价格对比表的表体
 *   quotaSummary           套餐卡片上的额度文案
 *   三个管理接口            开通/审单/改套餐时的额度清零
 *   sumCountedUsage        总量制下的合计（目前没有套餐用总量制）
 *
 * 知识库原来**不在**这张表里，因为它当时是无限的。现在它有了限额，
 * 就必须进来——否则限额会拦人，但用户在任何地方都看不到自己还剩几次，
 * 只会在某次查询时突然撞上 402。放在最后一位：它是辅助动作，
 * 价格对比表里也一直排在末行。
 */
export const COUNTED_FEATURES: { key: keyof typeof SUBSCRIPTION_PLANS.free.quotas; column: string; name: string }[] = [
  { key: 'script', column: 'script_used', name: '脚本生成' },
  { key: 'topic', column: 'topic_used', name: '选题策划' },
  { key: 'positioning', column: 'positioning_used', name: '账号定位' },
  { key: 'freeChat', column: 'free_chat_used', name: '自由对话' },
  { key: 'storyboard', column: 'storyboard_used', name: '分镜脚本' },
  { key: 'review', column: 'review_used', name: '审稿优化' },
  { key: 'title', column: 'title_used', name: '标题封面' },
  { key: 'dealReason', column: 'deal_reason_used', name: '成交理由' },
  { key: 'knowledge', column: 'knowledge_used', name: '知识库查询' },
];

/**
 * 功能代码 → 给用户看的名字。
 *
 * 原来这是一份手写的对象，和 COUNTED_FEATURES 里的 name 是同一批名字写两遍。
 * 两份立刻就走偏了：手写那份把知识库叫「知识库」，COUNTED_FEATURES 叫
 * 「知识库查询」，于是超额弹窗说的是前者、用量提醒说的是后者。
 * 改成派生，只剩一个源头。
 *
 * 必须放在 COUNTED_FEATURES 之后：const 不提升，写在前面会在模块初始化时
 * 踩到暂时性死区。
 */
export const FEATURE_NAMES: Record<string, string> = Object.fromEntries(
  COUNTED_FEATURES.map((f) => [f.key, f.name])
);

/**
 * 免费版里不按月重置的功能。
 *
 * api-guard 重置配额时有这么一行：
 *     positioning_used: planId === 'free' ? quota.positioning_used : 0
 * 也就是说免费版的账号定位是**一次性**额度，用掉就没了，下个月也不回来。
 * 而 quotaSummary 一律按「N 次/月」渲染，页面上写着「账号定位：3 次/月」——
 * 说的和跑的又对不上。
 *
 * 收敛成一份数据：文案和重置逻辑都读它，不会再各说各话。
 */
export const FREE_ONE_TIME_FEATURES: readonly string[] = ['positioning'];

/**
 * 功能代码 → user_quotas 的列名。驼峰转下划线的写法散落多处，统一到这里。
 *
 * 这里原来有一句 `?? (feature === 'knowledge' ? 'knowledge_used' : undefined)`，
 * 因为知识库当时不在 COUNTED_FEATURES 里，扣减时查不到列名就会被静默跳过。
 * 现在它进表了，那个特例不再需要。
 */
export function usedColumnOf(feature: string): string | undefined {
  return COUNTED_FEATURES.find((f) => f.key === feature)?.column;
}

/** 把一行 user_quotas 里计入总量的各列加起来 */
export function sumCountedUsage(quota: Record<string, any> | null | undefined): number {
  if (!quota) return 0;
  return COUNTED_FEATURES.reduce((sum, f) => sum + (Number(quota[f.column]) || 0), 0);
}

/**
 * 把额度配置翻译成给用户看的几行话。
 *
 * 价格页、会员页、首页原本各自手写这几行，于是「说的是一套、跑的是另一套」——
 * 会员页写着基础版 50 次而实际执行 150 次，首页写免费版账号定位 3 次而
 * 实际是 1 次。现在统一从 quotas 现算，配置改了文案自动跟上。
 */
export function quotaSummary(planId: string): string[] {
  const plan = getPlan(planId);

  if (plan.totalQuota === -1) return ["所有功能：不限次数"];
  if (plan.totalQuota !== null) {
    return [`所有功能合计：${plan.totalQuota} 次/月`, knowledgeLine(planId)];
  }

  /*
   * 分功能制。创作类功能额度相同时合并成一句，否则逐条列出——
   * 付费档八行「XX：50 次/月」是噪音，免费档逐条列才说得清哪些能用。
   *
   * 知识库必须排除在这个合并判断之外。付费档八个创作功能额度一律相同
   * （基础 50、专业 120），而知识库是另一个数（100 / 300）——
   * 它一旦参与判断，unique.size 永远大于 1，合并逻辑当场失效，
   * 付费卡片会从两行变成九行。所以它单独成行接在后面。
   */
  const creation = COUNTED_FEATURES.filter((f) => f.key !== 'knowledge').map((f) => ({
    ...f,
    limit: plan.quotas[f.key] as number,
  }));
  const usable = creation.filter((f) => f.limit > 0);
  const unique = new Set(usable.map((f) => f.limit));

  if (usable.length === creation.length && unique.size === 1) {
    // 「每个创作功能」而不是「每个功能」：知识库不在这句话的覆盖范围里了
    return [`每个创作功能各 ${[...unique][0]} 次/月`, knowledgeLine(planId)];
  }

  return [
    ...usable.map((f) =>
      planId === 'free' && FREE_ONE_TIME_FEATURES.includes(f.key as string)
        ? `${f.name}：${f.limit} 次（一次性，不按月重置）`
        : `${f.name}：${f.limit} 次/月`
    ),
    knowledgeLine(planId),
  ];
}

/**
 * 知识库那一行。
 *
 * 单独抽出来是因为三个分支都要用，而这句话以前在三个分支里各写了一遍
 * 「知识库：不限次数」——正是那种改了一处漏两处的写法。
 */
function knowledgeLine(planId: string): string {
  const n = getPlan(planId).quotas.knowledge as number;
  return n === -1 ? '知识库：不限次数' : `知识库查询：${n} 次/月`;
}

/**
 * 与额度无关的卖点。
 *
 * 套餐的 features 数组里原来混着两种东西：一种是额度（「脚本生成：5次/月」），
 * 一种是服务承诺（「优先客服支持」）。前者和 quotas 是同一件事写了两遍，
 * 改额度时忘了改文案就会对不上——价格页就一直停在手写的那份上。
 *
 * 所以这里只留后者，额度一律由 quotaSummary() 现算。
 *
 * 【2026-09 整改：只留真做了的】
 * 这里原来卖着一串代码里一行都没有的东西：API 接口调用、数据导出权限、
 * 数据分析报告、高级模板 / 定制化模板、专属客服 / 优先客服。
 * 而对外政策是"虚拟商品不支持无理由退款"——卖不存在的权益、又不退款，
 * 是最容易变成纠纷的组合。人工服务类的承诺也撤了：本人确认兑现不了。
 *
 * 现在各档位真实的差别就是额度（quotaSummary 现算）加上功能开放范围。
 * 看上去比原来"少"，但每一条都是真的。
 *
 * 首页、会员页、价格页原本各自手写一份清单，三份还互不一致；
 * 现在三处都只读这里。tests/honest-claims.test.ts 会扫描撤掉的那些词。
 */
const SELLING_POINTS: Record<string, string[]> = {
  free: ['历史记录云端保存'],
  basic: ['九大功能全部开放', '历史记录云端保存'],
  pro: ['九大功能全部开放', '历史记录云端保存'],
  enterprise: ['九大功能全部开放', '历史记录云端保存'],
};

export function planSellingPoints(planId: string): string[] {
  return SELLING_POINTS[planId] ?? [];
}

/** 该套餐完全不支持的功能（额度为 0），用于在价格表上标出限制 */
export function unsupportedFeatures(planId: string): string[] {
  const plan = getPlan(planId);
  if (plan.totalQuota !== null) return [];
  return COUNTED_FEATURES.filter((f) => (plan.quotas[f.key] as number) === 0).map(
    (f) => `不支持${f.name}`
  );
}

/**
 * 这条订阅此刻实际享有的套餐。
 *
 * 【为什么必须有这个函数】原来两个判定点都是同一句：
 *     const planId = subscription?.status === 'active' ? subscription.plan : 'free';
 * 只看 status，不看 end_date。而 end_date 在整个代码库里只写不读——
 * 审核通过时写上一个月后的日期，之后没有任何地方回来看它，
 * 也没有定时任务把 status 改掉。
 *
 * 结果：付 49 块买一个月，基础会员就是永久的。
 * 这是唯一的收入路径上一个直接漏钱的口子，而且不报错、没人会发现。
 *
 * 规则：
 *   - 没有订阅记录 → 免费版
 *   - status 不是 active（含封禁的 inactive）→ 免费版
 *   - end_date 已过 → 免费版
 *   - end_date 为空 → 不过期（线上 10 条订阅目前都是这种，
 *     包括手动开的企业版；按"过期"处理会把它们全部误降级）
 *   - plan 不在套餐表里 → 免费版（脏数据兜底）
 */
export function effectivePlanId(
  sub: { plan?: string | null; status?: string | null; end_date?: string | null } | null | undefined
): string {
  // 判定本体在 effectivePlanIdAt，这里只是取当前时间。只留一份判定逻辑，
  // 会员页显示的状态和服务端放行的依据才不会走偏
  return effectivePlanIdAt(sub, Date.now());
}

export interface MembershipStatus {
  /** 此刻实际享有的套餐（已按到期判定过） */
  planId: string;
  planName: string;
  /** 当前付费套餐的到期时间；免费版或长期有效时为 null */
  endDate: string | null;
  /** 付费套餐且没有到期日——手动开的企业版就是这种 */
  permanent: boolean;
  /** 还剩几天到期；只在付费且有到期日时有值 */
  daysLeft: number | null;
  /** 曾经开过付费套餐、现在已经过期了 */
  expired: { planName: string; endDate: string } | null;
}

/**
 * 给用户看的会员状态。
 *
 * 【为什么要有】到期判定在服务端早就生效了（effectivePlanId），但用户
 * 自己在任何地方都看不到哪天到期——只会某天突然发现额度变少了，
 * 不知道是过期了还是系统出了问题。会员页更糟：当前套餐是写死的
 * `const currentPlan = "free"`，付费会员打开看到的也是"免费版"。
 *
 * 和 effectivePlanId 用同一套判定，不另写一份。
 */
export function membershipStatus(
  sub: { plan?: string | null; status?: string | null; end_date?: string | null } | null | undefined,
  now: number = Date.now()
): MembershipStatus {
  const planId = effectivePlanIdAt(sub, now);
  const plan = getPlan(planId);
  const endMs = sub?.end_date ? new Date(sub.end_date).getTime() : NaN;
  const hasEnd = !Number.isNaN(endMs);
  const paid = planId !== 'free';

  // 过期：订阅本身是 active 的付费套餐，只是到期日过了。
  // 封禁（inactive）不算"过期"——那是另一件事，不能提示人家"续费就好"
  const subscribed = sub?.plan && sub.plan in SUBSCRIPTION_PLANS ? sub.plan : null;
  const expired =
    !paid && subscribed && subscribed !== 'free' && sub?.status === 'active' && hasEnd && endMs <= now
      ? { planName: getPlan(subscribed).name, endDate: sub!.end_date! }
      : null;

  return {
    planId,
    planName: plan.name,
    endDate: paid && hasEnd ? sub!.end_date! : null,
    permanent: paid && !hasEnd,
    daysLeft: paid && hasEnd ? Math.max(0, Math.ceil((endMs - now) / 86_400_000)) : null,
    expired,
  };
}

/** 额度按月重置，与订阅周期无关。年付也是每 30 天一轮额度 */
export const QUOTA_PERIOD_DAYS = 30;

export interface ActivationPlan {
  /** 新的订阅到期日；null 表示保持长期有效 */
  endDate: string | null;
  /** 同款续费且还没到期：从原到期日往后顺延 */
  isRenewal: boolean;
  /** 要不要清零额度、开新一轮额度周期 */
  resetQuota: boolean;
  /** 新额度周期的结束时间（resetQuota 为 true 时才用） */
  quotaPeriodEnd: string;
}

/**
 * 订单审核通过后，订阅该怎么开通、额度该怎么处理。
 *
 * 【原来的两个坑】审核代码原本是：
 *     const endDate = new Date(); endDate.setMonth(+1)      // 从"现在"起算
 *     user_quotas.current_period_end = endDate               // 额度周期 = 订阅周期
 *
 * 1. 从"现在"起算：专业会员还剩 20 天、提前续费一个月，新到期日是
 *    今天 + 1 个月——已经付过钱的那 20 天白白没了。提前续费越早亏得越多。
 * 2. 额度周期跟着订阅走：年付时额度周期被设成一年，而额度只在周期结束后
 *    才重置——**年付用户一整年只有一个月的额度**。付 470 买基础版年付，
 *    拿到 50 条脚本，而不是 12 × 50。
 *
 * 规则：
 *   - 同款、还在有效期内 → 从原到期日顺延；额度不动，按原来的月度节奏走
 *   - 同款、且原本长期有效 → 保持长期有效，不能因为又付了一次钱反而变成会过期
 *   - 新开、升级、降级、已过期 → 从现在起算；额度清零，开新一轮 30 天
 *     （价格页 FAQ 写明"升级后立即生效，未使用的天数不退款"，与此一致）
 *   - 额度周期永远是 30 天，与月付年付无关
 */
export function activationPlan(
  current: { plan?: string | null; status?: string | null; end_date?: string | null } | null | undefined,
  orderPlanId: string,
  cycle: 'monthly' | 'yearly',
  now: number = Date.now()
): ActivationPlan {
  const quotaPeriodEnd = new Date(now + QUOTA_PERIOD_DAYS * 86_400_000).toISOString();
  const addCycle = (base: number) => {
    const d = new Date(base);
    if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };

  const samePlanActive = current?.status === 'active' && current?.plan === orderPlanId;
  const currentEnd = current?.end_date ? new Date(current.end_date).getTime() : NaN;

  if (samePlanActive && !current?.end_date) {
    return { endDate: null, isRenewal: true, resetQuota: false, quotaPeriodEnd };
  }
  if (samePlanActive && !Number.isNaN(currentEnd) && currentEnd > now) {
    return { endDate: addCycle(currentEnd), isRenewal: true, resetQuota: false, quotaPeriodEnd };
  }
  return { endDate: addCycle(now), isRenewal: false, resetQuota: true, quotaPeriodEnd };
}

/** effectivePlanId 的可注入时间版本，给 membershipStatus 和测试用 */
function effectivePlanIdAt(
  sub: { plan?: string | null; status?: string | null; end_date?: string | null } | null | undefined,
  now: number
): string {
  if (!sub || sub.status !== 'active') return 'free';
  if (sub.end_date) {
    const end = new Date(sub.end_date).getTime();
    // 日期解析不出来时按"不过期"处理：宁可少收一次，也不要因为一个
    // 脏字段把正在付费的用户当场降级
    if (!Number.isNaN(end) && end <= now) return 'free';
  }
  const plan = sub.plan ?? '';
  return plan in SUBSCRIPTION_PLANS ? plan : 'free';
}

export interface QuotaVerdict {
  /** 还能不能用 */
  allowed: boolean;
  /** 剩余次数；-1 表示无限 */
  remaining: number;
  /** 上限；-1 表示无限 */
  limit: number;
  /** 已用次数（总量制下是合计） */
  used: number;
  /** 拒绝时给用户看的话 */
  message?: string;
}

/**
 * 判定某个功能此刻能不能用。服务端拦截、前端预检查、额度提醒
 * 三处此前各写了一份大同小异的逻辑，结论互相矛盾（前端按总量、
 * 服务端按单功能），这里收敛成一份。
 */
export function judgeQuota(
  planId: string,
  feature: string,
  quota: Record<string, any> | null | undefined
): QuotaVerdict {
  const plan = getPlan(planId);
  const featureQuota = plan.quotas[feature as keyof typeof plan.quotas];

  // 该功能在这一档就是无限的，不受总量约束。
  // 知识库以前走的是这条路，现在只有企业版还会命中。
  if (featureQuota === -1) {
    return { allowed: true, remaining: -1, limit: -1, used: 0 };
  }

  // 总量制：所有功能共用一个池子
  if (plan.totalQuota !== null) {
    if (plan.totalQuota === -1) {
      return { allowed: true, remaining: -1, limit: -1, used: 0 };
    }
    const used = sumCountedUsage(quota);
    const remaining = Math.max(0, plan.totalQuota - used);
    return {
      allowed: remaining > 0,
      remaining,
      limit: plan.totalQuota,
      used,
      message: remaining > 0
        ? undefined
        : `${plan.name}本月额度已用完（所有功能合计 ${plan.totalQuota} 次），请升级会员或等待下月重置`,
    };
  }

  // 分功能制：免费版
  const column = usedColumnOf(feature);
  const used = column && quota ? Number(quota[column]) || 0 : 0;
  const limit = typeof featureQuota === 'number' ? featureQuota : 0;
  const remaining = Math.max(0, limit - used);
  const featureName = FEATURE_NAMES[feature] || feature;

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    used,
    message: remaining > 0
      ? undefined
      : limit === 0
        ? `${featureName}是会员功能，${plan.name}暂不支持，升级后即可使用`
        : `${featureName}的额度已用完（${plan.name} ${limit} 次/月），请升级会员或等待下月重置`,
  };
}

// 获取所有付费套餐（用于支付页面）
export function getPaidPlans() {
  return [SUBSCRIPTION_PLANS.basic, SUBSCRIPTION_PLANS.pro, SUBSCRIPTION_PLANS.enterprise];
}

// 检查是否有权限使用某功能
export function hasFeatureAccess(planId: string, feature: string, used: number): boolean {
  const plan = getPlan(planId);
  const quota = plan.quotas[feature as keyof typeof plan.quotas];
  
  if (quota === -1) return true;  // 无限额度
  return used < quota;
}

// 获取功能剩余次数
export function getRemainingQuota(planId: string, feature: string, used: number): number | string {
  const plan = getPlan(planId);
  const quota = plan.quotas[feature as keyof typeof plan.quotas];
  
  if (quota === -1) return "无限";
  return Math.max(0, quota - used);
}