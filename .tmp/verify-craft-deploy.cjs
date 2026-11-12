const fs=require('fs');
const {spawnSync}=require('child_process');
const manifest=JSON.parse(fs.readFileSync('docs/创作质量同类修复_20261007/上线文件清单.json')).files;
if(!manifest.every(x=>/^(?:lib|app)\/[A-Za-z0-9/.-]+\.tsx?$/.test(x.file)))throw Error('Unexpected path');
const remote=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','-i','C:\\Users\\DELL\\Desktop\\song.pem','ubuntu@122.51.234.155','sha256sum '+manifest.map(x=>'/var/www/xiaosong-web/'+x.file).join(' ')],{encoding:'utf8'});
if(remote.status!==0)throw Error('Remote hash check failed');
const hashes=new Map(remote.stdout.trim().split(/\r?\n/).map(line=>{const [hash,p]=line.trim().split(/\s+/);return [p.replace('/var/www/xiaosong-web/',''),hash];}));
const files=manifest.map(x=>({...x,match:hashes.get(x.file)===x.sha256}));
async function main(){
  // Nginx redirects the IP to this canonical HTTPS origin (observed 301 Location).
  const base='https://www.biandao.icu';
  const checks=[];
  for(const route of ['/','/login','/pricing','/api/public/ping']){
    const r=await fetch(base+route,{signal:AbortSignal.timeout(15000)});await r.text();
    checks.push({route,status:r.status,ok:r.status===(route==='/api/public/ping'?204:200)});
  }
  const protectedResponse=await fetch(base+'/api/dify/stream',{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify({taskType:'脚本生成',query:'健康检查，不生成'}),signal:AbortSignal.timeout(15000)});
  const location=protectedResponse.headers.get('location');
  const protectedOk=protectedResponse.status===401||([302,303,307,308].includes(protectedResponse.status)&&location&&new URL(location,base).pathname==='/login');
  checks.push({route:'/api/dify/stream (unauthenticated)',status:protectedResponse.status,location,ok:!!protectedOk});
  const report={time:new Date().toISOString(),base,buildId:'kVnT4uX4YF2SrDANaAwwH',files,checks,dify:'尚未确认发布系统提示词，不能标为全链路内容验收通过',backup:'/var/www/xiaosong-backup-20261007_craft_quality'};
  fs.writeFileSync('docs/创作质量同类修复_20261007/网页上线验证.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({files:files.length,matched:files.filter(x=>x.match).length,checks}));
  if(files.some(x=>!x.match)||checks.some(x=>!x.ok))process.exitCode=1;
}
main().catch(()=>{console.error('Verification failed, credentials not logged');process.exitCode=1;});
