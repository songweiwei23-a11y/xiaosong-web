/**
 * 进程内的简单限流：同一个 key 在一个时间窗里最多 N 次。
 * 服务器是单进程 pm2，内存计数够用；重启会清零，无所谓——这只是防刷，不是计费。
 */
export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { n: number; since: number }>();
  return function limited(key: string): boolean {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.since > windowMs) {
      hits.set(key, { n: 1, since: now });
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.since > windowMs) hits.delete(k);
      return false;
    }
    h.n += 1;
    return h.n > max;
  };
}
