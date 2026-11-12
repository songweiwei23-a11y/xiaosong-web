const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const baseDir = 'docs/创作质量同类修复_20261007/';
const names = ['lib/quality-checks.ts', 'lib/script-copy.ts', 'lib/storyboard-standards.ts'];
const manifest = names.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
fs.writeFileSync(baseDir + '检查修复上线文件清单_20261008.json', JSON.stringify({ time: new Date().toISOString(), files: manifest }, null, 2));
const remote = spawnSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','-i','C:/Users/DELL/Desktop/song.pem','ubuntu@122.51.234.155','sha256sum ' + names.map(p => '/var/www/xiaosong-web/' + p).join(' ')], { encoding: 'utf8' });
if (remote.status !== 0) throw Error('Remote hash check failed');
const hashes = new Map(remote.stdout.trim().split(/\r?\n/).map(line => { const [hash,p] = line.trim().split(/\s+/); return [p.replace('/var/www/xiaosong-web/',''),hash]; }));
const files = manifest.map(x => ({ ...x, match: hashes.get(x.file) === x.sha256 }));
async function main() {
  const base = 'https://www.biandao.icu';
  const checks = [];
  for (const route of ['/','/login','/pricing','/api/public/ping']) {
    const r = await fetch(base + route, { signal: AbortSignal.timeout(15000) }); await r.text();
    checks.push({ route, status: r.status, ok: r.status === (route === '/api/public/ping' ? 204 : 200) });
  }
  const r = await fetch(base + '/api/dify/stream', {method:'POST', redirect:'manual', headers:{'content-type':'application/json'}, body:JSON.stringify({taskType:'脚本生成',query:'健康检查，不生成'}),signal:AbortSignal.timeout(15000)});
  const location = r.headers.get('location');
  const gated = r.status === 401 || ([302,303,307,308].includes(r.status) && location && new URL(location,base).pathname === '/login');
  checks.push({route:'/api/dify/stream (unauthenticated)',status:r.status,location,ok:!!gated});
  const report = {time:new Date().toISOString(),base,buildId:'2dKmm1z9LvoB8VWqoO_zl',previousBuildId:'kVnT4uX4YF2SrDANaAwwH',files,checks,pm2:'online; exec cwd /var/www/xiaosong-web (SSH separately verified)',backup:'/var/www/xiaosong-backup-20261008_craft_checks',dify:{publishedVersion:26,contentAcceptancePassed:false},limits:'合成单元/回归测试及公开HTTP检查；未模拟登录后完整网站生成、数据库写入及会员扣费。实验创作规则与两个接口未部署。'};
  fs.writeFileSync(baseDir + '检查修复上线验证_20261008.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify({matched:files.filter(x=>x.match).length,total:files.length,checks}));
  if(files.some(x=>!x.match) || checks.some(x=>!x.ok)) process.exitCode = 1;
}
main().catch(()=>{console.error('Verification failed; credentials not logged');process.exitCode=1;});
