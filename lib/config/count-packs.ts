/**
 * 次数包（一次付款买断一批创作次数）配置。
 *
 * 【状态】2026-10-20：19.9 元尝鲜包面向所有用户开放（COUNT_PACK_SALES_ENABLED = true）。
 *  - 售价 19.9 元：产品方确认，面向所有用户开放。尚未核算盈利。
 *  - 不限购：产品方决定，买一次可以再买，没有每账号次数上限。
 *  - 次数 20：产品方确认（2026-10-20）。有效期：没有时间限制（2026-10-20 产品方决定），次数不过期。
 *  - 退款规则未定（COUNT_PACK_RULES.refundPolicy），当前只支持管理员驳回尚未通过的订单。
 *
 * 【推荐依据】（2026-10-20，见 .tmp 下的成本查询）
 *  - 单次生成的 token 中位数约 6 万（约 3.5 万–12 万；极端值约 35 万）。Dify 回传的 total_price 全为 0，
 *    模型单价未知，所以不能直接算出元/次。成本 ≈ tokens × 单价，单价确定前不宣称盈利。
 *  - 尝鲜目的：完整走一遍「选题 → 脚本 → 标题 → 审稿 → 分镜」约 5 次，20 次约够 4 条完整链路。
 *  - 防替代会员（2026-10-20 产品方调整：不限购）：19.9 元买 20 次，两个包 40 次 ≈ 39.8 元，低于基础会员 49 元。
 *    产品方的目的是让没用过的用户愿意先试，所以不限购；复购的单次价要高于会员的单次成本，这一点需要后续再看数据。
 *  - 没有时间限制：次数不过期。注意：未用完的次数会长期挂在账上，形成负债，需要产品方留意。
 *  - 扣减顺序：会员额度用完才动次数包。会员额度每期清零，次数包长期有效。
 */

/** 正式销售入口开关。关闭时，下单接口直接拒绝次数包，购买入口和付款页都不显示。 */
export const COUNT_PACK_SALES_ENABLED = true;

/** 次数包订单的 plan_id 前缀（数据库约束按这个前缀放行，见 supabase/migrations/20261020_count_packs.sql） */
export const COUNT_PACK_PREFIX = 'count_pack_';

export interface CountPack {
  id: string;
  /** 内部名称（后台、测试用） */
  name: string;
  /** 给用户看的名称：不写「测试配置」 */
  displayName: string;
  /** 售价（元）。null 表示未定价，不能下单 */
  price: number | null;
  /** 包含的创作次数。未确定前为测试值 */
  credits: number;
  /** 有效期（天）。null 表示不过期 */
  validDays: number | null;
  /** 每账号最多可买几次（已通过的订单数）。null 表示不限 */
  maxPurchasesPerAccount: number | null;
  /** 只用于开发和端到端测试，不得作为正式销售条款对外展示 */
  testConfig: boolean;
}

export const COUNT_PACKS: CountPack[] = [
  {
    id: 'count_pack_trial_19_9',
    name: '尝鲜次数包',
    displayName: '尝鲜次数包',
    price: 19.9,
    credits: 20,
    // 2026-10-20 产品方决定：次数没有时间限制，不过期
    validDays: null,
    // 2026-10-20 产品方决定：不限购，买一次可以再买，主要目的是让没用过的用户愿意先试
    maxPurchasesPerAccount: null,
    testConfig: false,
  },
];

/** 扣减规则。未确定的项目用「未定」标出，不能当成正式条款。 */
export const COUNT_PACK_RULES = {
  /** 每次创作扣几次。统一为 1；不同功能的成本差异大，以后可按功能加权（见 costOfFeature） */
  costPerCreation: 1,
  /** 不计入次数包的功能：知识库查询（另有额度）。联网搜索和深度研究不走创作额度，本来也不参与 */
  excludedFeatures: ['knowledge'] as const,
  /** 扣减顺序：会员额度优先，用完再用次数包 */
  deductionOrder: 'membership_first' as const,
  /** 退款规则：未定。当前实现只支持管理员驳回尚未通过的订单，不做自动退款 */
  refundPolicy: 'undecided' as const,
};

export function countPackById(id: string | null | undefined): CountPack | null {
  if (!id) return null;
  return COUNT_PACKS.find((p) => p.id === id) ?? null;
}

export function isCountPackId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(COUNT_PACK_PREFIX);
}

/**
 * 这个功能每次创作扣几次。返回 null 表示次数包不覆盖该功能。
 */
export function costOfFeature(feature: string): number | null {
  if ((COUNT_PACK_RULES.excludedFeatures as readonly string[]).includes(feature)) return null;
  return COUNT_PACK_RULES.costPerCreation;
}

/**
 * 购买被拒的原因（给用户看的话）。返回 null 表示可以下单。
 * 下单接口、付款页、购买入口共用这一个判定，不各写一份。
 * salesEnabled 默认取开关；测试可以传入另一个值来验证关闭状态。
 */
export function countPackPurchaseBlock(
  id: string | null | undefined,
  salesEnabled: boolean = COUNT_PACK_SALES_ENABLED,
): string | null {
  const pack = countPackById(id);
  if (!pack) return '没有这个次数包';
  if (!salesEnabled) return '次数包暂未开放购买，敬请期待';
  if (pack.price === null || !(pack.price > 0)) return '这个次数包还没有定价，暂时不能购买';
  return null;
}

/** 有效期截止时间。validDays 为 null 时返回 null（不过期）。 */
export function countPackExpiry(pack: CountPack, now: Date): string | null {
  if (pack.validDays === null) return null;
  const end = new Date(now.getTime() + pack.validDays * 86_400_000);
  return end.toISOString();
}
