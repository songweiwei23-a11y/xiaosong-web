// 看抖音分享短链接跳到哪（只读跳转头，不跟进、不登录）。用法：node .tmp/shortlink-probe.mjs <短链接>
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
let url = process.argv[2];
for (let i = 0; i < 5 && url; i++) {
  const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA_PC } });
  const loc = r.headers.get('location');
  console.log(r.status, url.slice(0, 120), '->', loc ? loc.slice(0, 160) : '(no redirect)');
  url = loc ? new URL(loc, url).href : null;
}
