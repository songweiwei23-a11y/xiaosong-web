/**
 * 点「一键采集」没反应（2026-11-10）：抖音分享短链接复制不全或过期会落到抖音首页，插件打开首页发现不是主页就停了，
 * 提示只在抖音那个标签页里，开物页面上一点反应都没有。现在先由服务器解析链接，不是主页的当场说清楚；
 * 交给插件后 8 秒内页面没被切到后台（插件没开新标签页），提示怎么查插件。
 */
import { describe, expect, it } from 'vitest';
import { classifyDouyinUrl, webProfileUrl } from '@/lib/douyin-link';
import { readCode } from './helpers/source';

describe('认链接', () => {
  it('短链接、主页、作品、首页分得清', () => {
    expect(classifyDouyinUrl('https://v.douyin.com/RNjh0/')).toBe('short');
    expect(classifyDouyinUrl('https://www.douyin.com/user/MS4wLjABAAAA_x-1?from=share')).toBe('profile');
    expect(classifyDouyinUrl('https://www.iesdouyin.com/share/user/MS4wLjABAAAA_x')).toBe('profile');
    expect(classifyDouyinUrl('https://www.douyin.com/user/self')).toBe('other');
    expect(classifyDouyinUrl('https://www.douyin.com/video/7300000000000000000')).toBe('work');
    expect(classifyDouyinUrl('https://www.douyin.com/?modal_id=7300000000000000000')).toBe('work');
    expect(classifyDouyinUrl('https://www.douyin.com/')).toBe('other');
    expect(classifyDouyinUrl('https://evil.com/user/x')).toBe('other');
  });
  it('App 分享页换成网页版地址（插件只在 www.douyin.com 上运行）', () => {
    expect(webProfileUrl('https://www.iesdouyin.com/share/user/MS4w_x?sec=1')).toBe('https://www.douyin.com/user/MS4w_x');
    expect(webProfileUrl('https://www.iesdouyin.com/share/video/7300000000000000000/')).toBe('https://www.douyin.com/video/7300000000000000000');
    expect(webProfileUrl('https://www.douyin.com/user/MS4w_x')).toBe('https://www.douyin.com/user/MS4w_x');
  });
});

describe('接线', () => {
  it('解析接口只跟抖音自己的域名、最多 5 跳；解析不了不挡', () => {
    const route = readCode('app/api/douyin-link/route.ts');
    expect(route).toMatch(/for \(let i = 0; i < 5; i\+\+\)/);
    expect(route).toMatch(/if \(!isDouyinHost\(next\.hostname\)\) return NextResponse\.json\(\{ url, kind: 'other' \}\)/);
    expect(route).toMatch(/redirect: 'manual'/);
  });
  it('诊断账号、月度复盘、拆对标：都先解析再交给插件，交出去后看插件有没有动静；版本也从页面标记读', () => {
    for (const f of ['components/works/AccountDiagnosis.tsx', 'components/works/MonthlyReview.tsx', 'components/benchmark/CaptureBridge.tsx']) {
      const src = readCode(f);
      expect(src).toMatch(/const prepared = await prepareCollectLink\(raw\)/);
      expect(src).toMatch(/url: prepared\.url/);
      expect(src).toMatch(/watchPluginOpened\(\(\) => set\w*Msg\(PLUGIN_SILENT\)\)/);
      expect(src).toMatch(/version \|\| pluginVersionFromPage\(\)/);
    }
  });
});
