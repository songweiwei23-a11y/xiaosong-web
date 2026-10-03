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
  if (typeof init.body !== 'string') return fetch(url, init);
  const raw = new TextEncoder().encode(init.body);
  if (raw.byteLength <= SAFE_BYTES) return fetch(url, init);

  const headers = new Headers(init.headers);
  const packed = await gzip(raw);
  const payload = packed ?? raw;
  if (packed) headers.set('X-Body-Encoding', 'gzip');
  headers.set('Content-Type', 'application/octet-stream');

  if (payload.byteLength <= SAFE_BYTES) {
    return fetch(url, { ...init, headers, body: payload as BodyInit });
  }

  // 压缩后还大：分块先存到服务器，每块都在安全线以内
  const id = newId();
  const total = Math.ceil(payload.byteLength / CHUNK_BYTES);
  for (let i = 0; i < total; i++) {
    const part = payload.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const r = await fetch('/api/body-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Body-Id': id, 'X-Chunk-Index': String(i), 'X-Chunk-Total': String(total) },
          body: part as BodyInit,
          signal: init.signal,
        });
        if (r.status === 401) return r;
        ok = r.ok;
      } catch (e) {
        if (init.signal?.aborted) throw e;
      }
    }
    if (!ok) throw new TypeError('Failed to fetch（内容分块上传失败）');
  }
  headers.set('X-Body-Ref', id);
  return fetch(url, { ...init, headers, body: '' });
}
