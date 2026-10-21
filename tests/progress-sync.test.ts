/**
 * 地基和引导「统一按当前档案算」「同一页面立即更新」（2026-10-20）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pickProfileForSetup } from '@/lib/setup-progress';
import { loadSetupStepsStrict } from '@/hooks/useSetupProgress';

describe('地基看哪个档案：当前档案优先', () => {
  const profiles = [{ id: 'p1' }, { id: 'p2' }];

  it('当前档案在列表里：用当前档案', () => {
    expect(pickProfileForSetup(profiles, 'p2')).toEqual({ id: 'p2' });
  });

  it('当前档案没选、或已经不在列表里：退回第一个（和引导页的选法一致）', () => {
    expect(pickProfileForSetup(profiles, null)).toEqual({ id: 'p1' });
    expect(pickProfileForSetup(profiles, 'deleted')).toEqual({ id: 'p1' });
  });

  it('没有档案：返回 null', () => {
    expect(pickProfileForSetup([], 'p1')).toBeNull();
  });
});

describe('严格版取数：定位取的是当前档案的', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  it('当前档案是 p2：定位请求带的是 p2，而不是第一个档案 p1', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'activeProfileId' ? 'p2' : null) });
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url.startsWith('/api/profiles')) return json([{ id: 'p1' }, { id: 'p2' }]);
      return json([{ positioning_type: '账号定位' }]);
    });
    const steps = await loadSetupStepsStrict();
    expect(urls.some((u) => u.includes('/api/positioning?profileId=p2'))).toBe(true);
    expect(urls.some((u) => u.includes('profileId=p1'))).toBe(false);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['profile', 'positioning']);
  });
});

describe('同一页面立即更新：写入文件都通知进度变化', () => {
  const ROOT = process.cwd();
  const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];
  /** 写入的是 API 路由本身（服务端），不属于客户端通知范围 */
  const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'api']);

  const walk = (dir: string, out: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };

  // 写入档案、定位、作品的请求：接口地址和写入方法在同一段里
  const WRITE = /\/api\/(profiles|positioning|works)\b[\s\S]{0,400}?method:\s*['"](POST|PUT|PATCH|DELETE)['"]|method:\s*['"](POST|PUT|PATCH|DELETE)['"][\s\S]{0,400}?\/api\/(profiles|positioning|works)\b/;

  /**
   * 只改档案的文字字段（访谈笔记、资料），不影响地基的档案数量、定位类型，也不影响作品，
   * 所以不需要通知。新增这类例外要在这里写明理由。
   */
  const EXEMPT: Record<string, string> = {
    'app/dashboard/profiles/[id]/edit/page.tsx': '档案编辑只改资料字段，地基和作品不变',
    'components/interview/InterviewEntry.tsx': '访谈笔记写入档案的文字字段，地基和作品不变',
  };

  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  const relative = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
  const writers = files
    .map((f) => ({ rel: relative(f), src: fs.readFileSync(f, 'utf8') }))
    .filter((x) => WRITE.test(x.src))
    .map((x) => x.rel);

  it('扫描确实扫到了文件，并且找到了写入的地方（否则这条测试是空过的）', () => {
    expect(files.length).toBeGreaterThan(200);
    expect(writers.length).toBeGreaterThanOrEqual(8);
    expect(writers).toContain('lib/works.ts');
    expect(writers).toContain('app/dashboard/positioning/page.tsx');
  });

  it('每个写入档案、定位、作品的文件都调用了 notifyProgressChanged（或在例外里写明了理由）', () => {
    const missing = writers.filter((rel) => {
      if (EXEMPT[rel]) return false;
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      return !src.includes('notifyProgressChanged');
    });
    expect(missing).toEqual([]);
  });

  it('例外名单里的文件确实存在，并且确实是写入的（名单不能是摆设）', () => {
    for (const rel of Object.keys(EXEMPT)) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
      expect(writers).toContain(rel);
    }
  });
});
