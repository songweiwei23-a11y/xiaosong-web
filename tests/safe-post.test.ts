/**
 * 大请求不被线路掐断（2026-10-02）：用户线路差时超过约 8KB 的 POST 被切断，
 * 「创作方向」带上简报约 11KB，每次都报「网络断了」。浏览器端压缩 / 分块，服务器端还原。
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { postSafely, SAFE_BYTES, FAST_FAIL_RETRY_DELAYS } from '@/lib/safe-post';
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

  // 2026-10-05 线上：长对话保存要传十几块，线路抖一下，某一块连试 3 次（中间不等）都失败，整次保存就放弃
  it('某块被线路掐断：等一下再试，还原一字不差；几块同时传', async () => {
    const sent = fakeNetwork();
    const real = fetch as unknown as ReturnType<typeof vi.fn>;
    let dropped = 0;
    let inFlight = 0, maxInFlight = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url === '/api/body-chunks' && new Headers(init.headers).get('x-chunk-index') === '1' && dropped < 2) { dropped++; throw new TypeError('Failed to fetch'); }
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      try { return await real(url, init); } finally { inFlight--; }
    }));
    const data = { messages: noisy(40_000) };
    const res = await postSafely('/api/chat-conversations?id=x', { method: 'PUT', body: JSON.stringify(data) });
    expect(res.ok).toBe(true);
    expect(dropped).toBe(2);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(await restore(sent[sent.length - 1])).toEqual(data);
  }, 10_000);

  // 2026-10-05 线上：自由对话停了十几分钟再点「创作方向」，弹 Failed to fetch，服务器一条记录都没有（空闲连接已断）
  it('秒失败（请求没发出去）自动换连接重发；慢失败不重发', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { calls++; if (calls === 1) throw new TypeError('Failed to fetch'); return new Response('ok'); }));
    const res = await postSafely('/api/creation-sessions', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(await res.text()).toBe('ok');
    expect(calls).toBe(2);

    // 一直失败：保存类请求试满 1 + 5 次才报错；生成请求只重发 1 次（不重复扣次数）
    vi.useFakeTimers();
    try {
      calls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => { calls++; throw new TypeError('Failed to fetch'); }));
      const save = expect(postSafely('/api/creation-sessions', { method: 'POST', body: JSON.stringify({ a: 1 }) })).rejects.toThrow('Failed to fetch');
      await vi.runAllTimersAsync(); await save;
      expect(calls).toBe(1 + FAST_FAIL_RETRY_DELAYS.length);
      expect(FAST_FAIL_RETRY_DELAYS.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(8000);
      calls = 0;
      const gen = expect(postSafely('/api/dify/stream', { method: 'POST', body: JSON.stringify({ a: 1 }) })).rejects.toThrow('Failed to fetch');
      await vi.runAllTimersAsync(); await gen;
      expect(calls).toBe(2);
    } finally { vi.useRealTimers(); }

    calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { calls++; throw new SyntaxError('bad'); }));
    await expect(postSafely('/api/x', { method: 'DELETE' })).rejects.toThrow('bad');
    expect(calls).toBe(1);
  });

  it('慢失败（可能已经到了服务器）不重发，免得重复生成', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      vi.stubGlobal('fetch', vi.fn(async () => { calls++; vi.advanceTimersByTime(5000); throw new TypeError('Failed to fetch'); }));
      await expect(postSafely('/api/dify/chat', { method: 'POST', body: JSON.stringify({ q: 1 }) })).rejects.toThrow('Failed to fetch');
      expect(calls).toBe(1);
    } finally { vi.useRealTimers(); }
  });

  it('分块编号、序号、大小都校验', () => {
    expect(putChunk('u', 'bad-id', 0, 1, Buffer.from('x'))).toBe('编号不正确');
    expect(putChunk('u', 'a'.repeat(32), 5, 2, Buffer.from('x'))).toBe('分块序号不正确');
    expect(putChunk('u', 'b'.repeat(32), 0, 9999, Buffer.from('x'))).toBe('分块序号不正确');
  });
});

describe('接线', () => {
  it('生成请求统一走 postSafely（fetchGeneration 里）', () => {
    expect(readCode('lib/api-error.ts')).toMatch(/return postSafely\(url, init\)/);
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
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  const clientFiles = ['app', 'components', 'hooks', 'lib'].flatMap((d) => walk(path.join(process.cwd(), d))).filter((f) => !f.includes(`${path.sep}api${path.sep}`));

  it('前端没有直接 fetch 写入这些接口（除了特别大的文件直接上传）', () => {
    const api = BIG_APIS.map((a) => a.replace('/', '\\/')).join('|');
    const re = new RegExp(`\\bfetch\\(\\s*[\`'"]\\/api\\/(?:${api})(?:[?\`'"$][^,]*)?,\\s*\\{[\\s\\S]{0,240}?method:\\s*['"](?:POST|PUT|PATCH)['"]`);
    const bad = clientFiles.filter((f) => re.test(fs.readFileSync(f, 'utf8').replace(/fetch\("\/api\/interview\/extract", \{ method: "POST", body: form \}\)/g, '')));
    expect(bad.map((f) => path.relative(process.cwd(), f)), '这些文件直接 fetch 写入大内容接口，线路差时会被切断').toEqual([]);
    expect(clientFiles.filter((f) => /postSafely\(/.test(fs.readFileSync(f, 'utf8'))).length, '扫描空转').toBeGreaterThanOrEqual(12);
  });

  it('用户会点的写入、删除（作品、待办、课程进度、各板块历史删除）也走 postSafely，空闲连接断了会自动重发', () => {
    const files = ['lib/works.ts', 'hooks/useTodos.ts', 'hooks/useCourseProgress.ts', 'hooks/useGenerationPage.ts', 'components/dashboard/LaunchPlanCard.tsx', 'components/library/CreatorPresets.tsx', 'app/dashboard/library/page.tsx', 'app/dashboard/title/page.tsx', 'app/dashboard/script/useScriptHistory.ts', 'app/dashboard/profiles/page.tsx', 'app/dashboard/positioning/page.tsx'];
    const raw = /\bawait fetch\([^)]*?,\s*\{[\s\S]{0,200}?method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/;
    for (const f of files) expect(readCode(f), f).not.toMatch(raw);
    // 扫描自证：dashboard、hooks 里再没有直接 fetch 写入的（付款单独处理，不在这里）
    const dash = ['app/dashboard', 'hooks', 'components/workspace', 'components/chat', 'components/dashboard', 'components/library'].flatMap((d) => walk(path.join(process.cwd(), d)));
    expect(dash.length, '扫描空转').toBeGreaterThan(40);
    expect(dash.filter((f) => raw.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  it('带去下一步失败时给人话；任何提示里冒出浏览器原样的网络报错都换成人话', () => {
    expect(readCode('lib/creation-session.ts')).toMatch(/网络断了一下，创作需求没保存上/);
    expect(readCode('components/ui/feedback.tsx')).toMatch(/RAW_NETWORK_ERROR\.test\(/);
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
