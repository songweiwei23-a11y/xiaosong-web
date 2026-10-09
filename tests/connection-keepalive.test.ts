/**
 * 连接保活（2026-10-05 线上）：页面闲几分钟后，用户走代理的线路把空闲连接掐了，
 * 再点「开篇钩子」带去下一步，请求一个都没到服务器，页面报网络断了。
 */
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/public/ping/route';
import { KEEP_ALIVE_MS } from '@/components/dashboard/ConnectionKeepAlive';
import { readCode } from './helpers/source';

describe('保活', () => {
  it('/api/public/ping：不查库、不验登录，回一个不缓存的空响应', async () => {
    const res = GET();
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(readCode('app/api/public/ping/route.ts')).not.toMatch(/requireUser|supabase/);
  });

  it('隔得够勤（代理掐空闲连接一般在一两分钟以上），只在前台打，切回来马上打', () => {
    expect(KEEP_ALIVE_MS).toBeLessThanOrEqual(30_000);
    const src = readCode('components/dashboard/ConnectionKeepAlive.tsx');
    expect(src).toMatch(/document\.visibilityState !== "visible"\) return/);
    expect(src).toMatch(/addEventListener\("visibilitychange", onVisible\)/);
    expect(src).toMatch(/addEventListener\("focus", ping\)/);
    expect(src).toMatch(/fetch\("\/api\/public\/ping", \{ cache: "no-store" \}\)\.catch/);
  });

  it('挂在工作台的公共框架里，所有板块都有', () => {
    expect(readCode('app/dashboard/layout.tsx')).toMatch(/<ConnectionKeepAlive \/>/);
  });

  it('/api/public/ping 不被登录拦截（中间件只管页面）', () => {
    expect(readCode('middleware.ts')).not.toMatch(/['"]\/api\/:path\*['"]/);
  });
});
