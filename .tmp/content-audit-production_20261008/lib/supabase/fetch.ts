/** Supabase JSON 请求必须能真正取消，避免网络故障时登录/会话刷新无限等待。 */
export function createSupabaseFetch({
  authTimeoutMs = 12_000,
  requestTimeoutMs = 15_000,
  fetchImpl = (...args) => globalThis.fetch(...args),
}: {
  authTimeoutMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
} = {}): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isAuth = new URL(url).pathname.startsWith('/auth/v1/');
    const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(sourceSignal?.reason);
    if (sourceSignal?.aborted) forwardAbort();
    else sourceSignal?.addEventListener('abort', forwardAbort, { once: true });

    const timeout = setTimeout(() => {
      const error = new Error(isAuth ? 'Authentication request timed out' : 'Supabase request timed out');
      error.name = 'TimeoutError';
      controller.abort(error);
    }, isAuth ? authTimeoutMs : requestTimeoutMs);

    try {
      const response = await fetchImpl(input, {
        ...init,
        ...(isAuth ? { cache: 'no-store' as const } : {}),
        signal: controller.signal,
      });
      // fetch 收到响应头就会返回；JSON 正文也必须在 deadline 内读完。
      // 读克隆保留原始 Response 的 URL、headers、状态和供 SDK 消费的正文。
      if (response.body && (isAuth || response.headers.get('content-type')?.includes('json'))) {
        await response.clone().arrayBuffer();
      }
      return response;
    } finally {
      clearTimeout(timeout);
      sourceSignal?.removeEventListener('abort', forwardAbort);
    }
  };
}

export const supabaseFetch = createSupabaseFetch();
