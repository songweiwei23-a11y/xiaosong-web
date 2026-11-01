// 开物对标页上的桥（只在开物的对标页运行）：
// 1. 告诉页面「插件装了」（页面据此决定要不要提示安装）；
// 2. 把插件里存的截图和一键采集的数据交给页面（window.postMessage，只发给同一个页面），页面收到后回一句，这边清空本机存的。
// 页面那边见 components/benchmark/CaptureBridge.tsx。
(async () => {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.setAttribute('data-kaiwu-capture', version);

  const post = (msg) => window.postMessage({ source: 'kaiwu-capture', version, ...msg }, window.location.origin);
  const sendCaptures = async () => {
    const { captures = [], collection = null } = await chrome.storage.local.get(['captures', 'collection']);
    post({ type: 'captures', captures, collection });
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.source !== 'kaiwu-page') return;
    // 页面渲染好了才会听：页面说 ready 就再报一次到、再交一次（页面加载慢时第一次可能没人听）
    if (data.type === 'ready') { post({ type: 'hello' }); await sendCaptures(); }
    if (data.type === 'received') await chrome.storage.local.set({ captures: [], collection: null });
    // 编导在开物里粘贴了主页链接：交给后台去打开、自动采集
    if (data.type === 'collect' && typeof data.url === 'string') await chrome.runtime.sendMessage({ type: 'collect-url', url: data.url });
  });

  // 采集在另一个标签页里跑完：结果一出来就交给这一页，不用刷新
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.collection?.newValue) void sendCaptures();
  });

  post({ type: 'hello' });
  await sendCaptures();
})();
