import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFetch } from '@/lib/supabase/fetch';

afterEach(() => vi.useRealTimers());

function abortableRequest(signal: AbortSignal) {
  return new Promise<Response>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

describe('Supabase 请求等待边界', () => {
  it('超时会取消真实认证请求，且不自行重试密码登录', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const fetchImpl = vi.fn((_, init) => {
      signal = init!.signal as AbortSignal;
      return abortableRequest(signal);
    });
    const bounded = createSupabaseFetch({ authTimeoutMs: 50, fetchImpl });
    const request = bounded('https://project.supabase.co/auth/v1/token', { method: 'POST' });
    const assertion = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(signal.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('调用者取消会传递到上游，保留原始原因并清理计时器', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const reason = new Error('caller cancelled');
    const bounded = createSupabaseFetch({ fetchImpl: (_, init) => abortableRequest(init!.signal as AbortSignal) });
    const request = bounded('https://project.supabase.co/auth/v1/user', { signal: caller.signal });
    const assertion = expect(request).rejects.toBe(reason);
    caller.abort(reason);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('保持认证错误 HTTP 状态和正文，强制认证请求不缓存', async () => {
    const response = new Response(JSON.stringify({ error: 'invalid_credentials' }), {
      status: 400, headers: { 'content-type': 'application/json', 'x-test': 'unchanged' },
    });
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
    const bounded = createSupabaseFetch({ fetchImpl });
    const result = await bounded('https://project.supabase.co/auth/v1/token', {
      method: 'POST', body: 'password-body', headers: { apikey: 'test-only' },
    });
    expect(result).toBe(response);
    expect(result.status).toBe(400);
    expect(result.headers.get('x-test')).toBe('unchanged');
    expect(await result.json()).toEqual({ error: 'invalid_credentials' });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'POST', body: 'password-body', headers: { apikey: 'test-only' }, cache: 'no-store',
    });
  });

  it('收到响应头但 JSON 正文卡住，仍会取消请求', async () => {
    let upstreamSignal!: AbortSignal;
    const bounded = createSupabaseFetch({
      authTimeoutMs: 25,
      fetchImpl: async (_, init) => {
        upstreamSignal = init!.signal as AbortSignal;
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{'));
            upstreamSignal.addEventListener('abort', () => controller.error(upstreamSignal.reason), { once: true });
          },
        });
        return new Response(body, { headers: { 'content-type': 'application/json' } });
      },
    });
    await expect(bounded('https://project.supabase.co/auth/v1/token')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(upstreamSignal.aborted).toBe(true);
  });

  it('数据库 JSON 请求有独立截止时间，不改变调用者缓存参数', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_, init) => abortableRequest(init!.signal as AbortSignal));
    const bounded = createSupabaseFetch({ authTimeoutMs: 10, requestTimeoutMs: 40, fetchImpl });
    const request = bounded('https://project.supabase.co/rest/v1/profiles', { cache: 'no-store' });
    const assertion = expect(request).rejects.toMatchObject({ name: 'TimeoutError', message: 'Supabase request timed out' });
    await vi.advanceTimersByTimeAsync(10);
    expect((fetchImpl.mock.calls[0][1]!.signal as AbortSignal).aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
    expect(fetchImpl.mock.calls[0][1]!.cache).toBe('no-store');
  });
});
