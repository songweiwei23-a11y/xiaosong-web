// 插件窗口：和抖音页面上的引导面板做同一件事（截图、带进开物、清空），截图都交给后台（background.js）。
const MAX = 9;
const $ = (id) => document.getElementById(id);
const say = (t) => { $('msg').textContent = t || ''; };

async function render() {
  const { captures = [] } = await chrome.storage.local.get('captures');
  $('count').textContent = String(captures.length);
  $('capture').disabled = captures.length >= MAX;
  $('send').disabled = captures.length === 0;
  $('clear').disabled = captures.length === 0;
  $('thumbs').replaceChildren(...captures.map((c) => {
    const img = document.createElement('img');
    img.src = c.dataUrl;
    img.title = c.title || c.url;
    return img;
  }));
}

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
