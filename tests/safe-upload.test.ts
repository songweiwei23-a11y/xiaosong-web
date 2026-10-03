/**
 * 文件上传不被线路切断（2026-10-03）。模拟用户那条线：超过 8KB 的 POST 一律切断。
 * 浏览器端 lib/safe-upload 分段 → /api/body-chunks 按位置暂存 → 接口里 readFormBody 拼回原表单。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { uploadFormSafely, uploadInRanges } from '@/lib/safe-upload';
import { putRange, readFormBody } from '@/lib/read-body';
import { readCode } from './helpers/source';

const OWNER = 'u-test';
const CUT = 8 * 1024;
const md5 = (b: Uint8Array) => createHash('md5').update(b).digest('hex');

/** 假的网络：超过 8KB 的请求切断；分段存进 putRange；最后的请求交给 readFormBody 拼回 */
function fakeLine(opts: { cutAbove?: number; flakyEvery?: number } = {}) {
  const cutAbove = opts.cutAbove ?? CUT;
  let n = 0;
  const calls = { chunks: 0, whole: 0, cut: 0 };
  const fetchMock = vi.fn(async (url: string, init: RequestInit & { headers?: Record<string, string> }) => {
    const body = init.body as Uint8Array | FormData | string;
    const size = body instanceof FormData ? Infinity : typeof body === 'string' ? body.length : body.byteLength;
    if (size > cutAbove || (opts.flakyEvery && ++n % opts.flakyEvery === 0)) { calls.cut++; throw new TypeError('Failed to fetch'); }
    const h = new Headers(init.headers);
    if (url === '/api/body-chunks') {
      calls.chunks++;
      const err = putRange(OWNER, h.get('x-upload-id')!, Number(h.get('x-upload-offset')), Number(h.get('x-upload-total')), Buffer.from(body as Uint8Array));
      return new Response(JSON.stringify(err ? { error: err } : { ok: true }), { status: err ? 400 : 200 });
    }
    calls.whole++;
    const form = await readFormBody(new Request('http://x' + url, { method: 'POST', headers: h, body: typeof body === 'string' ? body : (body as BodyInit) }), OWNER);
    const file = form.get('file') as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    return Response.json({ name: file.name, size: bytes.byteLength, md5: md5(bytes), note: form.get('note') });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const fileOf = (size: number, name = 'shot.jpg') => {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) % 251;
  return { file: new File([bytes], name, { type: 'image/jpeg' }), md5: md5(bytes) };
};

describe('线路差时文件上传', () => {
  it('300KB 的图：整包被切 → 自动分段 → 服务器拼回来一字节不差，表单里别的字段也在', async () => {
    const { file, md5: want } = fileOf(300 * 1024);
    const calls = fakeLine();
    const res = await uploadFormSafely('/api/chat-files', () => { const f = new FormData(); f.append('file', file); f.append('note', '附件'); return f; });
    const got = await res.json();
    expect(got).toEqual({ name: 'shot.jpg', size: 300 * 1024, md5: want, note: '附件' });
    expect(calls.cut).toBeGreaterThan(0); // 整包和 48KB 的段都被切过
    expect(calls.chunks).toBeGreaterThan(300 * 1024 / CUT); // 段缩到 8KB 以内才过
  });

  it('线路时不时还会断（每 5 个请求断 1 个）：照样传完', async () => {
    const { file, md5: want } = fileOf(120 * 1024);
    fakeLine({ flakyEvery: 5 });
    const res = await uploadInRanges('/api/breakdown/upload', (() => { const f = new FormData(); f.append('file', file); return f; })());
    expect((await res.json()).md5).toBe(want);
  });

  it('线路好的时候：整包一次过，不分段', async () => {
    const { file } = fileOf(200 * 1024);
    const calls = fakeLine({ cutAbove: Infinity });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })));
    const res = await uploadFormSafely('/api/chat-files', () => { const f = new FormData(); f.append('file', file); return f; });
    expect(await res.json()).toEqual({ ok: true });
    expect(calls.chunks).toBe(0);
  });

  it('前采提取会扣次数：不先试整包，直接分段（免得服务器收到了、回复丢了，再发一次扣两次）', async () => {
    const { file, md5: want } = fileOf(50 * 1024, 'x.docx');
    const calls = fakeLine();
    const res = await uploadFormSafely('/api/interview/extract', () => { const f = new FormData(); f.append('file', file); return f; }, { rangesOnly: true });
    expect((await res.json()).md5).toBe(want);
    expect(calls.whole).toBe(1); // 只有最后那个空请求
  });
});

describe('服务器端暂存', () => {
  const id = 'a'.repeat(32);

  it('没传完不给拼；只能取自己存的；取一次就没了', async () => {
    const form = new FormData(); form.append('file', new File([new Uint8Array(100)], 'a.bin'));
    const req = new Request('http://x', { method: 'POST', body: form });
    const bytes = Buffer.from(await req.arrayBuffer());
    const ct = req.headers.get('content-type')!;
    const final = (owner: string) => readFormBody(new Request('http://x', { method: 'POST', headers: { 'x-body-ref': id, 'x-body-content-type': ct }, body: '' }), owner);
    expect(putRange(OWNER, id, 0, bytes.length, bytes.subarray(0, 50))).toBeNull();
    await expect(final(OWNER)).rejects.toThrow('没有传完整');
    expect(putRange(OWNER, id, 50, bytes.length, bytes.subarray(50))).toBeNull();
    await expect(final('别人')).rejects.toThrow('没有传完整');
    expect((await final(OWNER)).get('file')).toBeTruthy();
    await expect(final(OWNER)).rejects.toThrow('没有传完整');
  });

  it('挡住乱发：超过 12MB、位置越界、编号不对', () => {
    expect(putRange(OWNER, 'b'.repeat(32), 0, 13 * 1024 * 1024, Buffer.alloc(10))).toBe('文件太大');
    expect(putRange(OWNER, 'c'.repeat(32), 95, 100, Buffer.alloc(10))).toBe('分段位置不正确');
    expect(putRange(OWNER, 'xyz', 0, 100, Buffer.alloc(10))).toBe('编号不正确');
  });

  it('上传类型不是表单的不收', async () => {
    await expect(readFormBody(new Request('http://x', { method: 'POST', headers: { 'x-body-ref': id, 'x-body-content-type': 'application/json' }, body: '' }), OWNER)).rejects.toThrow('上传格式不正确');
  });
});

describe('接线', () => {
  it('四个上传接口都用 readFormBody 读表单', () => {
    for (const f of ['app/api/chat-files/route.ts', 'app/api/breakdown/upload/route.ts', 'app/api/breakdown/transcribe/route.ts', 'app/api/interview/extract/route.ts']) {
      const src = readCode(f);
      expect(src, f).toMatch(/readFormBody\(/);
      expect(src, f).not.toMatch(/\.formData\(\)/);
    }
  });

  it('四处上传都走 uploadFormSafely；分段接口认得按位置存', () => {
    expect(readCode('components/chat/ChatAttachments.tsx')).toMatch(/uploadFormSafely\('\/api\/chat-files'/);
    expect(readCode('lib/breakdown-client.ts')).toMatch(/uploadFormSafely\(url, form\)/);
    expect(readCode('app/dashboard/interview/page.tsx')).toMatch(/uploadFormSafely\("\/api\/interview\/extract"[\s\S]*rangesOnly: true/);
    expect(readCode('app/api/body-chunks/route.ts')).toMatch(/putRange\(/);
  });

  it('页面里没有直接把文件整包 POST 出去的了（扫描要自证非空转：至少扫到 4 处 FormData）', () => {
    const files = ['components/chat/ChatAttachments.tsx', 'lib/breakdown-client.ts', 'app/dashboard/interview/page.tsx'];
    let forms = 0;
    for (const f of files) {
      const src = readCode(f);
      forms += (src.match(/new FormData\(\)/g) ?? []).length;
      expect(src, f).not.toMatch(/fetch\([^)]*body:\s*(form|f)\b/);
    }
    expect(forms).toBeGreaterThanOrEqual(4);
  });
});
