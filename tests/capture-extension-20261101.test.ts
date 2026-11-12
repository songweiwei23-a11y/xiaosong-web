// 「开物 · 截屏带入」插件（2026-11-01；11-02 产品方定：可以自动化采集）。
// 守三件事：
// 1. 带进来的数据自动对上对标账号（对不上就按主页名字新建），开物里粘贴链接就能一路跑完，少让用户操作；
// 2. 自动化守底线：只在编导发起后跑、节奏像人、遇到验证码就停不代解、有条数上限、不碰 Cookie 和抖音接口、
//    评论只留文字和点赞数（不收评论人昵称）；
// 3. 开物这边对网页来的数据先校验、限量，再排成拆解材料。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { batchKey, COLLECT_SINCE, dataUrlToFile, douyinLinkFromText, douyinUserKey, nameFromTitle, pickAccount, pluginOutdated, PLUGIN_VERSION, versionBelow } from '@/components/benchmark/CaptureBridge';
import { COLLECTION_LIMITS, coverageEstimate, formatCollection, parseCount, sanitizeCollection } from '@/lib/benchmark-collection';
import { BENCHMARK_FRAMEWORK } from '@/lib/benchmark-analysis';

const DIR = 'browser-extension/kaiwu-capture';
const read = (f: string) => fs.readFileSync(`${DIR}/${f}`, 'utf8');

describe('带进来的数据对上哪个对标账号', () => {
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

  it('一键采集的主页链接和名字优先：只有封面（作品链接）也能对上', () => {
    const cover = { dataUrl: 'data:image/jpeg;base64,z', url: 'https://www.douyin.com/video/9', kind: 'cover' };
    const collection = { url: 'https://www.douyin.com/user/MS4wLjABAAAAxyz', profile: { name: '小林烘焙', header: '', follows: '', fans: '', likes: '', worksTotal: '', tabs: '' } };
    expect(pickAccount([cover], [], collection)).toEqual({ create: { name: '小林烘焙', link: 'https://www.douyin.com/user/MS4wLjABAAAAxyz' } });
    expect(pickAccount([cover], [{ id: 'b2', link: 'https://www.douyin.com/user/MS4wLjABAAAAxyz?x=1' }], collection)).toEqual({ match: 'b2' });
  });

  it('一张主页截图都没有：认不出，交给用户手动选', () => {
    expect(pickAccount([{ dataUrl: 'data:image/jpeg;base64,y', url: 'https://www.douyin.com/video/123' }], [])).toBeNull();
  });
});

describe('开物里粘贴主页链接', () => {
  it('地址栏链接、App 分享的整段文字都能取出链接；别的网站不认', () => {
    expect(douyinLinkFromText(' https://www.douyin.com/user/MS4wLjABAAAAabc?from_tab_name=main ')).toBe('https://www.douyin.com/user/MS4wLjABAAAAabc?from_tab_name=main');
    expect(douyinLinkFromText('长按复制此条消息，打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/iAbCdEf/ 1@2.com :8pm')).toBe('https://v.douyin.com/iAbCdEf/');
    expect(douyinLinkFromText('https://www.example.com/user/1')).toBe('');
    expect(douyinLinkFromText('https://douyin.com.evil.cn/user/1')).toBe('');
  });

  it('装的是旧版插件要提示更新；版本号和插件清单一致；0.3.0 已经会采集，不拦粘贴', () => {
    expect(PLUGIN_VERSION).toBe(JSON.parse(read('manifest.json')).version);
    expect(pluginOutdated('0.2.0')).toBe(true);
    expect(pluginOutdated('0.3.0')).toBe(true);
    expect(pluginOutdated(PLUGIN_VERSION)).toBe(false);
    expect(pluginOutdated('0.10.0')).toBe(false);
    expect(versionBelow('0.2.9', COLLECT_SINCE)).toBe(true);
    expect(versionBelow('0.3.0', COLLECT_SINCE)).toBe(false);
  });

  it('同一批数据交两次只收一次（免得建两个账号、拆两遍）；不同批次分得开', () => {
    const shot = { dataUrl: 'data:image/jpeg;base64,abc', at: '2026-11-02T10:00:00Z' };
    const col = sanitizeCollection({ url: 'https://www.douyin.com/user/MS4wLjABAAAAabc', works: [{ id: '1' }], collectedAt: '2026-11-02T10:01:00Z' });
    expect(batchKey([shot], col)).toBe(batchKey([{ ...shot }], sanitizeCollection({ url: 'https://www.douyin.com/user/MS4wLjABAAAAabc', works: [{ id: '1' }], collectedAt: '2026-11-02T10:01:00Z' })));
    expect(batchKey([shot], col)).not.toBe(batchKey([shot], { ...col!, collectedAt: '2026-11-02T11:00:00Z' }));
    const bridge = fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8');
    expect(bridge).toContain('if (key === lastBatch.current) return;');
  });

  it('链路接通：页面发 collect → 桥转给后台 → 后台只开抖音链接、标记自动开始 → 采完切回开物标签页', () => {
    expect(fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8')).toContain('type: "collect", url');
    expect(read('bridge.js')).toContain("type: 'collect-url'");
    const bg = read('background.js');
    expect(bg).toContain("msg?.type === 'collect-url'");
    expect(bg).toMatch(/\(www\\\.\|v\\\.\)\?\(douyin\|iesdouyin\)\\\.com/);
    expect(bg).toContain('autostart');
    expect(read('collector.js')).toContain("type: 'open-kaiwu', tabId: job.kaiwuTabId");
    // 采集结果出来，开物那一页不用刷新就能收到
    expect(read('bridge.js')).toContain('changes.collection?.newValue');
  });

  // 2026-11-02 产品方反馈：采完没回到开物、没开始拆。下面几条守住「采完一定回得来」
  it('桥挂在开物每一页：从侧边栏点进对标页（单页应用不重新加载）也认得出插件、收得到数据', () => {
    const m = JSON.parse(read('manifest.json'));
    const bridge = m.content_scripts.find((c: { js: string[] }) => c.js.includes('bridge.js'));
    expect(bridge.matches).toEqual(['https://www.biandao.icu/*', 'https://biandao.icu/*', 'http://localhost:3000/*']);
    // 只在收它的那一页交数据：对标账号交给对标页，自己的号（0.5.0）交给创作进度页；别的页面不交（数据留着等那一页说 ready）
    const b = read('bridge.js');
    expect(b).toContain("location.pathname.startsWith('/dashboard/benchmark') ? 'benchmark' : location.pathname.startsWith('/dashboard/works') ? 'self' : null");
    expect(b).toContain("if ((collection?.purpose || 'benchmark') !== accept) return;");
  });

  it('切回开物标签页：不在发起采集的那一页就转过去；那个标签页上没有桥，就在那里打开那一页', () => {
    const b = read('bridge.js');
    expect(b).toContain("msg?.type !== 'kaiwu-arrive'");
    expect(b).toContain('if (location.pathname !== back) location.assign(`${back}?from=capture`);');
    const bg = read('background.js');
    expect(bg).toContain("chrome.tabs.sendMessage(back.id, { type: 'kaiwu-arrive', returnPath })");
    expect(bg).toContain('if (!heard?.ok) await chrome.tabs.update(back.id, { url: target })');
    // 回哪一页只认开物自己的 /dashboard/ 路径
    expect(bg.match(/\/\^\\\/dashboard\\\/\[\\w-\]\+\$\//g)?.length).toBe(2);
  });

  it('诊断自己的号（0.5.0）：创作进度发起时带 purpose=self，采完的数据标上 self，回到创作进度', () => {
    expect(read('bridge.js')).toContain("purpose: data.purpose === 'self' ? 'self' : 'benchmark', returnPath: location.pathname");
    expect(read('background.js')).toContain("purpose: msg.purpose === 'self' ? 'self' : 'benchmark', returnPath");
    const c = read('collector.js');
    expect(c).toContain("purpose: job.purpose === 'self' ? 'self' : 'benchmark',");
    expect(c).toContain("returnPath: job.returnPath ?? null");
    expect(c).toContain('startCollect({ kaiwuTabId: autostart.kaiwuTabId, purpose: autostart.purpose, returnPath: autostart.returnPath })');
    // 开物这边：对标页不收自己的号
    expect(fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8')).toContain('const col = raw?.purpose === "self" ? null : raw;');
    expect(sanitizeCollection({ ...{ url: 'https://www.douyin.com/user/x', works: [{ id: '1' }] }, purpose: 'self' })!.purpose).toBe('self');
    expect(sanitizeCollection({ url: 'https://www.douyin.com/user/x', works: [{ id: '1' }], purpose: 'evil' })!.purpose).toBe('benchmark');
  });

  it('半路停下不卡死：要求验证时已读到作品就先带回开物拆（说明里写清楚），一条没读到才停在抖音页上', () => {
    const c = read('collector.js');
    const stop = c.slice(c.indexOf('async function stop('), c.indexOf('async function finish('));
    expect(stop).toContain('if (!job.works.length) return halt(job, why);');
    expect(stop).toContain('return finish(job);');
    // 验证码不再直接 halt，统一走 stop
    expect(c).not.toMatch(/if \(captchaShown\(\)\) return halt\(/);
    expect(c.match(/return stop\(job, CAPTCHA/g)?.length).toBe(3);
  });

  it('打开的作品页对不上（抖音转成 modal_id 弹层、或页面被点走）：认 modal_id，再开一次，还不对就跳过这条接着读', () => {
    const c = read('collector.js');
    expect(c).toContain("new URLSearchParams(location.search).get('modal_id') === id");
    expect(c).toContain('if (!job.retried)');
    expect(c).toContain("job.notes.push('有一条热门作品没打开，跳过了')");
    expect(c).not.toContain('采集中的页面被换走了');
  });

  // 根因（线上实测）：网站安全策略 connect-src 不许 fetch 读 data: 地址，fetch(dataUrl) 一抛错整批数据都丢、页面也不提示
  it('插件交来的图片自己解码成文件，不走 fetch；坏的一张跳过', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const f = dataUrlToFile(png, '封面-1')!;
    expect(f.name).toBe('封面-1.png');
    expect(f.type).toBe('image/png');
    expect(f.size).toBe(68);
    expect(dataUrlToFile('data:image/jpeg;base64,/9j/', '插件截图-2')?.name).toBe('插件截图-2.jpg');
    expect(dataUrlToFile('data:text/html;base64,PGI+', 'x')).toBeNull();
    expect(dataUrlToFile('data:image/png;base64,%%%', 'x')).toBeNull();
    expect(dataUrlToFile('https://example.com/a.png', 'x')).toBeNull();
  });

  it('扫描：页面代码里不许 fetch 读 data: 地址（安全策略会挡，静默失败）', () => {
    const csp = fs.readFileSync('next.config.js', 'utf8').match(/connect-src[^`"]*/)?.[0] ?? '';
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/\bdata:/); // 策略没放开 data:，所以下面这条扫描有意义
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
      }
    };
    for (const d of ['app', 'components', 'lib', 'hooks']) walk(d);
    expect(files.length).toBeGreaterThan(200); // 扫描真的扫到了文件
    const bad = files.filter((p) => /fetch\(\s*[\w.?]*data[Uu]rl\b|fetch\(\s*["'`]data:/.test(fs.readFileSync(p, 'utf8')));
    expect(bad).toEqual([]);
    // 改坏测试：原来那行写法能被扫描抓到
    expect(/fetch\(\s*[\w.?]*data[Uu]rl\b/.test('await (await fetch(c.dataUrl)).blob()')).toBe(true);
  });

  it('截图等面板藏好最多 300 毫秒：标签页被切走时不会卡住整个采集', () => {
    expect(read('collector.js')).toContain('requestAnimationFrame(r))), sleep(300)])');
  });
});

describe('自动采集守底线', () => {
  const collector = read('collector.js');
  const bg = read('background.js');
  const all = ['background.js', 'collector.js', 'popup.js', 'bridge.js'].map((f) => [f, read(f)] as const);

  it('只在编导发起后开始：面板按钮、插件窗口按钮、开物里粘贴链接', () => {
    const starts = collector.match(/startCollect\(/g)?.length ?? 0;
    // 定义 1 处 + 面板按钮、插件窗口消息、粘贴链接自动开始、从头再来各 1 处
    expect(starts).toBe(5);
    expect(collector).toContain("$('start').addEventListener('click'");
    expect(collector).toContain("msg?.type === 'start-collect'");
    expect(collector).toContain('autostart.tabId === (await myTabId())');
    expect(collector).not.toMatch(/setInterval|chrome\.alarms/);
    expect(bg).not.toMatch(/chrome\.alarms|setInterval|chrome\.scripting/);
  });

  it('节奏像人：翻页和换作品之间都随机等一会儿', () => {
    expect(collector).toContain('Math.random()');
    expect(collector.match(/await pause\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('遇到验证码就停下交给编导，不代解；翻页和读评论的每一轮都查', () => {
    expect(collector.match(/if \(captchaShown\(\)\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(collector).toContain('手动完成验证');
    expect(collector).not.toMatch(/captcha[^\n]*\.(click|dispatchEvent)|slider|drag/i);
  });

  it('有上限：作品 60 条、热门作品 3 条、每条评论 20 条，截图加封面 9 张；和开物这边一致', async () => {
    expect(collector).toContain(`const MAX_WORKS = ${COLLECTION_LIMITS.works}`);
    expect(collector).toContain(`const MAX_DETAILS = ${COLLECTION_LIMITS.details}`);
    expect(collector).toContain(`const MAX_COMMENTS = ${COLLECTION_LIMITS.comments}`);
    const { BENCHMARK_LIMITS } = await import('@/lib/benchmark-analysis');
    expect(bg).toContain(`const MAX = ${BENCHMARK_LIMITS.images}`);
    expect(collector).toContain(`const MAX_SHOTS = ${BENCHMARK_LIMITS.images}`);
  });

  it('不碰 Cookie、不调抖音接口：只有后台取封面图会联网，而且只取抖音图片域名', () => {
    for (const [f, src] of all) {
      expect(src, f).not.toMatch(/chrome\.cookies|document\.cookie|XMLHttpRequest|\/aweme\/|webcast/);
      if (f !== 'background.js') expect(src, f).not.toMatch(/\bfetch\(/);
    }
    expect(bg.match(/\bfetch\(/g)?.length).toBe(1);
    expect(bg).toContain("credentials: 'omit'");
    expect(bg).toMatch(/douyinpic\\\.com/);
  });

  it('评论只读正文和点赞数：读评论的那段不碰昵称链接、头像、地区', () => {
    const fn = collector.slice(collector.indexOf('function readComments'), collector.indexOf('async function waitFor'));
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).not.toMatch(/\/user\/|avatar|VAQA49VP|·/);
    expect(fn).toContain('comment-item-info-wrap');
  });

  it('截图只截发起的那个标签页，而且它得在前台：切走了不截，免得截到别的网站', () => {
    expect(bg).toContain('if (!fresh?.active)');
    expect(collector).toContain("document.visibilityState !== 'visible'");
    expect(bg.match(/captureVisibleTab/g)?.length).toBe(1);
  });

  it('权限只多了抖音图片域名（取封面），没有全部网站、标签页、Cookie 这类权限', () => {
    const m = JSON.parse(read('manifest.json'));
    expect([...m.permissions].sort()).toEqual(['activeTab', 'storage', 'unlimitedStorage']);
    expect(m.host_permissions).toEqual(['https://www.douyin.com/*', 'https://*.douyinpic.com/*']);
    expect(m.content_scripts[0]).toMatchObject({ matches: ['https://www.douyin.com/*'], js: ['collector.js'] });
  });

  it('网站上能下载到插件包：打包脚本打出 zip，安装提示指向它（不依赖仓库里那份被忽略的二进制）', () => {
    const out = path.join(os.tmpdir(), `kaiwu-capture-${process.pid}-${Date.now()}.zip`);
    execFileSync(process.execPath, ['scripts/pack-kaiwu-capture.mjs', '--out', out], { cwd: process.cwd(), stdio: 'pipe' });
    const entries = readZip(fs.readFileSync(out));
    fs.rmSync(out, { force: true });
    const names = entries.map((e) => e.name);
    expect(names[0]).toBe('manifest.json');
    for (const required of ['background.js', 'bridge.js', 'collector.js', 'popup.html', 'popup.js']) {
      expect(names).toContain(required);
    }
    // 路径在根上，用正斜杠；套一层目录或反斜杠，Chrome 会说找不到清单
    expect(entries.every((e) => !e.name.includes('\\') && !e.name.includes('/'))).toBe(true);
    const manifest = JSON.parse(entries[0].data.toString('utf8'));
    expect(manifest.version).toBe(JSON.parse(read('manifest.json')).version);
    expect(entries.find((e) => e.name === 'collector.js')!.data.toString('utf8')).toContain('startCollect');
    expect(fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8')).toContain('/kaiwu-capture.zip');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.prebuild).toContain('scripts/pack-kaiwu-capture.mjs');
    expect(pkg.scripts['pack:capture']).toContain('scripts/pack-kaiwu-capture.mjs');
  });

  it('部署不再因为清单里暂时没有插件包就把它从线上删掉，同步前会先打包', () => {
    const prune = fs.readFileSync('scripts/deploy-prune.sh', 'utf8');
    const keep = prune.indexOf('public/kaiwu-capture.zip)');
    const glob = prune.indexOf('public/*');
    expect(keep).toBeGreaterThan(-1);
    expect(glob).toBeGreaterThan(keep); // 更具体的那条写在 public/* 前面，bash 才匹配得到
    const sync = fs.readFileSync('同步到服务器.ps1', 'utf8');
    const packAt = sync.indexOf('node scripts/pack-kaiwu-capture.mjs');
    const manifestAt = sync.indexOf('$manifestLines');
    expect(packAt).toBeGreaterThan(-1);
    expect(manifestAt).toBeGreaterThan(packAt);
    expect(sync).toContain('browser-extension/kaiwu-capture');
    expect(sync).toContain('scripts/pack-kaiwu-capture.mjs');
  });

  it('源码目录不在时沿用已有包；源码和包都没有就失败，不写出半个文件', () => {
    const out = path.join(os.tmpdir(), `kaiwu-keep-${process.pid}.zip`);
    fs.writeFileSync(out, Buffer.from('not-a-zip'));
    const kept = execFileSync(process.execPath, ['scripts/pack-kaiwu-capture.mjs', '--source', path.join(os.tmpdir(), 'no-kaiwu-src'), '--out', out], { encoding: 'utf8' });
    expect(kept).toContain('沿用已有插件包');
    expect(fs.readFileSync(out).toString()).toBe('not-a-zip');
    fs.rmSync(out, { force: true });
    const missing = path.join(os.tmpdir(), `kaiwu-missing-${process.pid}.zip`);
    expect(() => execFileSync(process.execPath, ['scripts/pack-kaiwu-capture.mjs', '--source', path.join(os.tmpdir(), 'no-kaiwu-src'), '--out', missing], { stdio: 'pipe' })).toThrow();
    expect(fs.existsSync(missing)).toBe(false);
  });

  it('manifest 点名的文件不在源码里，打包失败，不写出 zip', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiwu-pack-'));
    fs.cpSync('browser-extension/kaiwu-capture', dir, { recursive: true });
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.options_page = 'no-such.html';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const out = path.join(dir, 'out.zip');
    expect(() => execFileSync(process.execPath, ['scripts/pack-kaiwu-capture.mjs', '--source', dir, '--out', out], { cwd: process.cwd(), stdio: 'pipe' })).toThrow();
    expect(fs.existsSync(out)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('工作台首页能看见「一键采集」（侧边栏那一项叫「对标 & 热点」，光看首页会以为没有）', () => {
    const home = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
    expect(home).toContain('一键采集');
    expect(home).toContain('href="/dashboard/benchmark"');
    expect(fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8')).toContain('href: "/dashboard/benchmark"');
  });
});

/** 读 zip 中央目录并解压，和打包脚本分开写，免得脚本自己说自己是对的 */
function readZip(buf: Buffer): { name: string; data: Buffer }[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是 zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录损坏');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + localNameLen + localExtraLen;
    const payload = buf.subarray(dataOff, dataOff + compSize);
    const data = method === 0 ? Buffer.from(payload) : zlib.inflateRawSync(payload);
    if (data.length !== size) throw new Error(`长度不对: ${name}`);
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      c ^= data[i];
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    if (((c ^ 0xffffffff) >>> 0) !== crc) throw new Error(`校验失败: ${name}`);
    out.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe('开物这边：网页来的数据先校验、限量，再排成拆解材料', () => {
  const raw = {
    url: 'https://www.douyin.com/user/MS4wLjABAAAAabc?from=x',
    profile: { name: '阿杰剪发', header: '阿杰剪发 / 粉丝 / 3.2万 / 县城剪发十年', fans: '3.2万', likes: '41.5万', worksTotal: '212', follows: '12' },
    works: [
      { id: '111', link: 'https://www.douyin.com/video/111', desc: '剪坏了怎么救', likes: '12.3万', pinned: true },
      { id: '222', link: 'https://www.douyin.com/video/222', desc: '学徒第一天', likes: '2300', pinned: false },
      { id: '333', link: 'https://www.douyin.com/video/333', desc: '老顾客十年', likes: '1.1万', pinned: false },
      { id: 'abc', link: 'javascript:alert(1)', desc: '坏数据', likes: '1' },
    ],
    details: [{
      id: '111', link: 'https://www.douyin.com/video/111', desc: '剪坏了怎么救', likes: '12.3万', comments: '890', collects: '3000', shares: '400', publishedAt: '发布时间：2026-10-20 18:00',
      topComments: [{ text: '我也被剪坏过', likes: '520', nickname: '张三', ip: '河南' }, { text: '', likes: '1' }],
    }],
    collectedAt: '2026-11-02T10:00:00.000Z',
    note: '没登录抖音，只读到主页前面的作品',
  };

  it('抖音的数字读得懂', () => {
    expect(parseCount('17.4万')).toBe(174000);
    expect(parseCount('1.3亿')).toBe(130000000);
    expect(parseCount('2,296')).toBe(2296);
    expect(parseCount('')).toBeNull();
  });

  it('只留白名单字段：评论人昵称、地区这类多出来的字段进不来；坏链接、坏编号丢掉', () => {
    const c = sanitizeCollection(raw)!;
    expect(c.url).toBe('https://www.douyin.com/user/MS4wLjABAAAAabc');
    expect(c.works.map((w) => w.id)).toEqual(['111', '222', '333']);
    expect(c.details[0].topComments).toEqual([{ text: '我也被剪坏过', likes: '520', authorReplied: false, authorLiked: false }]);
    expect(JSON.stringify(c)).not.toMatch(/张三|河南|javascript/);
    expect(c.details[0].publishedAt).toBe('2026-10-20 18:00');
    expect(sanitizeCollection({ foo: 1 })).toBeNull();
    expect(sanitizeCollection('x')).toBeNull();
  });

  it('超量的截断：作品最多 60 条，每条评论最多 20 条', () => {
    const many = { ...raw, works: Array.from({ length: 90 }, (_, i) => ({ id: String(i + 1), link: '', desc: 'x', likes: '1' })), details: [{ ...raw.details[0], topComments: Array.from({ length: 50 }, () => ({ text: '好', likes: '1' })) }] };
    const c = sanitizeCollection(many)!;
    expect(c.works).toHaveLength(COLLECTION_LIMITS.works);
    expect(c.details[0].topComments).toHaveLength(COLLECTION_LIMITS.comments);
  });

  // 11-02 加深：细看 8 条（最火 5 + 点赞最低 2 + 最新 1），多读完整文案、话题、时长，评论 40 条并标作者回过的
  it('插件挑细看的作品：置顶的先看（最多 2 条）、最火的补足 5 条、点赞最低 2 条（对照）、最新 1 条（不算置顶），带上为什么挑中；列表读到 90 条', () => {
    const c = read('collector.js');
    expect(c).toContain('const DETAIL_PICK = { pinned: 2, hot: 5, low: 2, new: 1 };');
    expect(c).toContain("job.works.filter((x) => x.pinned).slice(0, DETAIL_PICK.pinned)) pick.set(w.link, 'pinned')");
    expect(c).toContain('DETAIL_PICK.hot - pick.size');
    expect(c).toContain('const MAX_WORKS = 90;');
    expect(c).toContain("pick.set(w.link, 'low')");
    expect(c).toContain('!x.pinned && !pick.has(x.link)');
    expect(c).toContain("role: job.roles?.[link] ?? 'hot'");
    // 新读的只是页面上显示的东西：文案、话题、视频时长、评论上「作者回复过 / 赞过」的标记
    expect(c).toMatch(/authorReplied: \/作者回复过\//);
    expect(c).toContain("document.querySelector('video')");
  });

  it('新字段也按白名单收：角色只认三种、话题去掉 #、时长只收数字、作者标记只收 true', () => {
    const c = sanitizeCollection({
      ...raw,
      profile: { ...raw.profile, tabs: '作品 212 合集 3 橱窗' },
      details: [
        { ...raw.details[0], role: 'evil', caption: '剪坏了别慌 三招救回来', tags: ['#剪发', '救场'], duration: '47', topComments: [{ text: '求地址', likes: '3', authorReplied: true, authorLiked: 'yes' }] },
        { ...raw.details[0], id: '222', role: 'low', duration: '1分钟' },
      ],
    })!;
    expect(c.profile.tabs).toBe('作品 212 合集 3 橱窗');
    expect(c.details[0]).toMatchObject({ role: 'hot', caption: '剪坏了别慌 三招救回来', tags: ['剪发', '救场'], duration: '47' });
    expect(c.details[0].topComments[0]).toEqual({ text: '求地址', likes: '3', authorReplied: true, authorLiked: false });
    expect(c.details[1]).toMatchObject({ role: 'low', duration: '' });
  });

  it('材料里细看的作品按热门 → 对照 → 最新排，各自编号，写出文案、话题、时长和作者回过的评论', () => {
    const c = sanitizeCollection({
      ...raw,
      details: [
        { ...raw.details[0], id: '9', role: 'new', desc: '最新这条' },
        { ...raw.details[0], id: '8', role: 'low', desc: '没火的', likes: '12' },
        { ...raw.details[0], role: 'hot', caption: '剪坏了别慌', tags: ['剪发'], duration: '75', topComments: [{ text: '在哪', likes: '9', authorReplied: true }] },
      ],
    })!;
    const text = formatCollection(c);
    const hot = text.indexOf('【热门作品｜热门 1】');
    const low = text.indexOf('【点赞偏低的作品（对照）｜对照 1】没火的');
    const fresh = text.indexOf('【最新作品｜最新 1】最新这条');
    expect(hot).toBeGreaterThan(-1);
    expect(low).toBeGreaterThan(hot);
    expect(fresh).toBeGreaterThan(low);
    expect(text).toContain('时长 1 分 15 秒');
    expect(text).toContain('完整文案：剪坏了别慌');
    expect(text).toContain('话题：#剪发');
    expect(text).toContain('- 在哪（9 赞）［作者回复过］');
    expect(text).toContain('作者回复过的 1 条已标出');
    expect(text).not.toMatch(/\n\n\n/);
  });

  it('置顶作品排在最前、编号「置顶 N」；角色白名单认置顶', () => {
    const c = sanitizeCollection({ ...raw, details: [{ ...raw.details[0], role: 'hot' }, { ...raw.details[0], id: '9', role: 'pinned', desc: '我的店' }] })!;
    expect(c.details.map((d) => d.role)).toEqual(['hot', 'pinned']);
    const text = formatCollection(c);
    expect(text.indexOf('【置顶作品｜置顶 1】我的店')).toBeLessThan(text.indexOf('【热门作品｜热门 1】'));
  });

  it('时间跨度：用细看作品（不算置顶）的发布时间和它们在列表里的位置推算覆盖多久；读不出就说读不出', () => {
    const works = Array.from({ length: 60 }, (_, i) => ({ id: String(i + 1), link: '', desc: 'x', likes: '1', pinned: i === 0 }));
    const detail = (id: string, publishedAt: string, role = 'hot') => ({ ...raw.details[0], id, publishedAt, role });
    // 第 2 条 10-30 发，第 31 条 10-01 发：隔 29 条、29 天 → 约每 1 天一条；不算置顶 59 条 → 约 59 天
    const c = sanitizeCollection({ ...raw, works, details: [detail('2', '发布时间：2026-10-30 18:00'), detail('31', '2026-10-01 09:00', 'low'), detail('1', '2025-01-01', 'pinned')] })!;
    expect(coverageEstimate(c)).toEqual({ days: 59, perPost: 1, newest: '2026-10-30' });
    expect(formatCollection(c)).toContain('时间跨度（粗估）：读到的作品大约覆盖最近 59 天，约每 1 天更新一条');
    expect(formatCollection(c)).toContain('不到 3 个月，长期规律要谨慎');
    // 只有一条能用（置顶的不算、相对时间不猜）
    const one = sanitizeCollection({ ...raw, works, details: [detail('2', '3天前'), detail('5', '2026-10-30'), detail('1', '2025-01-01', 'pinned')] })!;
    expect(coverageEstimate(one)).toBeNull();
    expect(formatCollection(one)).toContain('时间跨度：读不出');
  });

  it('报告点名建议上传哪 2 条视频；开物页面开拆时也提醒', () => {
    expect(BENCHMARK_FRAMEWORK).toContain('点名建议编导上传哪 2 条视频');
    expect(fs.readFileSync('components/benchmark/CaptureBridge.tsx', 'utf8')).toContain('把他最火的 2 条视频下载下来，拖进这个账号的拆解区再拆一次');
  });

  it('排成材料：主页信息、点赞概况、带编号的作品清单、热门作品的数据和评论，说明不记评论人', () => {
    const text = formatCollection(sanitizeCollection(raw)!);
    expect(text).toContain('【插件自动采集的账号数据】');
    expect(text).toContain('说明：没登录抖音');
    expect(text).toContain('县城剪发十年');
    expect(text).toContain('中位数 1.1万 赞');
    expect(text).toContain('1. ［置顶］12.3万 赞｜剪坏了怎么救');
    expect(text).toContain('3. 1.1万 赞｜老顾客十年');
    expect(text).toContain('点赞 12.3万，评论 890，收藏 3000，分享 400，发布于 2026-10-20 18:00');
    expect(text).toContain('- 我也被剪坏过（520 赞）');
    expect(text).toContain('不记评论人');
  });
});
