// 会员套餐配置
//
// 两种计量方式，由 totalQuota 决定用哪一种：
//
//   totalQuota === null  → 分功能限额（免费版）。各功能互不相通，
//                          脚本 20 次用完了，选题的 3 次仍然能用。
//   totalQuota 是数字    → 总量制（基础/专业会员）。所有功能共享一个池子，
//                          这才是「所有功能：150次/月」这句文案的意思。
//   totalQuota === -1    → 无限（企业版）。
//
// 此前没有这个字段，付费版走的是分功能分支，quotas 里每个功能都写着 150，
// 于是 30 块钱的基础会员实际可用 8 个功能 × 150 = 1200 次，是文案的 8 倍。
// api-guard 里那段总量校验写了但永远执行不到——调用方每次都传了 feature。
//
// 知识库在所有付费档都是 -1，且不计入总量：文案单独承诺了「无限使用」。
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "免费版",
    price: 0,
    yearlyPrice: 0,
    totalQuota: null as number | null, // 免费版按功能分别限额
    features: [
      "知识库：无限使用",
      "账号定位：1次",
      "选题策划：3次/月",
      "脚本生成：20次/月",
      "自由对话：20次/月",
      "其他功能：0次"
    ],
    quotas: {
      knowledge: -1,        // -1 表示无限
      positioning: 1,       // 一次性额度
      topic: 3,            // 每月
      script: 20,          // 每月
      freeChat: 20,        // 每月
      storyboard: 0,
      review: 0,
      title: 0,
      dealReason: 0
    }
  },
  basic: {
    id: "basic",
    name: "基础会员",
    price: 49,
    yearlyPrice: 470,     // 49 * 12 * 0.8 ≈ 470
    totalQuota: 150 as number | null, // 所有功能共用 150 次（知识库除外）
    features: [
      "知识库：无限使用",
      "所有功能合计：150次/月",
      "高级模板支持",
      "标准客服支持"
    ],
    quotas: {
      knowledge: -1,
      positioning: 150,
      topic: 150,
      script: 150,
      freeChat: 150,
      storyboard: 150,
      review: 150,
      title: 150,
      dealReason: 150
    }
  },
  pro: {
    id: "pro",
    name: "专业会员",
    price: 99,
    yearlyPrice: 950,     // 99 * 12 * 0.8 ≈ 950
    totalQuota: 500 as number | null, // 所有功能共用 500 次（知识库除外）
    features: [
      "知识库：无限使用",
      "所有功能合计：500次/月",
      "全部高级模板",
      "优先客服支持",
      "数据分析报告"
    ],
    quotas: {
      knowledge: -1,
      positioning: 500,
      topic: 500,
      script: 500,
      freeChat: 500,
      storyboard: 500,
      review: 500,
      title: 500,
      dealReason: 500
    }
  },
  enterprise: {
    id: "enterprise",
    name: "企业版",
    // ⚠️ 待定：改造前三处写着两个价——首页和这里 199，会员页和收款页 599，
    // 用户在首页看到 199 点进去要付 599。暂取 199：它是对外公示过的价，
    // 也是较低的那个，宁可少收也不能变成先低价引流再抬价。
    // 确定之后只改这两行，全站页面都从这里取值。
    price: 199,
    yearlyPrice: 1910,    // 199 * 12 * 0.8 ≈ 1910
    totalQuota: -1 as number | null, // 无限
    features: [
      "所有功能：无限使用",
      "定制化模板",
      "专属客服支持",
      "API接口调用",
      "数据导出权限"
    ],
    quotas: {
      knowledge: -1,
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

// 功能名称映射
export const FEATURE_NAMES: Record<string, string> = {
  knowledge: "知识库",
  positioning: "账号定位",
  topic: "选题策划",
  script: "脚本生成",
  freeChat: "自由对话",
  storyboard: "分镜脚本",
  review: "审稿优化",
  title: "标题封面",
  dealReason: "成交理由"
};

// 获取套餐信息
export function getPlan(planId: string) {
  return SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.free;
}

/**
 * 计入总量的功能，及其在 user_quotas 表里的列名。
 *
 * 知识库不在其中——所有档位都承诺「无限使用」，把它算进总量
 * 等于查几次资料就把创作次数吃掉了。
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
];

/** 功能代码 → user_quotas 的列名。驼峰转下划线的写法散落多处，统一到这里 */
export function usedColumnOf(feature: string): string | undefined {
  return COUNTED_FEATURES.find((f) => f.key === feature)?.column
    ?? (feature === 'knowledge' ? 'knowledge_used' : undefined);
}

/** 把一行 user_quotas 里计入总量的各列加起来 */
export function sumCountedUsage(quota: Record<string, any> | null | undefined): number {
  if (!quota) return 0;
  return COUNTED_FEATURES.reduce((sum, f) => sum + (Number(quota[f.column]) || 0), 0);
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

  // 该功能本身就是无限的（知识库），不受总量约束
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