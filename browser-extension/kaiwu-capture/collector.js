// 抖音页面上的开物面板 + 一键采集（2026-11-02 产品方定：可以自动化采集，用户越省事越好）。
// 编导在对标账号的主页上点「一键采集」：自动往下翻、读作品和点赞，再依次打开 8 条作品（最火、点赞偏低、最新）读文案和评论，读完自动带进开物开始拆解。
// 守住的底线：
//   - 只在编导自己打开的主页、自己点了按钮后跑，一次一个账号，读到上限就停；
//   - 节奏像人：每翻一次、每换一条作品都随机等一会儿；
//   - 遇到验证码就停，提示编导自己处理，绝不代解；没登录看不全就照实说明；
//   - 只读页面上显示出来的内容，不调抖音的接口、不碰 Cookie；评论只记文字和点赞数，不记评论人昵称、头像、地区；
//   - 数据只交给开物（存在本机，开物页面收走后清空）。
(() => {
  if (window.top !== window || document.getElementById('kaiwu-guide')) return;

  const MAX_SHOTS = 9; // 和开物对标拆解的截图上限一致
  // 主页列表上没有发布日期，按条数读：90 条够覆盖日更号近 3 个月；实际覆盖多久，开物用细看作品的发布时间推算
  const MAX_WORKS = 90;
  // 细看 8 条：置顶的先看（最多 2 条，他最想让新访客先看到的）+ 最火的补足 5 条 + 点赞最低 2 条（爆款和扑街对照）+ 最新 1 条（看他现在往哪走）
  const MAX_DETAILS = 8;
  const DETAIL_PICK = { pinned: 2, hot: 5, low: 2, new: 1 };
  const MAX_COMMENTS = 40;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pause = (min, max) => sleep(min + Math.random() * (max - min)); // 像人一样，每次等的时间不一样
  const text = (el) => (el?.innerText ?? '').trim();
  const e2e = (k, root = document) => root.querySelector(`[data-e2e="${k}"]`);
  const workKey = (href) => (href || '').match(/\/(video|note)\/(\d+)/);
  const isProfile = () => /^\/user\/[\w-]+/.test(location.pathname) && !/\/user\/self/.test(location.pathname);

  /* ---------- 抖音要求验证、要求登录：停下来交给编导 ---------- */
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40; };
  const CAPTCHA = '抖音要求验证，采集先停了。请你手动完成验证，再点「继续采集」';
  const captchaShown = () => [...document.querySelectorAll('[id*="captcha" i], [class*="captcha" i], iframe[src*="verify"], iframe[src*="captcha"]')].some(visible);

  /* ---------- 截图：交给后台，面板先藏起来；截不了（权限、切走了标签页）就算了，数据照读 ---------- */
  async function shoot() {
    if (document.visibilityState !== 'visible') return false;
    const { captures = [] } = await chrome.storage.local.get('captures');
    if (captures.length >= MAX_SHOTS) return false;
    box.style.visibility = 'hidden';
    // 等面板藏好再截；标签页刚好被切走时浏览器不再画新的一帧，最多等 300 毫秒，不能卡住整个采集
    await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), sleep(300)]);
    const res = await chrome.runtime.sendMessage({ type: 'capture' }).catch(() => null);
    box.style.visibility = 'visible';
    return !!res?.ok;
  }

  /** 往下翻一屏：主页和评论区都是页面里的某个容器在滚，找到它；找不到就滚整页 */
  function scroller(from) {
    for (let el = from; el && el !== document.body; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 10) return el;
    }
    return document.scrollingElement;
  }
  const scrollDown = (from) => scroller(from).scrollBy({ top: Math.round(innerHeight * (0.7 + Math.random() * 0.2)), behavior: 'smooth' });

  /* ---------- 读主页 ---------- */
  function readProfile() {
    const info = e2e('user-info');
    const num = (k, label) => text(e2e(k)).replace(label, '').trim();
    return {
      name: document.title.replace(/\s*[-|–—]\s*抖音.*$/, '').replace(/的抖音$/, '').trim() || text(info).split('\n')[0],
      header: text(info).split('\n').map((s) => s.trim()).filter(Boolean).join(' / ').slice(0, 400),
      follows: num('user-info-follow', '关注'),
      fans: num('user-info-fans', '粉丝'),
      likes: num('user-info-like', '获赞'),
      worksTotal: text(e2e('user-tab-count')),
      tabs: readTabs(),
    };
  }

  /** 主页上「作品 / 合集 / 橱窗 / 喜欢」这一排的文字：看内容怎么分栏、有没有橱窗团购。找不到就空着 */
  function readTabs() {
    let el = e2e('user-tab-count');
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const t = text(el).replace(/\s+/g, ' ');
      if (/作品/.test(t) && /(喜欢|合集|橱窗|商品|收藏|团购|短剧)/.test(t)) return t.slice(0, 160);
    }
    return '';
  }

  function readWorks(found) {
    const list = e2e('user-post-list');
    if (!list) return;
    for (const li of list.querySelectorAll('li')) {
      const a = [...li.querySelectorAll('a[href]')].find((x) => workKey(x.getAttribute('href')));
      const m = a && workKey(a.getAttribute('href'));
      if (!m || found.has(m[2])) continue;
      const lines = text(li).split('\n').map((s) => s.trim()).filter(Boolean);
      const likes = lines.find((s) => /^\d+(\.\d+)?[万亿wW]?$/.test(s)) ?? '';
      const desc = lines.filter((s) => s !== likes && !/^(置顶|共创|图文|合集|直播中)$/.test(s)).join(' ').slice(0, 80);
      const img = li.querySelector('img');
      found.set(m[2], { id: m[2], link: `https://www.douyin.com/${m[1]}/${m[2]}`, desc, likes, pinned: lines.includes('置顶'), cover: img?.currentSrc || img?.src || '' });
    }
  }
  const listEnded = () => /暂时没有更多了|登录后查看更多作品/.test(text(e2e('user-post-list')?.parentElement) || '');
  const needLogin = () => /登录后查看更多作品/.test(document.body.innerText.slice(-4000));

  /* ---------- 读一条作品：四个数、发布时间、评论（只要文字和点赞） ---------- */
  function readComments() {
    const out = [];
    for (const item of document.querySelectorAll('[data-e2e="comment-item"]')) {
      // 评论正文在「昵称那一行」的下一块；昵称、头像、时间地区都不读
      const body = item.querySelector('.comment-item-info-wrap')?.nextElementSibling;
      const t = text(body).replace(/\s+/g, ' ').slice(0, 100);
      if (!t) continue;
      // 抖音在评论上标的「作者回复过」「作者赞过」：看他怎么维护评论区（只记有没有，不记回复内容和评论人）
      const mark = text(item);
      out.push({ text: t, likes: text(item.querySelector('.comment-item-stats-container p span')), authorReplied: /作者回复过/.test(mark), authorLiked: /作者赞过/.test(mark) });
      if (out.length >= MAX_COMMENTS) break;
    }
    return out;
  }

  async function waitFor(check, ms) {
    for (let t = 0; t < ms; t += 500) { if (check()) return true; await sleep(500); }
    return false;
  }

  /* ---------- 采集流程：主页这一段在当前页面跑完；作品要一条条打开，进度存在本机，换了页面接着跑 ---------- */
  const getJob = async () => (await chrome.storage.local.get('job')).job ?? null;
  const setJob = (job) => chrome.storage.local.set({ job });
  const stillRunning = async () => (await getJob())?.status === 'running';
  // 采集认准开始的那个标签页：编导同时开着别的抖音页面，那些页面不接手、也不打断
  const myTabId = () => chrome.runtime.sendMessage({ type: 'tab-id' }).catch(() => null);
  // 按作品编号比，不按整条网址：抖音打开作品时可能在网址后面加参数、图文和视频互相跳，或者转成「某页?modal_id=编号」的弹层
  const atQueued = (job) => {
    const id = workKey(job.queue[0])?.[2];
    return !!id && (workKey(location.pathname)?.[2] === id || new URLSearchParams(location.search).get('modal_id') === id);
  };

  /**
   * kaiwuTabId：从开物页面粘贴链接发起的，采完切回那个开物标签页；
   * purpose：采的是对标账号（benchmark）还是自己的号（self，创作进度「诊断我的账号」）；returnPath：采完回开物的哪一页
   */
  async function startCollect({ kaiwuTabId = null, purpose = 'benchmark', returnPath = null } = {}) {
    if (!isProfile()) return say('先打开账号的抖音主页，再点一键采集');
    if (captchaShown()) return say('抖音要求先验证一下：请你手动完成验证，再点一键采集');
    await chrome.storage.local.set({ captures: [], collection: null });
    const job = { status: 'running', tabId: await myTabId(), kaiwuTabId, purpose, returnPath, url: location.href.split('?')[0], startedAt: new Date().toISOString(), profile: null, works: [], queue: [], details: [], notes: [] };
    await setJob(job);
    render();

    progress('读主页信息');
    await waitFor(() => e2e('user-info') && e2e('user-post-list'), 10000);
    job.profile = readProfile();
    await shoot();

    const found = new Map();
    let idle = 0;
    for (let round = 0; found.size < MAX_WORKS && idle < 3 && round < 30; round++) {
      if (!(await stillRunning())) return; // 编导点了停止
      if (captchaShown()) {
        job.works = [...found.values()].slice(0, MAX_WORKS).map(({ cover, ...w }) => w);
        return stop(job, CAPTCHA, `抖音要求验证，采集提前停了：主页只读到 ${found.size} 条作品，热门作品的评论没读`);
      }
      const before = found.size;
      readWorks(found);
      idle = found.size === before ? idle + 1 : 0;
      progress(`往下翻作品：已读 ${found.size} 条`);
      if (round === 1) await shoot();
      if (listEnded()) break;
      scrollDown(e2e('user-post-list'));
      await pause(1500, 3200);
    }
    if (!(await stillRunning())) return;
    readWorks(found);
    job.works = [...found.values()].slice(0, MAX_WORKS);
    if (needLogin()) job.notes.push('没登录抖音，只读到主页前面的作品；登录后采集能读得更全');
    if (!job.works.length) return halt(job, '没读到作品：可能页面还没加载完，或者抖音改了页面。刷新一下再试');

    const n = (s) => { const m = (s || '').match(/(\d+(?:\.\d+)?)([万亿wW])?/); return m ? Number(m[1]) * (m[2] === '亿' ? 1e8 : m[2] ? 1e4 : 1) : 0; };
    const ranked = [...job.works].sort((a, b) => n(b.likes) - n(a.likes));
    // 点赞最高的 6 条的封面一起带上，拆封面风格和记忆点
    progress('取热门作品的封面');
    await chrome.runtime.sendMessage({ type: 'covers', items: ranked.slice(0, 6).map((w) => ({ src: w.cover, link: w.link, desc: w.desc })) }).catch(() => null);
    job.works = job.works.map(({ cover, ...w }) => w);
    // 挑要细看的：置顶的、最火的（和置顶合起来 5 条）、点赞最低的（读得出点赞的里面挑，做对照）、最新的（主页按时间排，置顶的除外）
    const pick = new Map();
    for (const w of job.works.filter((x) => x.pinned).slice(0, DETAIL_PICK.pinned)) pick.set(w.link, 'pinned');
    for (const w of ranked.filter((x) => !pick.has(x.link)).slice(0, Math.max(0, DETAIL_PICK.hot - pick.size))) pick.set(w.link, 'hot');
    for (const w of ranked.filter((x) => n(x.likes) > 0 && !pick.has(x.link)).slice(-DETAIL_PICK.low).reverse()) pick.set(w.link, 'low');
    for (const w of job.works.filter((x) => !x.pinned && !pick.has(x.link)).slice(0, DETAIL_PICK.new)) pick.set(w.link, 'new');
    job.queue = [...pick.keys()].slice(0, MAX_DETAILS);
    job.roles = Object.fromEntries(pick);
    await setJob(job);
    await nextWork(job);
  }

  async function nextWork(job) {
    if (!job.queue.length) return finish(job);
    progress(`打开热门作品 ${job.details.length + 1} / ${job.details.length + job.queue.length}`);
    await pause(2000, 4000);
    if (!(await stillRunning())) return;
    location.href = job.queue[0];
  }

  async function readWorkPage(job) {
    const link = job.queue[0];
    progress(`读热门作品 ${job.details.length + 1} / ${job.details.length + job.queue.length} 的数据和评论`);
    const partly = () => `抖音要求验证，采集提前停了：热门作品只读了 ${job.details.length} 条的评论`;
    await waitFor(() => e2e('detail-video-info') || captchaShown(), 15000);
    if (captchaShown()) return stop(job, CAPTCHA, partly());
    await waitFor(() => document.querySelector('[data-e2e="comment-item"]'), 10000);
    for (let i = 0; i < 7 && readComments().length < MAX_COMMENTS; i++) {
      if (captchaShown()) return stop(job, CAPTCHA, partly());
      scrollDown(e2e('comment-list') ?? document.body);
      await pause(1200, 2600);
    }
    if (!(await stillRunning())) return;
    await shoot();
    const m = workKey(link);
    const work = job.works.find((w) => w.link === link);
    // 完整文案：作品信息区的标题那一块（读不到标题元素就取信息区第一行），话题单独拎出来
    const info = e2e('detail-video-info');
    const full = text(info?.querySelector('h1') ?? null) || text(info).split('\n')[0] || '';
    const tags = [...new Set([...full.matchAll(/#([^\s#]+)/g)].map((x) => x[1]))].slice(0, 10);
    const video = document.querySelector('video');
    job.details.push({
      id: m?.[2] ?? '',
      link,
      role: job.roles?.[link] ?? 'hot',
      caption: full.replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300),
      tags,
      duration: video && Number.isFinite(video.duration) && video.duration > 0 ? String(Math.round(video.duration)) : '',
      desc: work?.desc || text(info).split('\n')[0].slice(0, 80),
      likes: text(e2e('video-player-digg')),
      comments: text(e2e('feed-comment-icon')),
      collects: text(e2e('video-player-collect')),
      shares: text(e2e('video-player-share')),
      publishedAt: text(e2e('detail-video-publish-time')),
      topComments: readComments(),
    });
    job.queue.shift();
    job.retried = false;
    await setJob(job);
    await nextWork(job);
  }

  // 采集半路停下（抖音要求验证）：已经读到作品，就把读到的先带进开物开始拆，说明里写清楚停在哪，
  // 不让编导卡在抖音页面上；一条作品都没读到，才停在这里等编导处理
  async function stop(job, why, note) {
    if (!job.works.length) return halt(job, why);
    job.notes.push(note);
    return finish(job);
  }

  async function finish(job) {
    const collection = {
      url: job.url,
      profile: job.profile,
      works: job.works,
      details: job.details,
      collectedAt: new Date().toISOString(),
      note: job.notes.join('；'),
      purpose: job.purpose === 'self' ? 'self' : 'benchmark',
    };
    await chrome.storage.local.set({ collection, job: null });
    progress('采集完了，正在带进开物');
    await chrome.runtime.sendMessage({ type: 'open-kaiwu', tabId: job.kaiwuTabId ?? null, returnPath: job.returnPath ?? null });
    render();
  }

  async function halt(job, why) {
    job.status = 'paused';
    job.why = why;
    await setJob(job);
    render();
  }

  async function resume() {
    const job = await getJob();
    if (!job) return render();
    if (captchaShown()) return say('验证还没完成：请先在抖音页面上完成验证');
    job.status = 'running';
    job.why = '';
    await setJob(job);
    if (!job.works.length) { await setJob(null); return startCollect({ kaiwuTabId: job.kaiwuTabId, purpose: job.purpose, returnPath: job.returnPath }); }
    if (job.queue[0] && !atQueued(job)) location.href = job.queue[0];
    else if (job.queue[0]) await readWorkPage(job);
    else await finish(job);
  }

  /* ---------- 面板 ---------- */
  const box = document.createElement('div');
  box.id = 'kaiwu-guide';
  box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:270px;padding:12px 14px;border-radius:12px;background:#fff;color:#1f2328;box-shadow:0 8px 28px rgba(0,0,0,.25);font:13px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif';
  const btn = (k, label, bg) => `<button data-k="${k}" style="display:none;width:100%;margin-top:6px;padding:7px;border:0;border-radius:8px;background:${bg};color:#fff;cursor:pointer;font-size:13px">${label}</button>`;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="font-size:13px">开物 · 拆对标账号</b>
      <span data-k="close" title="收起" style="cursor:pointer;color:#59636e;padding:0 4px">×</span>
    </div>
    <div data-k="tip" style="margin:2px 0 4px;color:#59636e;font-size:12px"></div>
    <div data-k="status" style="font-weight:600;color:#e8590c;font-size:12.5px"></div>
    ${btn('start', '一键采集这个账号', '#e8590c')}
    ${btn('resume', '继续采集', '#e8590c')}
    ${btn('stop', '停止采集', '#8c959f')}
    ${btn('send', '带进开物拆解', '#1f6feb')}
    ${btn('shot', '只截当前屏幕', '#57606a')}
    <div data-k="msg" style="margin-top:6px;font-size:12px;color:#cf222e;min-height:16px"></div>`;
  const $ = (k) => box.querySelector(`[data-k="${k}"]`);
  const show = (k, on) => { $(k).style.display = on ? 'block' : 'none'; };
  const say = (t) => { $('msg').textContent = t || ''; };
  const progress = (t) => { $('status').textContent = t; };

  async function render() {
    const job = await getJob();
    const { captures = [], collection } = await chrome.storage.local.get(['captures', 'collection']);
    const running = job?.status === 'running';
    const paused = job?.status === 'paused';
    if (running) {
      $('tip').textContent = '采集中，页面会自己往下翻、打开作品，请先别动这个标签页。大约 3 分钟。';
    } else if (paused) {
      $('tip').textContent = job.why || '采集停了';
      progress('');
    } else if (isProfile()) {
      $('tip').textContent = '自动往下翻作品、读点赞，再打开 8 条作品（置顶的、最火的、点赞偏低的、最新的）读文案和评论，大约 3 分钟，读完自动带进开物开始拆解。点开始即表示你确认这些是公开可见、可以合法使用的内容。';
      progress(collection ? '上一次采集的还没带进开物' : '');
    } else {
      $('tip').textContent = '打开对标账号的主页，可以一键采集整个账号；在这里也可以只截当前屏幕。';
      progress(captures.length ? `已截 ${captures.length} / ${MAX_SHOTS} 张` : '');
    }
    show('start', !running && !paused && isProfile());
    show('resume', paused);
    show('stop', running || paused);
    show('send', !running && !paused && (captures.length > 0 || !!collection));
    show('shot', !running && captures.length < MAX_SHOTS);
  }

  $('close').addEventListener('click', () => box.remove());
  $('start').addEventListener('click', () => { say(''); void startCollect(); });
  $('resume').addEventListener('click', () => { say(''); void resume(); });
  $('stop').addEventListener('click', async () => { await setJob(null); say('已停止'); progress(''); render(); });
  $('send').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-kaiwu' }));
  $('shot').addEventListener('click', async () => {
    say('');
    const ok = await shoot();
    if (!ok) say('没截下来：点浏览器右上角的开物图标再截，或按 Alt+Shift+K');
    render();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'captured') render();
    if (msg?.type === 'start-collect') void startCollect();
  });
  chrome.storage.onChanged.addListener((changes) => { if (changes.captures || changes.collection) render(); });

  document.documentElement.appendChild(box);
  void (async () => {
    await render();
    // 开物页面上粘贴链接打开的这个标签页：到了主页就自动开始；粘贴的是作品链接，先跳到作者主页
    const { autostart } = await chrome.storage.local.get('autostart');
    if (autostart && Date.now() - autostart.at < 3 * 60 * 1000 && autostart.tabId === (await myTabId())) {
      if (isProfile()) {
        await chrome.storage.local.remove('autostart');
        await waitFor(() => e2e('user-post-list'), 10000);
        return startCollect({ kaiwuTabId: autostart.kaiwuTabId, purpose: autostart.purpose, returnPath: autostart.returnPath });
      }
      const author = () => {
        const a = [...document.querySelectorAll('[data-e2e="user-info"] a[href*="/user/"], [data-e2e="video-author-avatar"] a[href*="/user/"]')][0];
        return a ? new URL(a.getAttribute('href'), location.href).href : '';
      };
      if (workKey(location.pathname) && (await waitFor(author, 10000))) { location.href = author(); return; }
      await chrome.storage.local.remove('autostart');
      return say('这个链接打开的不是账号主页：请在开物里粘贴对标账号主页的链接');
    }

    // 换到下一条作品后接着跑；不是开始采集的那个标签页就不管
    const job = await getJob();
    if (!job || job.status !== 'running' || (job.tabId != null && job.tabId !== (await myTabId()))) return;
    if (atQueued(job)) return readWorkPage(job);
    if (!job.works.length) return halt(job, '采集停了：主页读到一半页面被换走了。点「继续采集」从头再来');
    if (!job.queue.length) return finish(job);
    // 打开的不是排着的那条作品（抖音跳去了别的页面，或者页面被点走了）：再打开一次；还不对就跳过这条接着读，
    // 不停在半路等编导
    if (!job.retried) {
      job.retried = true;
      await setJob(job);
      location.href = job.queue[0];
      return;
    }
    job.retried = false;
    job.notes.push('有一条热门作品没打开，跳过了');
    job.queue.shift();
    await setJob(job);
    await nextWork(job);
  })();
})();
