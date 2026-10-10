import { beforeEach, describe, expect, it } from 'vitest';
import { approveViaRpc, isFunctionMissing, type ApproveInput } from '@/lib/order-approval';
import { coalesce, resetCoalesced } from '@/lib/admin-monitor-data';
import { getRunState, resetRunState, startRun } from '@/lib/quality-regression-run';

/**
 * 2026-10-10 巡检 P2-10（订单事务）、M3（回归后台化）、M4（快照合并）。
 */

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeDb(rpcResult: RpcResult) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const db = {
    from: () => {
      const b: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- 测试替身
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return b;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return rpcResult;
    },
  };
  return { db, calls };
}

const baseInput: ApproveInput = {
  orderId: '10000000-0000-0000-0000-000000000001',
  order: { user_id: '00000000-0000-0000-0000-000000000001', billing_cycle: 'monthly', amount: 199 },
  approved: true,
  note: null,
  planId: 'pro',
  adminId: '00000000-0000-0000-0000-00000000000a',
  now: '2026-10-10T04:00:00.000Z',
};

describe('订单事务函数的接入（P2-10）', () => {
  beforeEach(() => {});

  it('函数还没部署（PGRST202）：返回 null，调用方退回老流程，审核不中断', async () => {
    const { db } = fakeDb({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_approve_order' } });
    expect(await approveViaRpc(db, baseInput)).toBeNull();
    expect(isFunctionMissing({ code: 'PGRST202', message: '' })).toBe(true);
  });

  it('事务成功：返回 200，带 viaTransaction 标记，参数里有套餐和额度清零', async () => {
    const { db, calls } = fakeDb({ data: { orderId: baseInput.orderId, status: 'approved' }, error: null });
    const res = await approveViaRpc(db, baseInput);
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body).toMatchObject({ success: true, viaTransaction: true, data: { status: 'approved' } });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('admin_approve_order');
    expect(calls[0].args).toMatchObject({ p_order_id: baseInput.orderId, p_approved: true, p_plan_id: 'pro', p_admin: baseInput.adminId });
    expect(typeof calls[0].args.p_is_renewal).toBe('boolean');
    expect(calls[0].args.p_quota_columns).toBeTypeOf('object');
  });

  it('重复审核（order_not_reviewing）：返回 409，提示刷新', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'order_not_reviewing:approved' } });
    const res = await approveViaRpc(db, baseInput);
    expect(res?.status).toBe(409);
  });

  it('订单不存在：返回 404', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'order_not_found' } });
    expect((await approveViaRpc(db, baseInput))?.status).toBe(404);
  });

  it('中途失败：返回 500，并说明订单和会员都没有改动', async () => {
    const { db } = fakeDb({ data: null, error: { code: '42703', message: 'column "x" does not exist' } });
    const res = await approveViaRpc(db, baseInput);
    expect(res?.status).toBe(500);
    expect((await res!.json()).error).toContain('都没有改动');
  });

  it('驳回：不带套餐和额度参数，备注去掉首尾空格', async () => {
    const { db, calls } = fakeDb({ data: { orderId: baseInput.orderId, status: 'rejected' }, error: null });
    const res = await approveViaRpc(db, { ...baseInput, approved: false, note: '  金额不对  ' });
    expect(res?.status).toBe(200);
    expect(calls[0].args).toMatchObject({ p_approved: false, p_plan_id: null, p_end_date: null, p_reset_quota: false, p_quota_columns: {}, p_note: '金额不对' });
  });
});

describe('快照合并器（M4）', () => {
  beforeEach(() => resetCoalesced());

  it('ttl 内并发请求共享一次计算', async () => {
    let n = 0;
    const fn = async () => { n++; return 'snap'; };
    const now = 1_000_000;
    const [a, b] = await Promise.all([coalesce('k', 5000, fn, now), coalesce('k', 5000, fn, now + 100)]);
    expect([a, b]).toEqual(['snap', 'snap']);
    expect(n).toBe(1);
  });

  it('超过 ttl 后重新计算', async () => {
    let n = 0;
    const fn = async () => ++n;
    await coalesce('k', 5000, fn, 0);
    await coalesce('k', 5000, fn, 6000);
    expect(n).toBe(2);
  });

  it('失败不缓存：下一次会重试', async () => {
    let n = 0;
    const fn = async () => { n++; if (n === 1) throw new Error('boom'); return 'ok'; };
    await expect(coalesce('k', 5000, fn, 0)).rejects.toThrow('boom');
    await expect(coalesce('k', 5000, fn, 10)).resolves.toBe('ok');
    expect(n).toBe(2);
  });
});

describe('手动回归后台运行（M3）', () => {
  beforeEach(() => resetRunState());

  it('启动后立即是 running，跑完变 done 并带上通过数', async () => {
    const { run, started } = startRun(async () => ({ stored: true, passed: 3, total: 4 }));
    expect(started).toBe(true);
    expect(run.status).toBe('running');
    await new Promise((r) => setTimeout(r, 0));
    expect(getRunState()).toMatchObject({ status: 'done', passed: 3, total: 4, stored: true });
  });

  it('已经在跑：不重复开，返回那一次的状态', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    startRun(async () => { await gate; return {}; });
    const again = startRun(async () => ({}));
    expect(again.started).toBe(false);
    expect(again.run.status).toBe('running');
    release();
  });

  it('失败记成 failed，带上原因（不会变成未处理异常）', async () => {
    startRun(async () => { throw new Error('模型超时'); });
    await new Promise((r) => setTimeout(r, 0));
    expect(getRunState()).toMatchObject({ status: 'failed', error: '模型超时' });
  });
});
