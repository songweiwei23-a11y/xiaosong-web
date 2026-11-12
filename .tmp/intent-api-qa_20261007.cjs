// 隔离账号正式站验收。凭证仅驻留内存；finally 清理本次创建的账号及文件。
const fs=require('node:fs'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const out={time:new Date().toISOString(),scope:'临时隔离账号通过正式网站HTTP接口验收；不使用客户会话或配额，不替代页面点击验收',checks:[],answers:[],cleanup:[]};
const users=[],paths=[],emails=[];let researchId=null;
function save(){fs.writeFileSync('/tmp/kaiwu-intent-api_20261007.json',JSON.stringify(out,null,2));}
function check(name,passed,extra={}){out.checks.push({name,passed,...extra});save();console.log(JSON.stringify({name,passed}));}
async function account(){
 const pw=crypto.randomBytes(24).toString('base64url')+'aA7!';
 const email='kaiwu.qa.'+crypto.randomUUID()+'@example.invalid';
 emails.push(email);
 const allowed=await admin.from('registration_authorizations').insert({email});
 if(allowed.error)throw new Error('QA invitation authorization failed');
 const r=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,app_metadata:{kaiwu_qa_tag:'source-release-20261007'}});
 if(r.error||!r.data.user)throw new Error('QA user creation failed: '+(r.error?.code||'unknown')+' / '+(r.error?.message||'').slice(0,100));
 const uid=r.data.user.id;users.push(uid);save();
 const jar=new Map();
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const logged=await client.auth.signInWithPassword({email,password:pw});
 if(logged.error)throw new Error('QA sign in failed');
 return {uid,email,pw,client,cookie:()=>[...jar].map(([k,v])=>k+'='+v).join('; ')};
}
async function api(a,path,method='GET',body){
 const form=body instanceof FormData;
 const r=await fetch((process.env.KAIWU_QA_BASE||'http://127.0.0.1:3000')+path,{method,headers:{Cookie:a.cookie(),...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(240000)});
 if((r.headers.get('content-type')||'').includes('text/event-stream')){
  const text=await r.text();let answer='',terminal=false,web=null,error=null;
  for(const line of text.split('\n')){if(!line.startsWith('data:'))continue;let e;try{e=JSON.parse(line.slice(5));}catch{continue;}
   if(['message','agent_message','text_chunk'].includes(e.event))answer+=e.answer||e.text||'';
   if(e.event==='message_replace')answer=e.answer||answer;
   if(e.event==='message_end'||e.event==='workflow_finished')terminal=true;
   if(e.event==='done')terminal=true;
   if(e.event==='web_search')web=e;
   if(e.event==='error')error=e.message||e.code||'stream error';
  }
  return {status:r.status,data:{answer,terminal,web,error}};
 }
 return {status:r.status,data:await r.json().catch(()=>null)};
}
const contains=(r,v)=>JSON.stringify(r).includes(v);
async function until(a,id,status,ms=240000){const start=Date.now();for(;;){const r=await api(a,'/api/research?id='+id);if(r.status!==200)throw new Error('Research progress HTTP '+r.status);if(status.includes(r.data.status))return r.data;if(Date.now()-start>ms)throw new Error('Research timeout');await new Promise(r=>setTimeout(r,5000));}}
(async()=>{
 if(process.argv[2]==='cleanup'){
  const fixture=JSON.parse(fs.readFileSync('/tmp/kaiwu-intent-browser-fixture_20261007.json','utf8'));
  for(const u of fixture.users){const r=await admin.auth.admin.deleteUser(u);if(r.error)throw new Error('cleanup user failed');}
  for(const email of fixture.emails)await admin.from('registration_authorizations').delete().eq('email',email);
  fs.unlinkSync('/tmp/kaiwu-intent-browser-fixture_20261007.json');console.log('QA_CLEANUP_OK');return;
 }
 let keep=false;
 try{
  const a=await account(),b=await account();
  const p=await api(a,'/api/profiles','POST',{profile_name:'原意承接隔离验收',account_platform:['抖音'],account_track:['知识分享'],target_pain_points:['青年生活选择']});
  if(!p.data?.id)throw new Error('profile create failed');const profileId=p.data.id;
  const root='我要大众讨论返乡选择，不卖课、不推销、不私信、不编造个人经历。';
  const settings={purpose:'流量型',userIntent:root,audience:'县城返乡青年',topic:'返乡选择',notes:'禁止促销与虚构经历'};
  const targets=['breakdown','remix','review','storyboard','topic','script','title','growth','free-chat','positioning','content-positioning','business-positioning','deal-reason','direction','creative-brief'];
  const snapshots=[];
  for(const target of targets){
   const payload={from:'高阶自由对话',target:'/dashboard/'+target,profileId,sourceContent:'## 方案2：返乡选择\n从陪伴父母与工作节奏讨论返乡，结尾问观众怎么看。',originContent:root,settings,intentUpdatedAt:new Date().toISOString(),topic:'返乡选择'};
   const r=await api(a,'/api/creation-sessions','POST',{requestId:crypto.randomUUID(),payload});
   const read=r.data?.id?await api(a,'/api/creation-sessions?id='+r.data.id):null;
   check('数据库完整保存恢复 '+target,r.status===200&&read?.status===200&&read.data.payload.settings.userIntent===root&&read.data.payload.settings.purpose==='流量型');
   if(r.data?.id)snapshots.push({target,...r.data});
  }
  const first=snapshots.find(s=>s.target==='script');
  const denied=await api(b,'/api/creation-sessions?id='+first.id);check('创作快照账号隔离',denied.status===404);
  const mixed=await api(a,'/api/creation-sessions','POST',{requestId:crypto.randomUUID(),payload:{...first.payload,target:'/dashboard/review',settings:{purposeText:'流量型+人设型',userIntent:root},intentUpdatedAt:new Date().toISOString()}});
  const restored=await api(a,'/api/creation-sessions?id='+mixed.data.id);
  check('同作品混合目的不复活旧单一目的',mixed.status===200&&!mixed.data.payload.settings.purpose&&restored.data.payload.settings.purposeText==='流量型+人设型'&&restored.data.payload.settings.purpose===null);
  const oldScript=await api(a,'/api/creation-sessions','POST',{requestId:crypto.randomUUID(),payload:{...mixed.data.payload,target:'/dashboard/title',settings:{...settings,workingScript:'旧稿A',openingLine:'旧开头'}}});
  const reset=await api(a,'/api/creation-sessions','POST',{requestId:crypto.randomUUID(),payload:{...oldScript.data.payload,target:'/dashboard/script',settings}});
  check('数据库不会合并回来已清除旧脚本',reset.status===200&&!reset.data.payload.settings.workingScript&&!reset.data.payload.settings.openingLine);
  const historyId=crypto.randomUUID();
  await api(a,'/api/creative-history','POST',{id:historyId,taskType:'脚本生成',profileId,inputData:{profileId,creationSettings:settings,originContent:root},result:'原意承接验收稿：返乡选择'});
  const detail=await api(a,'/api/library/outputs?id='+historyId);check('全部产出保留生成时的原意',detail.status===200&&detail.data.creationContext.settings.userIntent===root&&detail.data.creationContext.originContent===root);
  const favorite=await api(a,'/api/library','POST',{profileId,items:[{title:'返乡讨论方案',content:'返乡选择：陪伴与节奏',category:'script',source:'自由对话',creationContext:{settings,originContent:root}}]});
  const lib=await api(a,'/api/library?profileId='+profileId);const item=lib.data?.items?.[0];const full=item?await api(a,'/api/library?id='+item.id):null;
  check('收藏再打开仍保留原意',favorite.status===200&&full?.data?.fields?.creationContext?.settings?.userIntent===root);
  const chatId=crypto.randomUUID();const body='### 方案1：卖课获客\n讨论课程转化。\n\n### 方案2：返乡选择\n视频目的：流量型\n目标人群：县城返乡青年\n从陪伴父母与工作节奏讨论返乡，结尾问观众怎么看。';
  const chat=await api(a,'/api/chat-conversations','POST',{id:chatId,kind:'free_chat',profileId,title:'隔离验收·只选方案2',messages:[{id:'u',role:'user',content:root,timestamp:Date.now(),creationSettings:settings},{id:'a',role:'assistant',content:body,timestamp:Date.now()+1,creationSettings:settings}]});
  check('页面验收会话创建',chat.status===200);
  await admin.from('subscriptions').upsert({user_id:a.uid,plan:'pro',status:'active',start_date:new Date().toISOString(),end_date:new Date(Date.now()+86400000).toISOString()},{onConflict:'user_id'});
  fs.writeFileSync('/tmp/kaiwu-intent-browser-fixture_20261007.json',JSON.stringify({email:a.email,password:a.pw,profileId,chatId,users,emails,snapshots},null,2),{mode:0o600});
  keep=true;
 }catch(e){out.error=e.message;console.error(out.error);}
 finally{if(!keep){for(const uid of users)await admin.auth.admin.deleteUser(uid);for(const email of emails)await admin.from('registration_authorizations').delete().eq('email',email);}save();console.log(JSON.stringify({complete:true,checks:out.checks.length,failed:out.checks.filter(c=>!c.passed),error:out.error}));}
})().catch(e=>{console.error(e.name);process.exitCode=1;});
