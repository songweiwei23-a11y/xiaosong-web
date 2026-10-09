import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({ rpc: state.rpc }) }));
import { reserveCreation, settleCreation, releaseCreation, recordCreationCompletion, completionUsage } from '@/lib/creation-quota';
const req = (id?: string) => new Request('http://localhost/api/dify/chat', { headers: id ? { 'X-Generation-Id': id } : {} });
const lease = { userId: 'owner', feature: 'freeChat', requestId: 'request-123456789' };
beforeEach(() => vi.clearAllMocks());

describe('generation reservation adapter', () => {
  it('writes trusted completion with stable id/hash, retrying without duplicate proof', async () => {
    state.rpc.mockResolvedValueOnce({error:{code:'timeout'}}).mockResolvedValueOnce({data:{recorded:true}});
    await recordCreationCompletion(lease,{result:'完整结果',terminal:'message_end',usage:{total_tokens:17}},'自由对话');
    expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(state.rpc.mock.calls[0]).toEqual(state.rpc.mock.calls[1]);
    expect(state.rpc.mock.calls[0][1].p_result_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(state.rpc.mock.calls[0][1].p_terminal).toBe('message_end');
  });
  it('missing completion evidence RPC fails and empty answers are never recorded', async()=>{
    await expect(recordCreationCompletion(lease,{result:' ',terminal:'message_end'})).rejects.toThrow('empty');
    expect(state.rpc).not.toHaveBeenCalled();
    state.rpc.mockResolvedValue({error:{code:'PGRST202'}});
    await expect(recordCreationCompletion(lease,{result:'完整',terminal:'message_end'})).rejects.toThrow('证据');
    expect(state.rpc).toHaveBeenCalledTimes(3);
  });
  it('keeps only real upstream telemetry, never inventing missing usage or price',()=>{
    expect(completionUsage({event:'message_end'})).toEqual({});
    expect(completionUsage({metadata:{usage:{prompt_tokens:12,completion_tokens:'8',total_price:'0.01',currency:'USD',private_key:'secret',latency:true,total_tokens:' '}}})).toEqual({prompt_tokens:12,completion_tokens:8,total_price:0.01,currency:'USD'});
  });
  it('rejects an invalid feature or id before database or model access', async () => {
    expect((await reserveCreation('owner', 'unknown', req(), {})).ok).toBe(false);
    expect((await reserveCreation('owner', 'script', req('short'), {})).ok).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('fails closed when migration is missing, database fails or result is empty', async () => {
    for (const result of [{ error: { code: 'PGRST202' } }, { error: { code: 'connection_error' } }, { data: null }]) {
      state.rpc.mockResolvedValueOnce(result);
      const reserved = await reserveCreation('owner', 'script', req(), { query: 'hello' });
      expect(reserved.ok).toBe(false);
      if (!reserved.ok) expect(reserved.response.status).toBe(503);
    }
    state.rpc.mockRejectedValueOnce(new Error('private details'));
    const result = await reserveCreation('owner', 'script', req(), {});
    if (!result.ok) expect(await result.response.text()).not.toContain('private details');
  });
  it('forwards stable request identity, fingerprint and centralized plan limits', async () => {
    state.rpc.mockResolvedValue({ data: { allowed: true } });
    const first = await reserveCreation('owner', 'freeChat', req(lease.requestId), { query: 'A' });
    expect(first).toEqual({ ok: true, reservation: lease });
    await reserveCreation('owner', 'freeChat', req(lease.requestId), { query: 'A' });
    const args = state.rpc.mock.calls.map(c => c[1]);
    expect(args[0].p_fingerprint).toBe(args[1].p_fingerprint);
    expect(args[0].p_plans.basic.quotas.freeChat).toBe(50);
    expect(args[0].p_features.find((f: { key: string }) => f.key === 'freeChat').column).toBe('free_chat_used');
    await reserveCreation('owner', 'freeChat', req(lease.requestId), { query: 'B' });
    expect(state.rpc.mock.calls[2][1].p_fingerprint).not.toBe(args[0].p_fingerprint);
  });
  it.each([['duplicate', 409], ['conflict', 409], ['quota', 402], ['banned', 403]])('reports %s without silently running the model', async (reason, status) => {
    state.rpc.mockResolvedValue({ data: { allowed: false, reason, used: 5, limit: 5 } });
    const result = await reserveCreation('owner', 'script', req(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(status);
  });
  it('retries ambiguous successful settlement using the same request id', async () => {
    state.rpc.mockResolvedValueOnce({ error: { code: 'timeout' } }).mockResolvedValueOnce({ data: { settled: true } });
    await settleCreation(lease, true, '自由对话', { answer: 'done' });
    expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(state.rpc.mock.calls[0]).toEqual(state.rpc.mock.calls[1]);
    expect(state.rpc.mock.calls[0][1].p_success).toBe(true);
  });
  it('never releases a successful generation on ambiguous commit failure', async () => {
    state.rpc.mockResolvedValue({ error: { code: 'timeout' } });
    await expect(settleCreation(lease, true)).rejects.toThrow('额度状态');
    expect(state.rpc.mock.calls).toHaveLength(3);
    expect(state.rpc.mock.calls.every(c => c[1].p_success === true)).toBe(true);
  });
  it('release is safe on missing lease and uses a failed settlement for failed generation', async () => {
    await releaseCreation(undefined);
    expect(state.rpc).not.toHaveBeenCalled();
    state.rpc.mockResolvedValue({ data: { settled: true } });
    await releaseCreation(lease);
    expect(state.rpc.mock.calls[0][1].p_success).toBe(false);
  });
});
