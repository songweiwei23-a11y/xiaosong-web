// 代理分成：管理员手动开会员也算（2026-11-02 产品方）——
// 「代理人 A 邀请用户 C，C 私下找管理员付钱、管理员给 C 开了会员，系统识别到 C 开了会员，分成还是归 A，以后一直都是。」
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkOfflinePayment, CHARGEABLE_PLANS, MAX_OFFLINE_AMOUNT, OFFLINE_NOTE } from '@/lib/offline-payment';
import { bucketPaidOrders, commissionAmount } from '@/lib/agents';

describe('收款登记的规则', () => {
  it('付费套餐必须选收没收钱；没选就拦下（免得漏记或重复记）', () => {
    expect(checkOfflinePayment('pro', undefined)).toEqual({ ok: false, error: expect.stringContaining('有没有收钱') });
    expect(checkOfflinePayment('pro', {})).toMatchObject({ ok: false });
    // 免费版（比如降级）不用选
    expect(checkOfflinePayment('free', undefined)).toEqual({ ok: true, payment: null });
  });

  it('没收钱：不记订单', () => {
    expect(checkOfflinePayment('basic', { charged: false })).toEqual({ ok: true, payment: null });
  });

  it('收了钱：金额、周期、方式都要对；金额按分取整', () => {
    expect(checkOfflinePayment('pro', { charged: true, amount: '99', cycle: 'monthly', method: 'wechat' })).toEqual({ ok: true, payment: { amount: 99, cycle: 'monthly', method: 'wechat' } });
    expect(checkOfflinePayment('enterprise', { charged: true, amount: 1999.5, cycle: 'yearly', method: 'alipay' })).toEqual({ ok: true, payment: { amount: 1999.5, cycle: 'yearly', method: 'alipay' } });
    for (const bad of [0, -1, 'abc', MAX_OFFLINE_AMOUNT + 1, 9.999]) expect(checkOfflinePayment('pro', { charged: true, amount: bad, cycle: 'monthly', method: 'wechat' }).ok, String(bad)).toBe(false);
    expect(checkOfflinePayment('pro', { charged: true, amount: 99, cycle: 'weekly', method: 'wechat' }).ok).toBe(false);
    expect(checkOfflinePayment('pro', { charged: true, amount: 99, cycle: 'monthly', method: 'cash' }).ok).toBe(false);
    expect(checkOfflinePayment('free', { charged: true, amount: 99, cycle: 'monthly', method: 'wechat' }).ok).toBe(false);
  });

  it('能记订单的套餐和订单表的约束一致', () => {
    const sql = fs.readFileSync('supabase/migrations/20260922_payment.sql', 'utf8');
    expect(sql).toContain(`plan_id IN (${CHARGEABLE_PLANS.map((p) => `'${p}'`).join(', ')})`);
    expect(sql).toContain("payment_method IN ('alipay', 'wechat')");
    expect(sql).toContain("billing_cycle IN ('monthly', 'yearly')");
  });
});

describe('后台开会员：收了钱就记一笔已通过的会员订单，代理分成按它自动算', () => {
  const route = fs.readFileSync('app/api/admin/users/route.ts', 'utf8');
  const fn = route.slice(route.indexOf("case 'update_membership':"), route.indexOf("case 'reset_quota':"));

  it('先校验收款，再记订单（status=approved、reviewed_at=现在、备注写明线下收款），再改会员', () => {
    expect(fn).toContain('checkOfflinePayment(String(plan), body.payment)');
    expect(fn).toContain("status: 'approved'");
    expect(fn).toContain('reviewed_at: now');
    expect(fn).toContain('review_note: OFFLINE_NOTE');
    expect(fn.indexOf(".from('payment_orders')")).toBeLessThan(fn.indexOf(".from('subscriptions')"));
  });

  it('会员没改成就把刚记的订单撤掉；收款金额记进管理员操作日志', () => {
    expect(fn).toContain("if (offlineOrderId) await supabase.from('payment_orders').delete().eq('id', offlineOrderId);");
    expect(fn).toContain('offlinePayment: paymentCheck.payment ?? null');
  });

  it('代理分成读的就是「这个用户所有已通过的会员订单」，不分线上线下、不限次数和时间', () => {
    const data = fs.readFileSync('lib/agent-data.ts', 'utf8');
    const paid = data.slice(data.indexOf('export async function paidOrdersOf'), data.indexOf('export async function settlementsOf'));
    expect(paid).toContain(".eq('status', 'approved')");
    expect(paid).not.toMatch(/payment_method|review_note|proof/);
    // 线下收的 99 元和线上的一样进当月、一样算分成
    const months = bucketPaidOrders([
      { user_id: 'c', amount: 99, reviewed_at: '2026-11-02T10:00:00+08:00' },
      { user_id: 'c', amount: 99, reviewed_at: '2026-12-02T10:00:00+08:00' },
    ]);
    expect(months.map((m) => [m.period, m.paidAmount])).toEqual([['2026-12', 99], ['2026-11', 99]]);
    expect(commissionAmount(99, 0.2)).toBe(19.8);
  });

  it('绑定是永久的：用户唯一、第一次绑定为准；代理删不掉（RESTRICT）', () => {
    const sql = fs.readFileSync('supabase/migrations/20261028_agents.sql', 'utf8');
    expect(sql).toContain('user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,');
    expect(sql).toContain('agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT');
  });

  it('后台页面：付费套餐必须选收没收钱，每次打开都重新选；说清计入哪位代理的分成', () => {
    const page = fs.readFileSync('app/admin/users/page.tsx', 'utf8');
    expect(page).toContain('if (paidPlan && charged === null) return notify("请先选这次开会员有没有收钱", "error");');
    expect(page).toContain('setCharged(null);');
    expect(page).toContain('自动计入这位代理本月的分成');
    expect(OFFLINE_NOTE).toContain('线下收款');
  });
});
