/**
 * 大请求不被线路掐断（2026-10-02）。浏览器端。
 *
 * 线上实测：用户这条线路时好时坏，差的时候**超过约 8KB 的 POST 会被直接切断**（连接重置，
 * 服务器一条记录都没有，浏览器报 Failed to fetch）。同一时刻：
 *   - 8KB 以内的随机内容 4/4 通过；11KB 的连全是 "aaa" 的都 0/4
 *   - 「创作方向」带上创作简报、成交理由后约 11KB → 每次都失败，其它板块小于 8KB → 正常
 *   - 同一个请求 gzip 后 5.5KB → 6/6 通过
 * 之前「Failed to fetch 多半是网络掐断大 POST」说的就是它。
 *
 * 做法：超过 SAFE_BYTES 先 gzip；压缩后还大就切成小块先存到服务器（/api/body-chunks），
 * 最后发一个很小的请求带着块编号。服务器端用 lib/read-body 的 readJsonBody 还原，后面逻辑不变。
 */

/** 留足余量：8KB 是会被切的线，请求头还要占一些 */
export const SAFE_BYTES = 6 * 1024;
import { createHistoryId } from './history-id';

/** Reuse this init for network retries; a new user operation receives a new ID. */
const GENERATION_URL = /^\/api\/(?:dify\/(?:chat|stream)|interview\/extract)(?:\?|$)/;
export function withGenerationId(url: string, init: RequestInit): RequestInit {
  if (!GENERATION_URL.test(url)) return init;
  const headers = new Headers(init.headers);
  if (!headers.has('X-Generation-Id')) headers.set('X-Generation-Id', createHistoryId());
  return { ...init, headers };
}
const CHUNK_BYTES = 5 * 1024;

async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

/**
 * 发 JSON 请求，大了自动压缩 / 分块。init.body 必须是 JSON 字符串；其它情况原样发。
 * 返回的就是目标接口的 Response，调用方照常处理。
 */
export async function postSafely(url: string, init: RequestInit): Promise<Response> {
  init = withGenerationId(url, init);
  if (typeof init.body !== 'string') return fetchFresh(url, init);
  const raw = new TextEncoder().encode(init.body);
  if (raw.byteLength <= SAFE_BYTES) return fetchFresh(url, init);

  const headers = new Headers(init.headers);
  const packed = await gzip(raw);
  const payload = packed ?? raw;
  if (packed) headers.set('X-Body-Encoding', 'gzip');
  headers.set('Content-Type', 'application/octet-stream');

  if (payload.byteLength <= SAFE_BYTES) {
    return fetchFresh(url, { ...init, headers, body: payload as BodyInit });
  }

  // 压缩后还大：分块先存到服务器，每块都在安全线以内
  const id = newId();
  const total = Math.ceil(payload.byteLength / CHUNK_BYTES);
  let unauthorized: Response | null = null;
  const sendChunk = async (i: number) => {
    const part = payload.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    // 2026-10-05：长对话一次要传十几块，原来每块连着重试 3 次、中间不等，线路抖一下整次保存就失败。
    // 现在每次重试前等一会儿，让抖动过去
    for (let attempt = 0; attempt < CHUNK_RETRY_DELAYS.length; attempt++) {
      if (unauthorized) return;
      if (CHUNK_RETRY_DELAYS[attempt]) await wait(CHUNK_RETRY_DELAYS[attempt], init.signal);
      try {
        const r = await fetch('/api/body-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Body-Id': id, 'X-Chunk-Index': String(i), 'X-Chunk-Total': String(total) },
          body: part as BodyInit,
          signal: init.signal,
        });
        if (r.status === 401) { unauthorized = r; return; }
        if (r.ok) return;
      } catch (e) {
        if (init.signal?.aborted) throw e;
      }
    }
    throw new TypeError('Failed to fetch（内容分块上传失败）');
  };
  // 同时传几块：每块都要过一遍登录校验，一块一块传的话十几块要二十多秒
  let next = 0;
  const lane = async () => { while (next < total && !unauthorized) await sendChunk(next++); };
  await Promise.all(Array.from({ length: Math.min(CHUNK_PARALLEL, total) }, lane));
  if (unauthorized) return unauthorized;
  headers.set('X-Body-Ref', id);
  return fetchFresh(url, { ...init, headers, body: '' });
}

/**
 * 「秒失败」自动重发（2026-10-05 推广到所有走这里的请求）。
 *
 * 线上：自由对话里停了十几分钟，再点「创作方向」带过去，弹出 Failed to fetch——服务器一条记录都没有。
 * 浏览器拿了一条已经被线路断掉的空闲连接去发，立刻失败，请求根本没出去（10-02 生成请求碰到过同一件事，
 * 当时只在 fetchGeneration 里补了重发；带去下一步、保存对话、收藏这些没补）。
 * 3 秒内就失败的才重发：那时请求还没到服务器；更久才失败的可能已经到了，交给调用方。
 */
export const FAST_FAIL_MS = 3000;
/*
 * 再次线上（2026-10-05 23:3x）：闲了几分钟后点「开篇钩子」，原来的 2 次重发（1 秒多）全落在死连接上。
 * 死连接可能有好几条，要一条条试掉，线路也要缓一下——保存类请求放宽到 5 次重发、前后约 9 秒
 */
export const FAST_FAIL_RETRY_DELAYS = [300, 800, 1500, 2500, 4000];

async function fetchFresh(url: string, init: RequestInit): Promise<Response> {
  // 要扣次数的生成只重发一次（10-02 定的）；其余保存类请求重发两次
  const retries = GENERATION_URL.test(url) ? 1 : FAST_FAIL_RETRY_DELAYS.length;
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    try {
      return await fetch(url, init);
    } catch (e) {
      const network = e instanceof TypeError && /fetch|network|load failed/i.test(e.message);
      if (!network || init.signal?.aborted || Date.now() - started > FAST_FAIL_MS || attempt >= retries) throw e;
      await wait(FAST_FAIL_RETRY_DELAYS[attempt], init.signal);
    }
  }
}

/** 每块最多试 4 次，重试前分别等这么久（毫秒） */
export const CHUNK_RETRY_DELAYS = [0, 800, 2000, 4000];
const CHUNK_PARALLEL = 3;

function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}
