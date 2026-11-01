// 「开物 · 截屏带入」插件（2026-11-01）：编导看对标账号主页时点一下截当前画面，带进开物对标拆解。
// 守两件事：1. 带进来的截图自动对上对标账号（对不上就按主页名字新建），少让用户操作；
// 2. 插件只截屏、不爬：不自动滚动、不读网页内容、不发网络请求、只在编导点按钮或按快捷键时截。
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { douyinUserKey, nameFromTitle, pickAccount } from '@/components/benchmark/CaptureBridge';

const DIR = 'browser-extension/kaiwu-capture';
const read = (f: string) => fs.readFileSync(`${DIR}/${f}`, 'utf8');

describe('带进来的截图对上哪个对标账号', () => {
  const home = { dataUrl: 'data:image/jpeg;base64,x', url: 'https://www.douyin.com/user/MS4wLjABAAAAabc?from_tab_name=main', title: '阿杰剪发的抖音 - 抖音' };

  it('主页链接认得出账号标识，标题取出名字', () => {
    expect(douyinUserKey(home.url)).toBe('MS4wLjABAAAAabc');
    expect(douyinUserKey('https://www.douyin.com/video/123')).toBe('');
    expect(nameFromTitle(home.title)).toBe('阿杰剪发');
  });

  it('已经加过这个账号：放进它', () => {
    expect(pickAccount([home], [{ id: 'a1', link: 'https://www.douyin.com/user/MS4wLjABAAAAabc' }])).toEqual({ match: 'a1' });
  });

  it('没加过：按主页的名字和链接新建一个（链接去掉问号后面的参数）', () => {
    expect(pickAccount([home], [{ id: 'a1', link: 'https://www.douyin.com/user/other' }])).toEqual({ create: { name: '阿杰剪发', link: 'https://www.douyin.com/user/MS4wLjABAAAAabc' } });
  });

  it('评论区截图来自作品页：用同一批里的主页截图来对', () => {
    const video = { dataUrl: 'data:image/jpeg;base64,y', url: 'https://www.douyin.com/video/123', title: '作品' };
    expect(pickAccount([video, home], [])).toEqual({ create: { name: '阿杰剪发', link: 'https://www.douyin.com/user/MS4wLjABAAAAabc' } });
  });

  it('一张主页截图都没有：认不出，交给用户手动选', () => {
    expect(pickAccount([{ dataUrl: 'data:image/jpeg;base64,y', url: 'https://www.douyin.com/video/123' }], [])).toBeNull();
  });
});

describe('插件只截屏、不爬', () => {
  const scripts = ['background.js', 'guide.js', 'popup.js', 'bridge.js'].map((f) => [f, read(f)] as const);

  it('不自动滚动、不读抖音页面内容、不发网络请求', () => {
    for (const [f, src] of scripts) {
      expect(src, f).not.toMatch(/scrollTo|scrollBy|scrollIntoView|window\.scroll\b/);
      expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|chrome\.cookies|innerText|textContent\s*\)|querySelectorAll\(/);
    }
    // 引导面板只读自己面板里的元素（data-k），不读抖音页面
    expect(read('guide.js')).not.toMatch(/document\.querySelector(?:All)?\(/);
  });

  it('截图只在点按钮（消息）或按快捷键时发生，截的是当前看得见的画面', () => {
    const bg = read('background.js');
    expect(bg.match(/captureVisibleTab/g)?.length).toBe(1);
    expect(bg).toContain("msg?.type === 'capture'");
    expect(bg).toContain("command !== 'capture-screen'");
    expect(bg).not.toMatch(/chrome\.alarms|setInterval|chrome\.tabs\.update|chrome\.scripting/);
  });

  it('权限只要截屏、本机存储和抖音页面（放引导面板），最多 9 张和开物一致', async () => {
    const m = JSON.parse(read('manifest.json'));
    expect(m.permissions.sort()).toEqual(['activeTab', 'storage', 'unlimitedStorage']);
    expect(m.host_permissions).toEqual(['https://www.douyin.com/*']);
    const { BENCHMARK_LIMITS } = await import('@/lib/benchmark-analysis');
    expect(read('background.js')).toContain(`const MAX = ${BENCHMARK_LIMITS.images}`);
  });

  it('网站上能下载到插件包，安装提示指向它', () => {
    expect(fs.existsSync('public/kaiwu-capture.zip')).toBe(true);
    expect(fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8')).toContain('/kaiwu-capture.zip');
  });
});
