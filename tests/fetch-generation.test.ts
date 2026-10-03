/**
 * 发生成请求遇到"失效的空闲连接"自动重发一次（2026-10-02）。
 * 线上：创作方向填完表单点生成，服务器一条记录都没有，页面提示网络断了。
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fetchGeneration } from '@/lib/api-error';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('fetchGeneration', () => {
  it('秒失败（Failed to fetch）换新连接重发一次', async () => {
    const ok = new Response('ok');
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', f);
    expect(await fetchGeneration('/api/dify/stream', { method: 'POST', body: '{}' })).toBe(ok);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('只重发一次：第二次也失败就照实报错', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(fetchGeneration('/api/dify/stream', { method: 'POST', body: '{}' })).rejects.toThrow('Failed to fetch');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('超过 3 秒才失败不重发：请求可能已经到了服务器，重发会重复生成、重复扣次数', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const f = vi.fn().mockImplementation(async () => { now += 5000; throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', f);
    await expect(fetchGeneration('/api/dify/stream', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('不是网络错误（代码报错、用户取消）不重发', async () => {
    const f = vi.fn().mockRejectedValue(new Error('别的错'));
    vi.stubGlobal('fetch', f);
    await expect(fetchGeneration('/x', {})).rejects.toThrow('别的错');
    expect(f).toHaveBeenCalledTimes(1);
    const ctrl = new AbortController(); ctrl.abort();
    const g = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', g);
    await expect(fetchGeneration('/x', { signal: ctrl.signal })).rejects.toThrow();
    expect(g).toHaveBeenCalledTimes(1);
  });
});

describe('扫描：页面发生成请求都走 fetchGeneration', () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  const files = ['app/dashboard', 'components', 'hooks'].flatMap((d) => walk(path.join(process.cwd(), d)));

  it('扫描没有空转', () => {
    const using = files.filter((f) => /fetchGeneration\(["'`]\/api\/dify\/(stream|chat)/.test(fs.readFileSync(f, 'utf8')));
    expect(using.length).toBeGreaterThanOrEqual(15);
  });

  it('没有页面再直接 fetch 生成接口', () => {
    const bad = files.filter((f) => /\bfetch\(["'`]\/api\/dify\/(stream|chat)/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(process.cwd(), f));
    expect(bad, `这些文件直接 fetch 了生成接口，碰到失效连接不会自动重发：\n${bad.join('\n')}`).toEqual([]);
  });
});
