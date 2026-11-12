/**
 * 浏览器端请求的有限次退避重试。
 *
 * 网络错误（Failed to fetch / Load failed）和幂等读请求的 5xx 会重试。
 * POST / PUT / PATCH / DELETE 不重试 5xx：服务端可能已经写过。
 * 这类写请求只在「很快就失败」的网络错误上重试——那种失败多半是请求没出去。
 * 超过几秒才断的，可能已经到了服务器，交给调用方。
 * 用户离开页面导致的 AbortError 一律不重试。
 */

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS']);
/** 写请求只有在这个时间内失败，才当成「没发出去」重试一次档 */
const WRITE_FAST_FAIL_MS = 3000;

export const FETCH_RETRY_DELAYS_MS = [400, 1200];

export function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function isRetriableNetwork(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(signal: AbortSignal | null | undefined): Error {
  const reason = signal?.reason;
  if (isAbortError(reason)) return reason as Error;
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  options?: { retries?: number; delays?: number[] },
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const delays = options?.delays ?? FETCH_RETRY_DELAYS_MS;
  const method = (init.method || 'GET').toUpperCase();
  const idempotent = IDEMPOTENT.has(method);

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await wait(delays[Math.min(attempt - 1, delays.length - 1)] ?? 400, init.signal);
    const started = Date.now();
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && idempotent && attempt < retries) continue;
      return response;
    } catch (error) {
      if (isAbortError(error) || init.signal?.aborted) throw isAbortError(error) ? error : abortError(init.signal);
      if (!isRetriableNetwork(error) || attempt >= retries) throw error;
      // 非幂等写请求：慢失败不重试，避免重复提交
      if (!idempotent && Date.now() - started > WRITE_FAST_FAIL_MS) throw error;
    }
  }
  throw new TypeError('Failed to fetch');
}
