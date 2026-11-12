const fs = require('node:fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
(async()=>{
 const checks=[];
 const info=await fetch((process.env.DIFY_BASE_URL||'https://api.dify.ai/v1')+'/info',{headers:{Authorization:'Bearer '+process.env.DIFY_API_KEY},signal:AbortSignal.timeout(30000)});
 const ij=await info.json();checks.push({name:'网站Dify绑定应用',appName:ij.name,status:info.status,passed:info.ok&&ij.name==='开物'});
 const p=await fetch((process.env.DIFY_BASE_URL||'https://api.dify.ai/v1')+'/parameters',{headers:{Authorization:'Bearer '+process.env.DIFY_API_KEY},signal:AbortSignal.timeout(30000)});
 const j=await p.json();checks.push({name:'正式Dify六图片和文档附件',status:p.status,limit:j.file_upload?.number_limits,passed:p.ok&&j.file_upload?.enabled===true&&j.file_upload?.number_limits===6});
 for(const [path,method,expected] of [['/login','GET',200],['/api/public/ping','GET',204],['/api/dify/chat','POST',401]]){
  const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),redirect:'manual',signal:AbortSignal.timeout(30000)});
  checks.push({name:path,status:r.status,passed:r.status===expected});
 }
 const out={time:new Date().toISOString(),checks};fs.writeFileSync('/tmp/free-chat-release-health_20261007.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));if(checks.some(c=>!c.passed))process.exitCode=1;
})().catch(e=>{console.error(e.name);process.exitCode=1;});
