/**
 * 大请求不被线路掐断（2026-10-02）：用户线路差时超过约 8KB 的 POST 被切断，
 * 「创作方向」带上简报约 11KB，每次都报「网络断了」。浏览器端压缩 / 分块，服务器端还原。
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { postSafely, SAFE_BYTES } from '@/lib/safe-post';
import { readJsonBody, putChunk } from '@/lib/read-body';
import { readCode } from './helpers/source';

afterEach(() => vi.unstubAllGlobals());

/** 假 fetch：分块送到 putChunk，目标请求记下来 */
function fakeNetwork(owner = 'user-1') {
  const sent: { url: string; init: RequestInit; bytes: number }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body as any;
    const bytes = typeof body === 'string' ? Buffer.byteLength(body) : body?.byteLength ?? 0;
    sent.push({ url, init, bytes });
    if (url === '/api/body-chunks') {
      const h = new Headers(init.headers);
      const err = putChunk(owner, h.get('x-body-id')!, Number(h.get('x-chunk-index')), Number(h.get('x-chunk-total')), Buffer.from(body));
      return new Response(JSON.stringify(err ? { error: err } : { ok: true }), { status: err ? 400 : 200 });
    }
    return new Response('ok');
  }));
  return sent;
}

/** 把记下来的目标请求交给服务器端还原 */
const restore = (s: { url: string; init: RequestInit }, owner = 'user-1') =>
  readJsonBody(new Request('http://x' + s.url, { method: 'POST', headers: s.init.headers, body: s.init.body as BodyInit }), owner);

/** 像真实提示词一样不好压缩的内容 */
const noisy = (n: number) => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2) + '串火锅'; return s.slice(0, n); };

describe('postSafely + readJsonBody', () => {
  it('小请求原样发', async () => {
    const sent = fakeNetwork();
    const data = { taskType: '选题策划', query: '你好' };
    await postSafely('/api/dify/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    expect(sent).toHaveLength(1);
    expect(sent[0].init.body).toBe(JSON.stringify(data));
    expect(await restore(sent[0])).toEqual(data);
  });

  it('大但好压缩的（真实提示词这种）：gzip 后一次发出，每次都在安全线以内，还原一字不差', async () => {
    const sent = fakeNetwork();
    const data = { taskType: '创作方向', query: '## 这个账号的档案\n- 经营品类：川味串串火锅、川味烧烤、川菜\n'.repeat(200) };
    await postSafely('/api/dify/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    expect(sent).toHaveLength(1);
    expect(sent[0].bytes).toBeLessThanOrEqual(SAFE_BYTES);
    expect(new Headers(sent[0].init.headers).get('x-body-encoding')).toBe('gzip');
    expect(await restore(sent[0])).toEqual(data);
  });

  it('压缩后还大：分块先存、最后的请求只带编号；每一块都在安全线以内', async () => {
    const sent = fakeNetwork();
    const data = { taskType: '自由对话', query: noisy(40_000) };
    await postSafely('/api/dify/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const chunks = sent.filter((s) => s.url === '/api/body-chunks');
    const final = sent[sent.length - 1];
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.bytes).toBeLessThanOrEqual(SAFE_BYTES);
    expect(final.url).toBe('/api/dify/chat');
    expect(new Headers(final.init.headers).get('x-body-ref')).toMatch(/^[0-9a-f]{32}$/);
    expect(await restore(final)).toEqual(data);
  });

  it('分块只能取一次、只能取自己存的', async () => {
    const sent = fakeNetwork('owner-a');
    await postSafely('/api/dify/chat', { method: 'POST', body: JSON.stringify({ q: noisy(30_000) }) });
    const final = sent[sent.length - 1];
    await expect(restore(final, 'someone-else')).rejects.toThrow('没有传完整');
    expect(await restore(final, 'owner-a')).toHaveProperty('q');
    await expect(restore(final, 'owner-a')).rejects.toThrow('没有传完整');
  });

  it('分块编号、序号、大小都校验', () => {
    expect(putChunk('u', 'bad-id', 0, 1, Buffer.from('x'))).toBe('编号不正确');
    expect(putChunk('u', 'a'.repeat(32), 5, 2, Buffer.from('x'))).toBe('分块序号不正确');
    expect(putChunk('u', 'b'.repeat(32), 0, 9999, Buffer.from('x'))).toBe('分块序号不正确');
  });
});

describe('接线', () => {
  it('生成请求统一走 postSafely（fetchGeneration 里）', () => {
    expect(readCode('lib/api-error.ts')).toMatch(/return await postSafely\(url, init\)/);
  });

  it('生成、存档、收藏三类大请求的接口都用 readJsonBody 读', () => {
    for (const f of ['app/api/dify/stream/route.ts', 'app/api/dify/chat/route.ts', 'app/api/creative-history/route.ts', 'app/api/library/route.ts']) {
      expect(readCode(f), f).toMatch(/readJsonBody\(/);
      expect(readCode(f), f).not.toMatch(/await req(uest)?\.json\(\)/);
    }
  });

  it('保存生成结果、收藏到素材库的前端也走 postSafely', () => {
    expect(readCode('hooks/useCreativeHistory.ts')).toMatch(/postSafely\('\/api\/creative-history'/);
    expect(readCode('lib/library.ts')).toMatch(/postSafely\('\/api\/library'/);
  });
});

/**
 * 扫描：会带大段内容的接口（对话记录、定位全文、生成结果、前采原文、档案），
 * 前端写入一律走 postSafely、后端一律用 readJsonBody。漏一处，线路差时那里就会报「网络断了」。
 */
describe('扫描：大内容接口都接上了', () => {
  const BIG_APIS = ['chat-conversations', 'positioning', 'topics', 'scripts', 'deal-reasons', 'profiles', 'interview/revise', 'interview/history', 'interview/save', 'interview/extract', 'creative-history', 'library', 'dify/stream', 'dify/chat'];
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  const clientFiles = ['app', 'components', 'hooks', 'lib'].flatMap((d) => walk(path.join(process.cwd(), d))).filter((f) => !f.includes(`${path.sep}api${path.sep}`));

  it('前端没有直接 fetch 写入这些接口（除了特别大的文件直接上传）', () => {
    const api = BIG_APIS.map((a) => a.replace('/', '\\/')).join('|');
    const re = new RegExp(`\\bfetch\\(\\s*[\`'"]\\/api\\/(?:${api})(?:[?\`'"$][^,]*)?,\\s*\\{[\\s\\S]{0,240}?method:\\s*['"](?:POST|PUT|PATCH)['"]`);
    const bad = clientFiles.filter((f) => re.test(fs.readFileSync(f, 'utf8').replace(/fetch\("\/api\/interview\/extract", \{ method: "POST", body: form \}\)/g, '')));
    expect(bad.map((f) => path.relative(process.cwd(), f)), '这些文件直接 fetch 写入大内容接口，线路差时会被切断').toEqual([]);
    expect(clientFiles.filter((f) => /postSafely\(/.test(fs.readFileSync(f, 'utf8'))).length, '扫描空转').toBeGreaterThanOrEqual(12);
  });

  it('后端这些接口都用 readJsonBody 读（不再 request.json()）', () => {
    for (const a of BIG_APIS) {
      const src = readCode(`app/api/${a}/route.ts`);
      expect(src, a).toMatch(/readJsonBody\(/);
      expect(src, a).not.toMatch(/await req(uest)?\.json\(\)/);
    }
  });

  it('前采上传 Word：不太大的文件编码进 JSON 走压缩 / 分块，接口认得', () => {
    expect(readCode('app/dashboard/interview/page.tsx')).toMatch(/file && file\.size <= INLINE_FILE_MAX/);
    expect(readCode('app/api/interview/extract/route.ts')).toMatch(/Buffer\.from\(body\.fileBase64, 'base64'\)/);
  });
});
