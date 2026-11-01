// 开物 · 截屏带入的后台：截图、取热门作品封面、按开物页面粘贴的链接打开主页、切回开物、清空。
// 一键采集的流程在抖音页面上的 collector.js 里跑，进度存在本机。
// 截图只截发起截图的那个标签页，而且它得是当前看着的那一页：编导切到别的标签页时不截，免得截到别的网站。
const MAX = 9; // 和开物对标拆解的截图上限一致（lib/benchmark-analysis 的 BENCHMARK_LIMITS.images）
const KAIWU = 'https://www.biandao.icu/dashboard/benchmark?from=capture';

async function getCaptures() {
  const { captures = [] } = await chrome.storage.local.get('captures');
  return captures;
}

async function setBadge() {
  const { captures = [], collection } = await chrome.storage.local.get(['captures', 'collection']);
  await chrome.action.setBadgeText({ text: collection ? '✓' : captures.length ? String(captures.length) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#e8590c' });
}

async function capture(tab) {
  const captures = await getCaptures();
  if (captures.length >= MAX) return { ok: false, count: captures.length, message: `最多 ${MAX} 张，先带进开物` };
  const fresh = tab?.id != null ? await chrome.tabs.get(tab.id).catch(() => null) : null;
  if (!fresh?.active) return { ok: false, count: captures.length, message: '这个标签页不在前台，没截' };
  // JPEG 80：一张全屏截图几百 KB，9 张放得下，传到开物也不会太大
  const dataUrl = await chrome.tabs.captureVisibleTab(fresh.windowId, { format: 'jpeg', quality: 80 });
  captures.push({ dataUrl, url: tab.url || fresh.url || '', title: tab.title || fresh.title || '', at: new Date().toISOString() });
  await chrome.storage.local.set({ captures });
  return { ok: true, count: captures.length };
}

// 点赞最高的几条作品的封面：页面上已经显示出来的封面图，从抖音的图片服务器取一份带进开物，拆封面风格用。
// 只取抖音图片域名（douyinpic.com）上的图，放进截图里，总数不超过 MAX
async function fetchCovers(items) {
  const captures = await getCaptures();
  let added = 0;
  for (const it of Array.isArray(items) ? items : []) {
    if (captures.length >= MAX) break;
    const src = String(it?.src || '');
    if (!/^https:\/\/[\w.-]+\.douyinpic\.com\//.test(src)) continue;
    try {
      const res = await fetch(src, { credentials: 'omit' });
      const blob = await res.blob();
      if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(blob.type) || blob.size > 2 * 1024 * 1024) continue;
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      captures.push({ dataUrl, url: String(it.link || ''), title: String(it.desc || ''), kind: 'cover', at: new Date().toISOString() });
      added++;
    } catch { /* 取不到这张就跳过 */ }
  }
  await chrome.storage.local.set({ captures });
  return { ok: true, added };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg?.type === 'capture') {
      const tab = sender.tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      reply(await capture(tab).catch((e) => ({ ok: false, message: String(e?.message ?? e) })));
    } else if (msg?.type === 'tab-id') {
      reply(sender.tab?.id ?? null);
    } else if (msg?.type === 'count') {
      reply({ count: (await getCaptures()).length });
    } else if (msg?.type === 'open-kaiwu') {
      // 从开物粘贴链接发起的：切回原来那个开物标签页（它会自己收数据）；切不回去就新开一个
      const back = msg.tabId != null ? await chrome.tabs.update(msg.tabId, { active: true }).catch(() => null) : null;
      if (back) await chrome.windows.update(back.windowId, { focused: true }).catch(() => {});
      else await chrome.tabs.create({ url: KAIWU });
      reply({ ok: true });
    } else if (msg?.type === 'collect-url') {
      // 开物页面上粘贴的主页链接：只认抖音的链接，新开一个标签页打开，打开后那一页自动开始采集
      const url = String(msg.url || '');
      if (!/^https:\/\/(www\.|v\.)?(douyin|iesdouyin)\.com\//.test(url)) return reply({ ok: false });
      await chrome.storage.local.set({ captures: [], collection: null, job: null });
      const tab = await chrome.tabs.create({ url, active: true });
      await chrome.storage.local.set({ autostart: { tabId: tab.id, kaiwuTabId: sender.tab?.id ?? null, at: Date.now() } });
      reply({ ok: true });
    } else if (msg?.type === 'covers') {
      reply(await fetchCovers(msg.items));
    } else if (msg?.type === 'clear') {
      await chrome.storage.local.set({ captures: [], collection: null, job: null });
      reply({ ok: true });
    }
  })();
  return true; // 异步回复
});

// 快捷键：看到哪一屏按一下就截，不用打开任何窗口
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'capture-screen' || !tab) return;
  const r = await capture(tab).catch(() => null);
  if (r && tab.id) chrome.tabs.sendMessage(tab.id, { type: 'captured', count: r.count }).catch(() => {});
});

// 截图、采集结果有变化（包括开物页面收走后清空）：角标跟着变
chrome.storage.onChanged.addListener((changes) => {
  if (changes.captures || changes.collection) void setBadge();
});
