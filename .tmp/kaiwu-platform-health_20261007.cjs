const fs=require('node:fs');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
(async()=>{
 const began=Date.now(),checks=[];
 const tables=['user_profiles','account_positioning','script_history','chat_conversations','works','creation_sessions','research_jobs','research_sources','research_requests','subscriptions','payment_orders','app_secrets','creator_presets','creator_preferences','launch_plans','interview_imports','creation_requests','web_search_requests'];
 const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY};
 for(const table of tables){
  const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+table+'?select=*&limit=0',{headers,signal:AbortSignal.timeout(15000)});
  checks.push({type:'database-read',table,status:r.status,passed:r.ok});
 }
 const active=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/research_jobs?select=id&status=in.(planning,running,writing)',{headers,signal:AbortSignal.timeout(15000)});
 const jobs=await active.json();checks.push({type:'research-active-tasks',status:active.status,count:Array.isArray(jobs)?jobs.length:null,passed:active.ok});
 const paths=['/api/profiles','/api/positioning','/api/creative-history','/api/script-history','/api/chat-conversations','/api/works','/api/result-versions','/api/research','/api/web-search/quota','/api/account','/api/orders','/api/admin/monitor','/api/admin/health','/api/chat-files','/api/breakdown/upload','/api/breakdown/transcribe'];
 for(const path of paths){
  const post=['/api/creative-history','/api/result-versions','/api/chat-files','/api/breakdown/upload','/api/breakdown/transcribe'].includes(path);
  const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',method:post?'POST':'GET',...(post?{headers:{'Content-Type':'application/json'},body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
  checks.push({type:'unauthorized-api',path,status:r.status,passed:r.status===401||r.status===403});
 }
 const out={time:new Date().toISOString(),scope:'数据库结构可读与未登录接口保护；未验证真实用户读写、RLS隔离或支付成功',elapsedMs:Date.now()-began,checks};
 fs.writeFileSync('/tmp/kaiwu-platform-health_20261007.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.passed),activeResearchJobs:Array.isArray(jobs)?jobs.length:null}));
})().catch(e=>{console.error(e.name);process.exitCode=1;});
