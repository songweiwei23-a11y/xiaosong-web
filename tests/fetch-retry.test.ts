import { describe, expect, it, vi } from 'vitest';
import { fetchWithBackoff } from '@/lib/fetch-retry';

describe('fetchWithBackoff', () => {
  it('GET 的 5xx 会重试，POST 的 5xx 不重试', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('no', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const got = await fetchWithBackoff('/api/creation-sessions?id=1', { method: 'GET' }, { retries: 2, delays: [0, 0] });
    expect(got.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('no', { status: 500 }));
    const posted = await fetchWithBackoff('/api/orders', { method: 'POST' }, { retries: 2, delays: [0, 0] });
    expect(posted.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('写请求的慢网络失败不重试，快失败才会再试', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const fetchMock = vi.fn(async () => {
      now += 5_000;
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchWithBackoff('/api/orders', { method: 'POST' }, { retries: 2, delays: [0, 0] })).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = 1_000;
    fetchMock.mockImplementation(async () => {
      now += 10;
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchWithBackoff('/api/orders', { method: 'POST' }, { retries: 2, delays: [0, 0] })).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1 + 3);
    vi.restoreAllMocks();
  });

  it('AbortError 不重试', async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchWithBackoff('/api/creation-sessions?id=1', {}, { retries: 2, delays: [0, 0] })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
