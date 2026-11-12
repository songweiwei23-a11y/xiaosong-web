// Read-only production health audit. Never prints credentials or customer records.
const fs=require('node:fs'),os=require('node:os'),cp=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const out={time:new Date().toISOString(),build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),scope:'read-only metadata, HTTP health and anonymous isolation; no customer content or configuration changes',http:[],db:[],anonymous:[]};
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function count(table,filters=[]){let q=db.from(table).select('*',{count:'exact',head:true});for(const [op,key,value]of filters)q=q[op](key,value);const r=await q;out.db.push({table,filters,count:r.count,error:r.error?{code:r.error.code}:null});}
(async()=>{
 const states=JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'}));out.process=states.filter(p=>p.name==='xiaosong-web').map(p=>({name:p.name,status:p.pm2_env.status,restarts:p.pm2_env.restart_time,uptime:p.pm2_env.pm_uptime,memory:p.monit.memory,cpu:p.monit.cpu}));
 out.host={ramTotal:os.totalmem(),ramFree:os.freemem(),load:os.loadavg(),disk:cp.execFileSync('df',['-h','/'],{encoding:'utf8'}).trim()};
 for(const path of ['/','/login','/pricing','/privacy','/terms','/dashboard','/admin','/api/profiles','/api/library','/api/works','/api/account','/api/admin/stats','/api/research']){
  const started=Date.now();try{const r=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});out.http.push({path,status:r.status,ms:Date.now()-started,location:r.headers.get('location'),cache:r.headers.get('cache-control'),length:(await r.text()).length});}catch(e){out.http.push({path,error:e.name,ms:Date.now()-started});}
 }
 for(const table of ['user_profiles','script_history','works','creation_sessions','material_library','chat_conversations','payment_orders','subscriptions','research_jobs','creation_requests','creation_completion_evidence'])await count(table);
 await count('creation_requests',[['eq','status','pending']]);await count('creation_requests',[['eq','status','pending'],['lt','expires_at',new Date().toISOString()]]);
 await count('research_jobs',[['in','status',['running','writing']],['lt','heartbeat_at',new Date(Date.now()-180000).toISOString()]]);
 await count('payment_orders',[['in','status',['pending','reviewing']]]);
 for(const table of ['user_profiles','script_history','works','creation_sessions','material_library','chat_conversations','payment_orders','subscriptions','user_quotas','research_jobs','creation_requests','creation_completion_evidence']){
  try{const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+table+'?select=*&limit=1',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(15000)});const d=await r.json();out.anonymous.push({table,status:r.status,rows:Array.isArray(d)?d.length:null,error:!Array.isArray(d)?d.code:null});}catch(e){out.anonymous.push({table,error:e.name});}
 }
 fs.writeFileSync('/tmp/commercial-health-live_20261007.json',JSON.stringify(out,null,2),{mode:0o600});console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e.name);process.exitCode=1;});
