/**
 * 次数包的扣减链路（2026-10-20）：会员额度用完才动次数包；结算时先找会员预留，找不到再找次数包预留。
 * 数据库函数不在这里执行（见 supabase 迁移文件）。这里用假的 rpc 验证 TS 侧的分支和参数。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type RpcFn = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

const rpc = vi.fn<RpcFn>();
vi.mock('@/lib/admin-auth', () => ({
  getServiceSupabase: () => ({ rpc }),
}));

import { reserveCreation, settleCreation } from '@/lib/creation-quota';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const req = () => new Request('http://localhost/api/dify/stream', { method: 'POST' });

describe('预留：会员额度优先，用完才动次数包', () => {
  beforeEach(() => rpc.mockReset());

  it('会员额度用完、次数包有余额：放行，并用次数包预留（扣 1 次）', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'quota', used: 5, limit: 5 });
      if (name === 'kaiwu_reserve_pack_credit') return ok({ allowed: true, funded_by: 'count_pack' });
      return ok({});
    });
    const r = await reserveCreation('u1', 'script', req(), { a: 1 });
    expect(r.ok).toBe(true);
    const packCall = rpc.mock.calls.find((c) => c[0] === 'kaiwu_reserve_pack_credit');
    expect(packCall?.[1]).toMatchObject({ p_user_id: 'u1', p_feature: 'script', p_cost: 1 });
  });

  it('会员额度用完、次数包也没有：照常返回额度用完（402），不吞掉原因', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'quota', used: 5, limit: 5 });
      if (name === 'kaiwu_reserve_pack_credit') return ok({ allowed: false, reason: 'pack_empty' });
      return ok({});
    });
    const r = await reserveCreation('u1', 'script', req(), { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      const body = await r.response.json();
      expect(body.code).toBe('QUOTA_EXHAUSTED');
      expect(body.limit).toBe(5);
    }
  });

  it('知识库不计次数包：会员额度用完也不去扣次数包', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'quota', used: 10, limit: 10 });
      return ok({});
    });
    const r = await reserveCreation('u1', 'knowledge', req(), { a: 1 });
    expect(r.ok).toBe(false);
    expect(rpc.mock.calls.some((c) => c[0] === 'kaiwu_reserve_pack_credit')).toBe(false);
  });

  it('重复提交（duplicate）不去扣次数包，直接 409', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'duplicate', state: 'pending' });
      return ok({});
    });
    const r = await reserveCreation('u1', 'script', req(), { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(409);
    expect(rpc.mock.calls.some((c) => c[0] === 'kaiwu_reserve_pack_credit')).toBe(false);
  });

  it('迁移还没执行（次数包函数不存在）：会员额度用完照常 402，不能变成 503', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'quota', used: 5, limit: 5 });
      if (name === 'kaiwu_reserve_pack_credit') return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.kaiwu_reserve_pack_credit' } });
      return ok({});
    });
    const r = await reserveCreation('u1', 'script', req(), { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      expect((await r.response.json()).code).toBe('QUOTA_EXHAUSTED');
    }
  });

  it('次数包预留出错：返回额度暂不可用（503），不放行', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_reserve_creation') return ok({ allowed: false, reason: 'quota', used: 5, limit: 5 });
      if (name === 'kaiwu_reserve_pack_credit') return Promise.resolve({ data: null, error: { message: 'boom' } });
      return ok({});
    });
    const r = await reserveCreation('u1', 'script', req(), { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
  });
});

describe('结算：先按会员预留找，找不到再按次数包预留找', () => {
  beforeEach(() => rpc.mockReset());
  const reservation = { userId: 'u1', requestId: 'req-1234567890abcdef', feature: 'script' };

  it('会员预留存在：只调会员结算，不调次数包', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_settle_creation') return ok({ settled: true });
      return ok({ settled: false });
    });
    await settleCreation(reservation, true, 'script', {});
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['kaiwu_settle_creation']);
  });

  it('会员预留找不到（次数包预留）：改调次数包结算', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_settle_creation') return ok({ settled: false });
      if (name === 'kaiwu_settle_pack_credit') return ok({ settled: true });
      return ok({});
    });
    await expect(settleCreation(reservation, true, 'script', {})).resolves.toBeUndefined();
    const packCall = rpc.mock.calls.find((c) => c[0] === 'kaiwu_settle_pack_credit');
    expect(packCall?.[1]).toMatchObject({ p_user_id: 'u1', p_request_id: reservation.requestId, p_success: true, p_task_type: 'script' });
  });

  it('两边都找不到：重试后抛出错误，不假装成功', async () => {
    rpc.mockImplementation((name) => {
      if (name === 'kaiwu_settle_creation') return ok({ settled: false });
      if (name === 'kaiwu_settle_pack_credit') return ok({ settled: false });
      return ok({});
    });
    await expect(settleCreation(reservation, true)).rejects.toThrow();
  });
});
