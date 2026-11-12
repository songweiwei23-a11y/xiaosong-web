// 看三家公开热榜的返回格式（只读公开榜单，各请求一次，不登录、不带 Cookie）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const tries = [
  ['weibo', 'https://weibo.com/ajax/side/hotSearch', { referer: 'https://weibo.com/' }],
  ['baidu', 'https://top.baidu.com/board?tab=realtime', {}],
  ['toutiao', 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', { referer: 'https://www.toutiao.com/' }],
];
for (const [name, url, h] of tries) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json,text/html', ...h }, signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    console.log(`\n== ${name} ${r.status} ${t.length} chars`);
    if (name === 'baidu') {
      const m = t.match(/<!--s-data:(.*?)-->/s);
      if (m) { const d = JSON.parse(m[1]); const card = d.data?.cards?.[0]; console.log('keys', Object.keys(d.data || {}), 'cardKeys', card && Object.keys(card)); const items = card?.content || []; console.log(items.length, JSON.stringify(items.slice(0, 2)).slice(0, 600)); }
      else console.log(t.slice(0, 300));
    } else {
      const d = JSON.parse(t);
      const list = name === 'weibo' ? d.data?.realtime : d.data;
      console.log('topKeys', Object.keys(d), 'n', Array.isArray(list) ? list.length : '?');
      console.log(JSON.stringify(Array.isArray(list) ? list.slice(0, 2) : d).slice(0, 700));
    }
  } catch (e) { console.log(`\n== ${name} ERR ${e.message}`); }
}
