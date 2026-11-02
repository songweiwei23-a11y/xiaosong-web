// 开物网站上的桥（开物的每一页都运行：开物是单页应用，从侧边栏点进对标页不会重新加载页面，只挂在对标页上就会漏掉）：
// 1. 告诉页面「插件装了」（页面据此决定要不要提示安装）；
// 2. 把插件里存的截图和一键采集的数据交给收它的那一页（window.postMessage，只发给同一个页面），收到后页面回一句，这边清空本机存的。
//    采的是对标账号就交给对标页，采的是自己的号（0.5.0 起，创作进度「诊断我的账号」）就交给创作进度页；别的页面不交，
//    数据留在插件里，等编导到了那一页（页面会说 ready）再交；
// 3. 采完切回这个标签页时，不在发起采集的那一页就转过去。
// 页面那边见 components/benchmark/CaptureBridge.tsx、components/works/AccountDiagnosis.tsx。
(async () => {
  const version = chrome.runtime.getManifest().version;
  document.documentElement.setAttribute('data-kaiwu-capture', version);

  // 这一页收哪种采集：对标页收对标账号，创作进度页收自己的号
  const acceptHere = () => (location.pathname.startsWith('/dashboard/benchmark') ? 'benchmark' : location.pathname.startsWith('/dashboard/works') ? 'self' : null);
  const post = (msg) => window.postMessage({ source: 'kaiwu-capture', version, ...msg }, window.location.origin);
  const sendCaptures = async () => {
    const accept = acceptHere();
    if (!accept) return;
    const { captures = [], collection = null } = await chrome.storage.local.get(['captures', 'collection']);
    // 没有采集数据、只有截图的，是在对标页用的
    if ((collection?.purpose || 'benchmark') !== accept) return;
    post({ type: 'captures', captures, collection });
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.source !== 'kaiwu-page') return;
    // 页面渲染好了才会听：页面说 ready 就再报一次到、再交一次（页面加载慢、或者从别的页面点进来时，第一次没人听）
    if (data.type === 'ready') { post({ type: 'hello' }); await sendCaptures(); }
    if (data.type === 'received') await chrome.storage.local.set({ captures: [], collection: null });
    // 编导在开物里粘贴了主页链接：交给后台去打开、自动采集；采完回到发起的这一页
    if (data.type === 'collect' && typeof data.url === 'string') {
      await chrome.runtime.sendMessage({ type: 'collect-url', url: data.url, purpose: data.purpose === 'self' ? 'self' : 'benchmark', returnPath: location.pathname });
    }
  });

  // 采集在另一个标签页里跑完：结果一出来就交给这一页，不用刷新
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.collection?.newValue) void sendCaptures();
  });

  // 采完切回这个标签页：编导要是已经点去了开物的别的页面，转到发起采集的那一页（数据存在插件里，那一页一打开就交）
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type !== 'kaiwu-arrive') return;
    reply({ ok: true });
    const back = typeof msg.returnPath === 'string' && /^\/dashboard\/[\w-]+$/.test(msg.returnPath) ? msg.returnPath : '/dashboard/benchmark';
    if (location.pathname !== back) location.assign(`${back}?from=capture`);
  });

  post({ type: 'hello' });
  await sendCaptures();
})();
