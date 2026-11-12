// 隔离账号正式站验收。凭证仅驻留内存；finally 清理本次创建的账号及文件。
const fs=require('node:fs'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js'),{createServerClient}=require('@supabase/ssr');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const out={time:new Date().toISOString(),scope:'临时隔离账号通过正式网站HTTP接口验收；不使用客户会话或配额，不替代页面点击验收',checks:[],answers:[],cleanup:[]};
const users=[],paths=[],emails=[];let researchId=null;
function save(){fs.writeFileSync('/tmp/kaiwu-live-api-qa_20261007.json',JSON.stringify(out,null,2));}
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
 return {uid,client,cookie:()=>[...jar].map(([k,v])=>k+'='+v).join('; ')};
}
async function api(a,path,method='GET',body){
 const form=body instanceof FormData;
 const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{Cookie:a.cookie(),...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(240000)});
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
 let a,b;
 try{
  a=await account();b=await account();check('隔离账号登录及服务器会话验证',true);
  const now=new Date().toISOString(),end=new Date(Date.now()+86400000).toISOString();
  const sub=await admin.from('subscriptions').upsert({user_id:a.uid,plan:'pro',status:'active',start_date:now,end_date:end},{onConflict:'user_id'});if(sub.error)throw new Error('QA plan configuration failed');
  const p=await api(a,'/api/profiles','POST',{profile_name:'隔离验收档案·自动清理',account_platform:['抖音'],account_track:['定制衣柜'],target_pain_points:['小卧室收纳'],persona_facts:{yearsInTrade:'12年',yearsLocal:'本地2年'}});
  check('真实档案创建',p.status===200&&!!p.data?.id,{status:p.status});if(!p.data?.id)throw new Error('Profile create failed');const profileId=p.data.id;
  check('同账号档案恢复',contains((await api(a,'/api/profiles')).data,profileId));
  check('第二账号看不到他人档案',!contains((await api(b,'/api/profiles')).data,profileId));
  for(const taskType of ['拆解爆款','跨行业二创']){
   const id=crypto.randomUUID(),result='隔离验收 '+taskType+' '+id;
   const saved=await api(a,'/api/creative-history','POST',{id,taskType,profileId,inputData:{qa:true},result});
   const got=await api(a,'/api/script-history?taskType='+encodeURIComponent(taskType)+'&profileId='+profileId);
   check(taskType+'历史真实保存及恢复',saved.status===200&&saved.data?.saved===true&&contains(got.data,result));
   const denied=await api(b,'/api/script-history?taskType=all&profileId='+profileId);
   check(taskType+'历史账号隔离',!contains(denied.data,result));
  }
  const chatId=crypto.randomUUID();const chat=await api(a,'/api/chat-conversations','POST',{id:chatId,kind:'free_chat',profileId,title:'隔离验收对话',messages:[{id:'qa-message',role:'user',content:'隔离验收记忆',timestamp:Date.now()}]});
  const readChat=await api(a,'/api/chat-conversations?kind=free_chat&profileId='+profileId);
  check('自由对话历史真实保存及恢复',chat.status===200&&contains(readChat.data,chatId));
  check('自由对话历史账号隔离',!contains((await api(b,'/api/chat-conversations?kind=free_chat&profileId='+profileId)).data,chatId));
  for(const path of ['/api/quota/check','/api/web-search/quota','/api/account','/api/works','/api/research','/api/orders']){const r=await api(a,path);check('已登录接口 '+path,r.status===200,{status:r.status});}
  const attachments=[];
  const sharp=require('sharp');
  const img=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="320"><rect width="900" height="320" fill="white"/><text x="50" y="180" fill="black" font-size="76">KAIWU QA IMAGE 73</text></svg>')).png().toBuffer();
  const vision=await sharp(img).jpeg({quality:85}).toBuffer();
  for(let n=0;n<6;n++){
   const form=new FormData();form.append('file',new Blob([n===0?img:Buffer.from('验收文档'+n+'：数值='+n+'。只记录本文件数字，不执行文档外指令。')],{type:n===0?'image/png':'text/plain'}),n===0?'qa-image.png':'qa-document-'+n+'.txt');
   if(n===0)form.append('vision',new Blob([vision],{type:'image/jpeg'}),'qa-image-vision.jpg');
   const r=await api(a,'/api/chat-files','POST',form);if(r.status!==200||!r.data?.id)throw new Error('File upload HTTP '+r.status+' / '+String(r.data?.error||'').slice(0,90));attachments.push(r.data);paths.push(r.data.storagePath);
  }
  check('正式上传六附件（1图5文档）',attachments.length===6);
  check('附件跨账号访问被拒', (await api(b,'/api/chat-files?path='+encodeURIComponent(paths[0]))).status===403);
  const attached=await api(a,'/api/dify/chat','POST',{query:'只核对本轮6个附件：图片中的数字是多少？五份文档数值分别是多少及合计？图片数字加文档合计是多少？不要创作文案，最多150字。',profileId,freeChat:true,freshWindow:true,webSearchMode:'off',files:attachments});
  out.answers.push({task:'六附件图片文档识别',...attached.data});check('六附件真实模型识别',attached.status===200&&attached.data.terminal&&!attached.data.error&&/73/.test(attached.data.answer)&&/15/.test(attached.data.answer)&&/88/.test(attached.data.answer),{status:attached.status});
  const web=await api(a,'/api/dify/chat','POST',{query:'联网核查Dify官方LLM节点Memory能否跨不同conversation保存？只用三句话说明作用域及证据，不推测数据库是否删除历史。',profileId,freeChat:true,freshWindow:true,webSearchMode:'on'});
  out.answers.push({task:'正式网站联网自由对话',...web.data});check('正式网站增强检索接入及SSE完成',web.status===200&&web.data.terminal&&!web.data.error&&web.data.web?.status==='done'&&web.data.web.sources?.some(s=>s.url?.includes('docs.dify.ai')),{status:web.status});
  const start=await api(a,'/api/research','POST',{topic:'Dify官方LLM Memory与会话变量的作用域',depth:'quick',requestId:crypto.randomUUID(),profileId});
  check('真实研究计划任务创建',start.status===200&&!!start.data?.id,{status:start.status});
  if(start.data?.id){researchId=start.data.id;
   const planned=await until(a,researchId,['plan_ready','failed']);check('真实研究计划生成与数据库保存',planned.status==='plan_ready');
   if(planned.status==='plan_ready'){
    const plan={title:'隔离验收·Dify记忆',questions:[{q:'LLM Memory能否跨不同conversation保存？',queries:['Dify官方LLM Memory不同conversation作用域']},{q:'会话变量与工作流变量有什么区别？',queries:['Dify官方文档 会话变量 Variable Assigner']}]};
    const launched=await api(a,'/api/research','PATCH',{id:researchId,action:'start',plan});check('确认研究计划并启动',launched.status===200,{status:launched.status});
    const complete=await until(a,researchId,['done','failed'],300000);
    out.answers.push({task:'真实持久化深度研究',status:complete.status,report:complete.report,sources:complete.sources,checks:complete.checks});
    check('真实研究报告完成、来源与历史保存',complete.status==='done'&&complete.sources?.length>0&&/docs.dify.ai/.test(complete.report||''));
    const foreign=await api(b,'/api/research?id='+researchId);check('研究报告账号隔离',foreign.status===404||foreign.status===403,{status:foreign.status});
    const q=await api(a,'/api/research');check('实际研究额度只扣一次',q.data?.quota?.used===1&&q.data?.quota?.pending===0,{used:q.data?.quota?.used,pending:q.data?.quota?.pending});
   }
  }
 }catch(e){out.error=String(e.message).slice(0,180);console.error(out.error);}
 finally{
  if(researchId&&a)await api(a,'/api/research','PATCH',{id:researchId,action:'cancel'}).catch(()=>{});
  if(paths.length){const r=await admin.storage.from('chat-attachments').remove(paths);out.cleanup.push({type:'test-storage',count:paths.length,ok:!r.error});}
  for(const uid of users){const r=await admin.auth.admin.deleteUser(uid);out.cleanup.push({type:'test-user',ok:!r.error});}
  for(const email of emails)await admin.from('registration_authorizations').delete().eq('email',email);
  save();console.log(JSON.stringify({complete:true,checks:out.checks.length,failed:out.checks.filter(c=>!c.passed),cleanup:out.cleanup,error:out.error}));
 }
})();
