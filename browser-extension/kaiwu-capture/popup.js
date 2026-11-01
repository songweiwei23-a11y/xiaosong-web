// 插件窗口：一键采集（交给抖音页面上的 collector.js 跑）、截当前屏幕、带进开物、清空。
const MAX = 9;
const $ = (id) => document.getElementById(id);
const say = (t) => { $('msg').textContent = t || ''; };

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

async function render() {
  const { captures = [], collection, job } = await chrome.storage.local.get(['captures', 'collection', 'job']);
  $('count').textContent = String(captures.length);
  $('state').textContent = job?.status === 'running' ? '正在采集，看抖音页面右下角的进度' : job?.status === 'paused' ? (job.why || '采集停了') : collection ? `采集好了：作品 ${collection.works?.length ?? 0} 条，等带进开物` : '';
  $('capture').disabled = captures.length >= MAX;
  $('send').disabled = captures.length === 0 && !collection;
  $('clear').disabled = captures.length === 0 && !collection && !job;
  $('thumbs').replaceChildren(...captures.map((c) => {
    const img = document.createElement('img');
    img.src = c.dataUrl;
    img.title = c.title || c.url;
    return img;
  }));
}

$('collect').addEventListener('click', async () => {
  say('');
  const tab = await activeTab();
  if (!/^https:\/\/www\.douyin\.com\/user\/[\w-]+/.test(tab?.url || '')) return say('先打开对标账号的抖音主页（网页版），再点一键采集');
  await chrome.tabs.sendMessage(tab.id, { type: 'start-collect' }).catch(() => say('抖音页面还没准备好，刷新一下页面再点'));
  window.close();
});
$('capture').addEventListener('click', async () => {
  say('');
  const res = await chrome.runtime.sendMessage({ type: 'capture' }).catch((e) => ({ ok: false, message: String(e) }));
  if (!res?.ok) say(res?.message || '没截下来，再点一次试试');
  await render();
});
$('send').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'open-kaiwu' });
  window.close();
});
$('clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear' });
  say('已清空');
  await render();
});

void render();
