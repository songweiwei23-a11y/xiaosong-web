import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { buildActualTopicPrompt, fixture } from './topic-quality-prompt_20261007';
import { unsupportedFacts } from '../lib/quality-checks';
import { buildFactFixContext } from '../lib/fact-fix';
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{autoRefreshToken:false,persistSession:false}});
const report:any={time:new Date().toISOString(),scope:'正式站临时隔离账号，真实选题页面提示词，保留旧标题的情况下落实已选方向；不使用客户历史或会员账本',checks:[],answer:'',cleanup:[]};
const out='/tmp/kaiwu-topic-quality-live_20261007.json';
let uid:string|undefined, email:string|undefined;
const jar=new Map<string,string>();
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2));
function check(name:string,passed:boolean,extra:any={}) {report.checks.push({name,passed,...extra});save();console.log(JSON.stringify({name,passed}));}
async function api(path:string,method='GET',body?:any) {
  const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(300000)});
  if(r.headers.get('content-type')?.includes('text/event-stream')) {
    let answer='',terminal=false,error:string|undefined;
    const text=await r.text();
    for(const line of text.split('\n')) {
      if(!line.startsWith('data: '))continue;
      let e:any;try{e=JSON.parse(line.slice(6));}catch{continue;}
      if(e.event==='message_replace')answer=e.answer||answer;
      else if(typeof e.answer==='string')answer+=e.answer;
      if(e.event==='result'&&typeof e.text==='string'){answer=e.text;terminal=true;}
      if(e.event==='message_end')terminal=true;
      if(e.event==='error')error=e.message||'stream error';
    }
    return {status:r.status,data:{answer,terminal,error}};
  }
  return {status:r.status,data:await r.json().catch(()=>null)};
}
(async()=>{
  try {
    email='kaiwu.qa.'+crypto.randomUUID()+'@example.invalid';
    const password=crypto.randomBytes(24).toString('base64url')+'aA7!';
    const permit=await admin.from('registration_authorizations').insert({email});
    if(permit.error)throw Error('QA permit failed');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{kaiwu_qa_tag:'topic-quality-20261007'}});
    if(created.error||!created.data.user)throw Error('QA create failed');
    uid=created.data.user.id;
    const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
    const logged=await client.auth.signInWithPassword({email,password});
    if(logged.error)throw Error('QA login failed');
    check('隔离账号正常登录',true);
    const profile=await api('/api/profiles','POST',{profile_name:'选题成熟度隔离验收',account_platform:['抖音'],account_track:['短视频编导'],equipment:['手机','领夹麦'],team_size:'一人全包'});
    if(!profile.data?.id)throw Error('QA profile failed');
    const profileId=profile.data.id;
    const ctx:any={...fixture(),topicCount:2};
    const input={profile_id:profileId,sourceReference:ctx.sourceReference,personalRequirement:ctx.personalRequirement,keywords:ctx.keyword1,topicCount:2,topicRole:'流量型',platforms:'抖音',tracks:'短视频编导',creationSettings:ctx.currentSettings};
    const seed=await api('/api/topics','POST',{input_data:input,result:'## 选题1：国庆前后门店客流对比\n旧草稿，尚未拍摄。\n## 选题2：老板说忙与闲的真实感受\n旧草稿，尚未拍摄。'});
    check('保留相似历史草稿作为复现场景',seed.status===200);
    const query=buildActualTopicPrompt('app/dashboard/topic/page.tsx','lib/topic-library.ts',ctx,[],false);
    const start=Date.now();
    const result=await api('/api/dify/stream','POST',{taskType:'选题策划',profileId,query,inputs:input,creationSettings:ctx.currentSettings});
    report.answer=result.data.answer||'';report.elapsedMs=Date.now()-start;save();
    check('正式选题接口完整结束',result.status===200&&result.data.terminal&&!result.data.error,{http:result.status,answerChars:report.answer.length});
    if(!report.answer)throw Error('Empty generation');
    const issues=unsupportedFacts(report.answer,ctx.currentSettings.userIntent);
    report.factIssues=issues;save();
    if(issues.length) {
      const fix=await api('/api/fact-fix','POST',{text:report.answer,issues,context:buildFactFixContext({originContent:ctx.currentSettings.userIntent,settings:ctx.currentSettings}),auto:true,taskType:'选题策划'});
      report.fixedAnswer=fix.data.answer||'';report.remainingFactIssues=unsupportedFacts(report.fixedAnswer,ctx.currentSettings.userIntent);save();
      check('已有自动修正接口处理假采访开头',fix.status===200&&fix.data.terminal&&!!report.fixedAnswer&&!report.remainingFactIssues.some((i:string)=>i.startsWith('采访经历')),{http:fix.status});
    }
    const saved=await api('/api/topics','POST',{input_data:input,result:report.answer});
    const read=await api('/api/topics?profileId='+encodeURIComponent(profileId));
    check('本轮方案与原意保存恢复',saved.status===200&&Array.isArray(read.data)&&read.data.some((r:any)=>r.id===saved.data.id&&r.input_data.creationSettings.userIntent===ctx.currentSettings.userIntent&&r.result===report.answer));
    check('历史旧草稿仍保留',Array.isArray(read.data)&&read.data.some((r:any)=>r.id===seed.data.id));
    check('访谈主问题与前后比较仍在方案中',/主问题/.test(report.answer)&&/国庆/.test(report.answer)&&/比|变化/.test(report.answer)&&/追问/.test(report.answer));
  } catch(error) {
    report.error=(error as Error).message;save();console.error('QA error: '+report.error);process.exitCode=1;
  } finally {
    if(uid){const deleted=await admin.auth.admin.deleteUser(uid);report.cleanup.push({what:'本次隔离测试账号',ok:!deleted.error});}
    if(email){const removed=await admin.from('registration_authorizations').delete().eq('email',email);report.cleanup.push({what:'本次临时注册许可',ok:!removed.error});}
    save();console.log(JSON.stringify({cleanup:report.cleanup,failed:report.checks.filter((c:any)=>!c.passed).map((c:any)=>c.name)}));
  }
})();

