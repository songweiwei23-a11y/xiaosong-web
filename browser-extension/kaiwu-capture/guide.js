// 抖音页面右下角的开物引导小面板：一步步告诉编导下一步截哪一屏，截图按钮就在面板上。
// 只显示步骤和按钮，不读抖音页面上的任何内容；截图前面板先藏起来，不会被截进去。
(() => {
  if (window.top !== window || document.getElementById('kaiwu-guide')) return;

  const STEPS = [
    { at: 0, title: '第 1 步：截主页第一屏', tip: '头像、简介、粉丝数和获赞数都在画面里，点下面的按钮。' },
    { at: 1, title: '第 2 步：往下翻，截作品列表', tip: '往下翻一屏截一张，能看到作品封面、标题和点赞就行，截 2～4 张。' },
    { at: 4, title: '第 3 步：截一屏评论区', tip: '打开点赞最高的一条作品，把评论区截一屏，看观众在问什么。' },
    { at: 5, title: '截够了，带进开物拆解', tip: '开物会认出这是哪个账号，自动放进它的拆解里。想拆得更细，可以在开物里再传爆款视频。' },
  ];
  const MAX = 9;

  const box = document.createElement('div');
  box.id = 'kaiwu-guide';
  box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:260px;padding:12px 14px;border-radius:12px;background:#fff;color:#1f2328;box-shadow:0 8px 28px rgba(0,0,0,.25);font:13px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="font-size:13px">开物 · 拆对标账号</b>
      <span data-k="close" title="收起" style="cursor:pointer;color:#59636e;padding:0 4px">×</span>
    </div>
    <div data-k="title" style="font-weight:600;color:#e8590c"></div>
    <div data-k="tip" style="margin:4px 0 8px;color:#59636e;font-size:12px"></div>
    <div data-k="count" style="font-size:12px;color:#59636e;margin-bottom:6px"></div>
    <button data-k="shot" style="width:100%;padding:7px;border:0;border-radius:8px;background:#e8590c;color:#fff;cursor:pointer;font-size:13px">截下当前屏幕</button>
    <button data-k="send" style="width:100%;margin-top:6px;padding:7px;border:0;border-radius:8px;background:#1f6feb;color:#fff;cursor:pointer;font-size:13px">带进开物拆解</button>
    <div data-k="msg" style="margin-top:6px;font-size:12px;color:#cf222e;min-height:16px"></div>
    <div style="font-size:11px;color:#8c959f">快捷键 Alt+Shift+K 也能截。只截你点的那一刻看到的画面。</div>`;
  const $ = (k) => box.querySelector(`[data-k="${k}"]`);

  const render = (count) => {
    const step = [...STEPS].reverse().find((s) => count >= s.at) ?? STEPS[0];
    $('title').textContent = step.title;
    $('tip').textContent = step.tip;
    $('count').textContent = `已截 ${count} / ${MAX} 张`;
    $('shot').disabled = count >= MAX;
    $('shot').style.opacity = count >= MAX ? '.45' : '1';
    $('send').style.display = count ? 'block' : 'none';
  };

  $('close').addEventListener('click', () => box.remove());
  $('shot').addEventListener('click', async () => {
    $('msg').textContent = '';
    box.style.visibility = 'hidden';
    // 等面板真的从画面上消失再截
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const res = await chrome.runtime.sendMessage({ type: 'capture' }).catch((e) => ({ ok: false, message: String(e) }));
    box.style.visibility = 'visible';
    if (!res?.ok) $('msg').textContent = res?.message || '没截下来，再点一次试试';
    render(res?.count ?? 0);
  });
  $('send').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-kaiwu' }));

  // 快捷键截完，后台会告诉面板张数
  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === 'captured') render(msg.count); });
  chrome.storage.onChanged.addListener((changes) => { if (changes.captures) render((changes.captures.newValue ?? []).length); });

  document.documentElement.appendChild(box);
  chrome.runtime.sendMessage({ type: 'count' }).then((r) => render(r?.count ?? 0)).catch(() => render(0));
})();
