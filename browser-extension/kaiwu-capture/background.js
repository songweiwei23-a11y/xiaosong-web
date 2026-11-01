// 开物 · 截屏带入的后台：截图只在编导点按钮（面板、插件窗口）或按快捷键时发生，截的是当前标签页看得见的画面。
// 不自动滚动、不打开作品、不读网页内容。截图存在本机 chrome.storage，带进开物后由开物页面清空。
const MAX = 9; // 和开物对标拆解的截图上限一致（lib/benchmark-analysis 的 BENCHMARK_LIMITS.images）
const KAIWU = 'https://www.biandao.icu/dashboard/benchmark?from=capture';

async function getCaptures() {
  const { captures = [] } = await chrome.storage.local.get('captures');
  return captures;
}

async function setBadge(n) {
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#e8590c' });
}

async function capture(tab) {
  const captures = await getCaptures();
  if (captures.length >= MAX) return { ok: false, count: captures.length, message: `最多 ${MAX} 张，先带进开物` };
  // JPEG 80：一张全屏截图几百 KB，9 张放得下，传到开物也不会太大
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
  captures.push({ dataUrl, url: tab.url || '', title: tab.title || '', at: new Date().toISOString() });
  await chrome.storage.local.set({ captures });
  await setBadge(captures.length);
  return { ok: true, count: captures.length };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg?.type === 'capture') {
      const tab = sender.tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      reply(await capture(tab).catch((e) => ({ ok: false, message: String(e?.message ?? e) })));
    } else if (msg?.type === 'count') {
      reply({ count: (await getCaptures()).length });
    } else if (msg?.type === 'open-kaiwu') {
      await chrome.tabs.create({ url: KAIWU });
      reply({ ok: true });
    } else if (msg?.type === 'clear') {
      await chrome.storage.local.set({ captures: [] });
      await setBadge(0);
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

// 开物页面把截图收走后，桥接脚本会清空存储：角标跟着归零
chrome.storage.onChanged.addListener((changes) => {
  if (changes.captures) void setBadge((changes.captures.newValue ?? []).length);
});
