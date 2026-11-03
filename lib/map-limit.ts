/**
 * 同时最多跑 limit 个，结果按原顺序返回（2026-11-03 提速：逐句、逐条问模型从排队改成同时问）。
 * fn 只在轮到时才调用，所以调用方在 fn 里建的超时从真正发出时开始计。
 * 单个失败（抛错）记成 null，不拖垮整批。
 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}

/** 逐句、逐条改写同时问模型的上限：再多容易被上游限流，被限流的那句就只能保留原样 */
export const REWRITE_CONCURRENCY = 3;
