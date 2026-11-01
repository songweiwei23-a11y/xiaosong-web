// 开物对标页上的桥（只在开物的对标页运行）：
// 1. 告诉页面「插件装了」（页面据此决定要不要提示安装）；
// 2. 把插件里存的截图交给页面（window.postMessage，只发给同一个页面），页面收到后回一句，这边清空本机存的截图。
// 页面那边见 components/benchmark/CaptureBridge.tsx。
(async () => {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.setAttribute('data-kaiwu-capture', version);

  const post = (msg) => window.postMessage({ source: 'kaiwu-capture', version, ...msg }, window.location.origin);
  const sendCaptures = async () => {
    const { captures = [] } = await chrome.storage.local.get('captures');
    post({ type: 'captures', captures });
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.source !== 'kaiwu-page') return;
    // 页面渲染好了才会听：页面说 ready 就再报一次到、再交一次截图（页面加载慢时第一次可能没人听）
    if (data.type === 'ready') { post({ type: 'hello' }); await sendCaptures(); }
    if (data.type === 'received') await chrome.storage.local.set({ captures: [] });
  });

  post({ type: 'hello' });
  await sendCaptures();
})();
