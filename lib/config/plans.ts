// 会员套餐配置
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "免费版",
    price: 0,
    yearlyPrice: 0,
    features: [
      "知识库：10次/月",
      "账号定位：3次/月",
      "选题策划：5次/月",
      "脚本生成：3次/月",
      "自由对话：15次/月",
      "其他功能：2-3次/月"
    ],
    quotas: {
      knowledge: 10,        // 从无限改为10次/月
      positioning: 3,       // 从1次改为3次/月
      topic: 5,             // 从3次改为5次/月
      script: 3,            // 从20次改为3次/月 ⭐ 主要降低
      freeChat: 15,         // 从20次改为15次/月
      storyboard: 2,        // 从0次改为2次/月
      review: 3,            // 从0次改为3次/月
      title: 3,             // 从0次改为3次/月
      dealReason: 3         // 从0次改为3次/月
    }
  },
  basic: {
    id: "basic",
    name: "基础会员",
    price: 30,
    yearlyPrice: 288,     // 30 * 12 * 0.8 = 288
    features: [
      "知识库：无限使用",
      "所有功能：150次/月",
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
    features: [
      "知识库：无限使用",
      "所有功能：500次/月",
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
    price: 199,
    yearlyPrice: 1910,    // 199 * 12 * 0.8 ≈ 1910
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
