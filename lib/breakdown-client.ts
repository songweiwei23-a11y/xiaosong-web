/**
 * 拆解爆款：浏览器这一侧的几步网络请求（识别口播、上传截图）。只在浏览器用。
 *
 * 这两步都不扣次数、重发没有代价，所以网络断了自动重发——
 * 线上实测编导那边的网络会时不时掐断请求（见 lib/api-error 的 isNetworkError）。
 * 额度用完（402）这类不是重发能解决的，直接抛给页面。
 */
import { isNetworkError, throwApiError } from './api-error';
import type { TranscriptSegment } from './viral-breakdown';

const RETRIES = 2;

async function postForm(url: string, form: () => FormData): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', body: form() });
      // 服务端偶发的 5xx 也重发一次；4xx（没登录、没额度、太大）直接报
      if (res.status >= 500 && attempt < RETRIES) throw new TypeError('Failed to fetch');
      return res;
    } catch (e) {
      if (!isNetworkError(e) || attempt >= RETRIES) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
}

/**
 * 逐段识别，3 路并发。某一段识别失败不拖垮整条——那一段的文字留空，模型照样能看画面拆。
 * 额度、登录这类问题整体抛出。
 */
export async function transcribeSegments(
  segs: { start: number; end: number; wav: Blob }[],
  onProgress?: (done: number, total: number) => void
): Promise<TranscriptSegment[]> {
  const out: TranscriptSegment[] = segs.map(({ start, end }) => ({ start, end, text: '' }));
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < segs.length) {
      const i = next++;
      try {
        const res = await postForm('/api/breakdown/transcribe', () => {
          const f = new FormData();
          f.append('file', segs[i].wav, `segment-${i + 1}.wav`);
          return f;
        });
        if (res.status === 401 || res.status === 402 || res.status === 403) await throwApiError(res, '语音识别失败');
        if (res.ok) out[i].text = String((await res.json())?.text ?? '');
      } catch (e) {
        if ((e as { status?: number }).status) throw e;
        // 这一段网络实在不通：留空，继续下一段
      }
      onProgress?.(++done, segs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, segs.length) }, worker));
  return out;
}

/** 截图拼图一张张传上去，拿回 Dify 文件 id。任何一张传不上都算失败——少一张图，拆解就少一截画面 */
export async function uploadSheets(sheets: Blob[], onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const res = await postForm('/api/breakdown/upload', () => {
      const f = new FormData();
      f.append('file', new File([sheets[i]], `sheet-${i + 1}.jpg`, { type: 'image/jpeg' }));
      return f;
    });
    if (!res.ok) await throwApiError(res, '截图上传失败');
    ids.push(String((await res.json()).id));
    onProgress?.(i + 1, sheets.length);
  }
  return ids;
}
