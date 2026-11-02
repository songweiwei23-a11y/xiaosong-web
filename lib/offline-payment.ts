/**
 * 后台手动开会员时登记线下收款（2026-11-02 产品方）：
 * 「代理人 A 邀请用户 C 进来，C 私下找管理员付了钱，管理员给 C 开了会员——系统识别到 C 开了会员，分成还是归 A，以后一直都是。」
 *
 * 机制（产品方确认）：
 * - 归属：用代理的邀请码注册就永久绑定这个代理（agent_referrals，第一次绑定为准，不会变）；
 * - 分成：这个用户每一笔「已通过的会员订单」都算进代理当月的分成，续费、升级都算，不限次数、不限时间（lib/agent-data 的 paidOrdersOf）；
 * - 原来管理员手动开会员只改会员、不记账，所以线下付的钱进不了分成。现在手动开通时必须选「这次收钱了吗」：
 *     收了钱 → 记一笔已通过的会员订单（线下收款），自动进分成，和线上付款一模一样；
 *     没收钱（赠送、补偿、只是改到期日）→ 不记订单、不算分成，免得改个日期就重复算一笔。
 * 金额按实际收到的填（默认套餐价），分成按这个金额算。
 */

/** 能记订单的套餐（payment_orders.plan_id 的约束） */
export const CHARGEABLE_PLANS = ['basic', 'pro', 'enterprise'] as const;
export type ChargeablePlan = (typeof CHARGEABLE_PLANS)[number];

export interface OfflinePayment {
  amount: number;
  cycle: 'monthly' | 'yearly';
  method: 'wechat' | 'alipay';
}

/** 一笔收款最多登记多少（防手滑多打几个 0） */
export const MAX_OFFLINE_AMOUNT = 100_000;

export type OfflineCheck =
  | { ok: true; payment: OfflinePayment | null }
  | { ok: false; error: string };

/**
 * 校验后台开会员时填的收款信息。
 *   charged === false：没收钱，不记订单；
 *   charged === true：要有金额（大于 0、最多两位小数、不超过上限）、周期、方式；套餐是免费版不能记收款；
 *   没选（undefined）：开的是付费套餐就必须选，免得漏记或者重复记。
 */
export function checkOfflinePayment(plan: string, input: unknown): OfflineCheck {
  const paidPlan = (CHARGEABLE_PLANS as readonly string[]).includes(plan);
  const raw = (input && typeof input === 'object' ? input : {}) as { charged?: unknown; amount?: unknown; cycle?: unknown; method?: unknown };
  if (raw.charged === false) return { ok: true, payment: null };
  if (raw.charged !== true) {
    return paidPlan ? { ok: false, error: '请先选这次开会员有没有收钱：收了钱会计入邀请他的代理的分成' } : { ok: true, payment: null };
  }
  if (!paidPlan) return { ok: false, error: '免费版不能登记收款；收了钱请选付费套餐' };
  const amount = typeof raw.amount === 'string' ? Number(raw.amount) : raw.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: '收款金额要大于 0' };
  if (amount > MAX_OFFLINE_AMOUNT) return { ok: false, error: `收款金额超过 ${MAX_OFFLINE_AMOUNT} 元，请核对` };
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) return { ok: false, error: '收款金额最多两位小数' };
  const cycle = raw.cycle === 'yearly' ? 'yearly' : raw.cycle === 'monthly' ? 'monthly' : null;
  if (!cycle) return { ok: false, error: '请选收的是月付还是年付' };
  const method = raw.method === 'alipay' ? 'alipay' : raw.method === 'wechat' ? 'wechat' : null;
  if (!method) return { ok: false, error: '请选收款方式：微信或支付宝' };
  return { ok: true, payment: { amount: Math.round(amount * 100) / 100, cycle, method } };
}

/** 线下收款订单的备注：后台订单列表、代理账单里一眼看得出是管理员手动开通登记的 */
export const OFFLINE_NOTE = '线下收款：管理员手动开通会员时登记';
