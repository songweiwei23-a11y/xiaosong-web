/**
 * 点「一键采集」没反应（2026-11-10）：抖音分享短链接复制不全或过期会落到抖音首页，插件打开首页发现不是主页就停了，
 * 提示只在抖音那个标签页里，开物页面上一点反应都没有。现在先由服务器解析链接，不是主页的当场说清楚；
 * 交给插件后 8 秒内页面没被切到后台（插件没开新标签页），提示怎么查插件。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyDouyinUrl, DOUYIN_LINK_BAD, webProfileUrl } from '@/lib/douyin-link';
import {
  canStartFromCapture,
  clearMissingPluginMessage,
  PLUGIN_MISSING,
  PLUGIN_PROMPT_MS,
  PLUGIN_SILENT,
  pluginMessageNeedsDownload,
  prepareCollectLink,
  shouldHoldReviewCapture,
} from '@/lib/collect-link-client';
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

describe('点按钮之后交给插件的地址', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('服务器解析成主页：换成插件能打开的网页版地址', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://www.iesdouyin.com/share/user/MS4w_x?sec=1', kind: 'profile' }),
    })));
    await expect(prepareCollectLink('https://v.douyin.com/abc/')).resolves.toEqual({
      ok: true,
      url: 'https://www.douyin.com/user/MS4w_x',
    });
  });

  it('打开的不是主页：不交给插件，页面上直接说明', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://www.douyin.com/', kind: 'other' }),
    })));
    const r = await prepareCollectLink('https://v.douyin.com/abc/');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(DOUYIN_LINK_BAD);
  });

  it('解析服务挂了：不挡，原链接仍交给插件', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    await expect(prepareCollectLink('https://v.douyin.com/abc/')).resolves.toEqual({ ok: true, url: 'https://v.douyin.com/abc/' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(prepareCollectLink('https://www.douyin.com/user/MS4w_x')).resolves.toEqual({
      ok: true,
      url: 'https://www.douyin.com/user/MS4w_x',
    });
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

  it('没装插件：8 秒内给中文说明，并带上可点的下载链接，不先转圈', () => {
    expect(PLUGIN_PROMPT_MS).toBeLessThanOrEqual(8000);
    expect(PLUGIN_MISSING).toMatch(/[\u4e00-\u9fff]/);
    expect(pluginMessageNeedsDownload(PLUGIN_MISSING)).toBe(true);
    expect(pluginMessageNeedsDownload(PLUGIN_SILENT)).toBe(true);
    expect(pluginMessageNeedsDownload('插件是旧版本（0.1.0），还不会诊断自己的号')).toBe(true);
    expect(pluginMessageNeedsDownload('正在核对链接…')).toBe(false);
    expect(clearMissingPluginMessage(PLUGIN_MISSING)).toBe('');
    expect(clearMissingPluginMessage('别的提示')).toBe('别的提示');

    const client = readCode('lib/collect-link-client.ts');
    expect(client).toContain('PLUGIN_PROMPT_MS = 8000');
    expect(client).toContain('ms = PLUGIN_PROMPT_MS');
    expect(client).toContain("EXTENSION_ZIP = '/kaiwu-capture.zip'");

    const hint = readCode('components/benchmark/PluginDownloadHint.tsx');
    expect(hint).toContain('href={EXTENSION_ZIP}');
    expect(hint).toContain('download');
    expect(hint).toContain('下载插件');

    const bridge = readCode('components/benchmark/CaptureBridge.tsx');
    const bridgeMissing = bridge.indexOf('return setLinkMsg(PLUGIN_MISSING)');
    const bridgePrepare = bridge.indexOf('await prepareCollectLink');
    expect(bridgeMissing).toBeGreaterThan(-1);
    expect(bridgeMissing).toBeLessThan(bridgePrepare);
    expect(bridge).not.toContain('setChecking');
    expect(bridge).toContain('<PluginDownloadHint text={linkMsg} />');
    expect(bridge).toContain('pluginMessageNeedsDownload(linkMsg)');

    for (const f of ['components/works/AccountDiagnosis.tsx', 'components/works/MonthlyReview.tsx']) {
      const src = readCode(f);
      const missing = src.indexOf('return setMsg(PLUGIN_MISSING)');
      const checking = src.indexOf('setChecking(true)');
      const prepare = src.indexOf('await prepareCollectLink');
      expect(missing).toBeGreaterThan(-1);
      expect(missing).toBeLessThan(checking);
      expect(missing).toBeLessThan(prepare);
      expect(src).toContain('else setMsg((m) => m || PLUGIN_MISSING)');
      expect(src).toContain('}, 1500)');
      expect(src).toContain('<PluginDownloadHint text={msg} />');
      expect(src).toContain('pluginMessageNeedsDownload(msg)');
    }
  });

  it('采集回填不盖掉用户已经写好的内容', () => {
    expect(canStartFromCapture('')).toBe(true);
    expect(canStartFromCapture('  \n')).toBe(true);
    expect(canStartFromCapture('上次没写完的拆解')).toBe(false);
    expect(shouldHoldReviewCapture({ editing: true, edited: false })).toBe(true);
    expect(shouldHoldReviewCapture({ editing: false, edited: true })).toBe(true);
    expect(shouldHoldReviewCapture({ editing: false, edited: false })).toBe(false);

    const analyzer = readCode('components/benchmark/BenchmarkAnalyzer.tsx');
    const incomingEffect = analyzer.slice(analyzer.indexOf('handled.current === incoming.nonce'), analyzer.indexOf('const addFiles'));
    expect(analyzer).toMatch(/if \(!canStartFromCapture\(report\)\) \{[\s\S]*return;\s*\}\s*void run\(/);
    expect(incomingEffect).not.toContain('setPasted');
    expect(incomingEffect).toContain('pasted,');
    expect(analyzer).not.toContain('preserveUserText');
    expect(analyzer).toContain('[...files, ...incoming.files]');
    expect(readCode('lib/collect-link-client.ts')).not.toContain('preserveUserText');

    const diagnosis = readCode('components/works/AccountDiagnosis.tsx');
    expect(diagnosis).toMatch(/if \(!canStartFromCapture\(reportRef\.current\)\) \{[\s\S]*return;\s*\}/);
    expect(diagnosis).toContain('用这次采集再诊断');
    expect(diagnosis).not.toContain('setLink("")');

    const review = readCode('components/works/MonthlyReview.tsx');
    expect(review).toMatch(/shouldHoldReviewCapture\(\{ editing: !!editingRef\.current, edited: reviewEditedRef\.current \}\)\) \{[\s\S]*?return;\s*\}\s*void startRef\.current\(payload\)/);
    expect(review).toContain('用这次采集复盘');
    expect(review).not.toContain('setLink("")');

    expect(readCode('components/benchmark/CaptureBridge.tsx')).not.toContain('setLink("")');
  });
});
