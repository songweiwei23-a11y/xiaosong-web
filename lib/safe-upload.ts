/**
 * 文件上传不被线路切断（2026-10-03）。浏览器端。
 *
 * 文字请求的问题 lib/safe-post 已经解决：用户线路差时超过约 8KB 的 POST 会被直接切断。
 * 文件上传（自由对话附件、拆解爆款的截图和分段录音、前采 Word）还是整包发，一张图几百 KB，
 * 线路差的时候必断；拆解那两处原来有自动重发，但重发的还是整包，照样断。
 *
 * 做法：
 * 1. 先整包发——线路好的时候和原来一模一样，不多花一秒
 * 2. 网络断了：把整个表单（含文件、字段、边界）原样序列化成字节，按字节位置切段送到 /api/body-chunks；
 *    段从 48KB 起，哪段断了就减半重发，最小 6KB（8KB 是会被切的线）；3 路并发
 * 3. 最后发一个空的请求带着编号和原来的 Content-Type，服务器用 lib/read-body 的 readFormBody 拼回原表单，
 *    接口后面的逻辑一行不用改
 */
import { isNetworkError } from './api-error';

const START_CHUNK = 48 * 1024;
const MIN_CHUNK = 6 * 1024;
const ATTEMPTS = 4;
const PARALLEL = 3;

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');

export interface SafeUploadOptions {
  signal?: AbortSignal;
  /** 分段时的进度（已传字节、总字节），整包成功时不会调 */
  onProgress?: (sent: number, total: number) => void;
  /**
   * 不先试整包、直接分段。给会扣次数的接口用（前采提取）：整包"断了"也可能是服务器收到了、只是回复丢了，
   * 再分段发一次就会提取两次、扣两次
   */
  rangesOnly?: boolean;
}

/** 把表单序列化成字节和带 boundary 的 Content-Type（和浏览器整包发的一模一样） */
export async function serializeForm(form: FormData): Promise<{ bytes: Uint8Array; contentType: string }> {
  const req = new Request('http://local/upload', { method: 'POST', body: form });
  return { bytes: new Uint8Array(await req.arrayBuffer()), contentType: req.headers.get('content-type') || '' };
}

/**
 * 上传表单。buildForm 每次调用都要造一个新的 FormData（整包失败后要重新序列化）。
 * 返回目标接口的 Response，调用方照常处理。
 */
export async function uploadFormSafely(url: string, buildForm: () => FormData | Promise<FormData>, opts: SafeUploadOptions = {}): Promise<Response> {
  if (opts.rangesOnly) return uploadInRanges(url, await buildForm(), opts);
  try {
    return await fetch(url, { method: 'POST', body: await buildForm(), signal: opts.signal });
  } catch (e) {
    if (opts.signal?.aborted || !isNetworkError(e)) throw e;
  }
  return uploadInRanges(url, await buildForm(), opts);
}

/** 分段上传（导出给测试用；页面一律走 uploadFormSafely） */
export async function uploadInRanges(url: string, form: FormData, opts: SafeUploadOptions = {}): Promise<Response> {
  const { bytes, contentType } = await serializeForm(form);
  const id = newId();
  const total = bytes.byteLength;
  let chunk = START_CHUNK;
  let next = 0;
  let sent = 0;

  const sendRange = async (offset: number, size: number): Promise<number> => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const end = Math.min(total, offset + size);
      try {
        const r = await fetch('/api/body-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Id': id, 'X-Upload-Offset': String(offset), 'X-Upload-Total': String(total) },
          body: bytes.subarray(offset, end) as BodyInit,
          signal: opts.signal,
        });
        if (r.status === 401) throw Object.assign(new Error('登录已过期，请重新登录'), { status: 401 });
        if (!r.ok) {
          const msg = (await r.json().catch(() => ({})))?.error;
          throw Object.assign(new Error(msg || '文件分段上传失败'), { status: r.status });
        }
        return end - offset;
      } catch (e) {
        if (opts.signal?.aborted || (e as { status?: number }).status) throw e;
        // 被切了：这一段和之后的段都减半
        size = Math.max(MIN_CHUNK, Math.floor(size / 2));
        chunk = Math.min(chunk, size);
      }
    }
    throw new TypeError('Failed to fetch（文件分段上传失败，网络太不稳定）');
  };

  const worker = async () => {
    while (next < total) {
      const offset = next;
      const size = chunk;
      next = Math.min(total, offset + size);
      const done = await sendRange(offset, size);
      // 这一段因为减半只传了一部分：剩下的补回队列（单线程事件循环，下一轮再领）
      if (done < size && offset + done < Math.min(total, offset + size)) await sendRest(offset + done, Math.min(total, offset + size));
      sent += Math.min(total, offset + size) - offset;
      opts.onProgress?.(sent, total);
    }
  };
  const sendRest = async (from: number, to: number) => {
    let at = from;
    while (at < to) at += await sendRange(at, Math.min(chunk, to - at));
  };

  await Promise.all(Array.from({ length: Math.min(PARALLEL, Math.ceil(total / MIN_CHUNK)) }, worker));
  return fetch(url, { method: 'POST', headers: { 'X-Body-Ref': id, 'X-Body-Content-Type': contentType }, body: '', signal: opts.signal });
}
