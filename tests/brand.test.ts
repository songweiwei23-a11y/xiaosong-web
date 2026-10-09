import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readCode, readSource } from './helpers/source';
import { BRAND_NAME } from '@/components/brand/Brand';

/**
 * 品牌「开物」。
 *
 * 改名前，旧名字「小宋编导工作台」手写在 9 个文件 14 处——
 * 首页、登录、侧边栏、加载页、网页标题、隐私政策、服务条款……
 * 这里扫全站，保证用户能看到的地方不会漏一处旧名字。
 */

const ROOTS = ['app', 'components', 'lib', 'hooks'];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|json)$/.test(e.name)) out.push(path.relative(process.cwd(), p));
  }
  return out;
}

describe('品牌名', () => {
  const files = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r)));

  it('用户看得到的地方没有旧名字', () => {
    // 扫描自证不空转
    expect(files.length).toBeGreaterThan(100);
    const hits = files.filter((f) => /小宋编导工作台|小宋工作台|小宋编导(?!文案工作台)/.test(readCode(f)));
    expect(hits, `还有旧名字：${hits.join('、')}`).toEqual([]);
  });

  it('网页标题、隐私政策、服务条款都换成了开物', () => {
    expect(BRAND_NAME).toBe('开物');
    expect(readCode('app/layout.tsx')).toContain("title: '开物 - ");
    // JSX 里的引号按 lint 要求写成 &quot;（页面上显示的还是 "）
    expect(readSource('app/privacy/page.tsx')).toMatch(/开物（以下简称(?:"|&quot;)我们(?:"|&quot;)）/);
    expect(readSource('app/terms/page.tsx')).toContain('欢迎使用开物');
  });

  it('品牌标志都走同一个组件', () => {
    for (const f of ['components/dashboard/Sidebar.tsx', 'app/login/page.tsx', 'app/page.tsx', 'components/Loading.tsx']) {
      expect(readCode(f), f).toMatch(/<BrandWordmark\b/);
    }
  });
});

describe('品牌字', () => {
  it('字体文件自己托管、足够小', () => {
    for (const w of ['900', '600']) {
      const p = path.join(process.cwd(), 'public', 'fonts', `kaiwu-serif-${w}.woff2`);
      expect(fs.existsSync(p), p).toBe(true);
      const size = fs.statSync(p).size;
      // 只切了「开物KAIWU」几个字；突然变大说明把整套字库塞进来了
      expect(size).toBeGreaterThan(500);
      expect(size).toBeLessThan(20_000);
    }
  });

  it('样式里声明了字体，并且首屏预加载', () => {
    const css = readSource('app/globals.css');
    expect(css).toContain("src: url('/fonts/kaiwu-serif-900.woff2') format('woff2')");
    expect(css).toMatch(/\.font-brand \{[^}]*font-family: 'Kaiwu Serif'/);
    expect(readCode('app/layout.tsx')).toContain('href="/fonts/kaiwu-serif-900.woff2"');
  });

  it('浏览器标签页有印章图标', () => {
    const svg = readSource('app/icon.svg');
    expect(svg).toMatch(/<path d="M[\d.\s\-MLQCZ]+"/);
  });
});
