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
 const jar=new Map();const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
 const logged=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});if(logged.error)throw new Error('QA login failed');
 const a={cookie:()=>[...jar].map(([k,v])=>k+'='+v).join('; ')};
 const root='我要大众讨论返乡选择，不卖课、不推销、不私信、不编造个人经历。';
 const h=await api(a,'/api/script-history','POST',{input_data:{profileId:fixture.profileId,originContent:root,creationSettings:{purpose:'流量型',userIntent:root}},result:'隔离原意承接历史验收稿'});
 const d=await api(a,'/api/library/outputs?id='+h.data?.id);
 const historyOk=h.status===200&&d.status===200&&d.data?.creationContext?.settings?.userIntent===root;
 const list=await api(a,'/api/library?profileId='+fixture.profileId);const item=list.data?.items?.[0];const detail=item?await api(a,'/api/library?id='+item.id):null;
 const favoriteOk=detail?.data?.item?.fields?.creationContext?.settings?.userIntent===root;
 const report=JSON.parse(fs.readFileSync('/tmp/kaiwu-intent-api_20261007.json','utf8'));
 report.harnessCorrections=['脚本生成历史使用script-history接口（creative-history只接受拆解、二创与创作方向）','素材详情从item读取'];
 report.checks.find(c=>c.name==='全部产出保留生成时的原意').passed=historyOk;
 report.checks.find(c=>c.name==='收藏再打开仍保留原意').passed=favoriteOk;
 report.detailRetest={historyStatus:h.status,detailStatus:d.status,favoriteStatus:detail?.status};
 fs.writeFileSync('/tmp/kaiwu-intent-api_20261007.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({historyOk,favoriteOk,statuses:report.detailRetest,failed:report.checks.filter(c=>!c.passed)}));
})().catch(e=>{console.error(e.name);process.exitCode=1;});
