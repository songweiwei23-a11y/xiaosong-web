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
 const fixture=JSON.parse(fs.readFileSync('/tmp/kaiwu-intent-browser-fixture_20261007.json','utf8'));
 const jar=new Map(); const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const logged=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});if(logged.error)throw new Error('QA login failed');
 const a={cookie:()=>[...jar].map(([k,v])=>k+'='+v).join('; ')};
 const root='我想根据定位做县城大流量视频，受众全国县城老板和对县城商业好奇的人，不做广告，不编造真实经历。';
 const settings={purpose:'流量型',userIntent:root,topic:'县城大流量',direction:'县城商业',audience:'全国县城老板'};
 const chosen='### 方向1：国庆后的县城消费观察\n借势点：国庆过后的消费变化。\n核心角度：不拍南乐国庆有多热闹，拍国庆后县城老板的真实状态。\n子方向：节日客流与日常回头客的差别；假期后店铺营业状态；县城与大城市消费节奏的对比。\n已有采访和数据请用户提供，不编造5个老板的真实回答。';
 const body=chosen+'\n\n### 方向2：仓颉文化IP\n观察地方文化IP。\n\n### 方向3：万圣节活动指南\n讨论节日活动。';
 const id=crypto.randomUUID(); const response=await api(a,'/api/chat-conversations','POST',{id,kind:'free_chat',profileId:fixture.profileId,title:'隔离验收·国庆后消费观察',messages:[{id:'u-holiday',role:'user',content:root,timestamp:Date.now(),creationSettings:settings},{id:'a-holiday',role:'assistant',content:body,timestamp:Date.now()+1,creationSettings:settings}]});
 if(response.status!==200)throw new Error('QA fixture HTTP '+response.status);
 console.log('HOLIDAY_FIXTURE_OK');
})().catch(e=>{console.error(e.message);process.exitCode=1;});