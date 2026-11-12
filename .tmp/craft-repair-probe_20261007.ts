import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { unsupportedFacts } from '../lib/quality-checks';
import { buildFactFixPrompt, fixTooBig } from '../lib/fact-fix';
import { cleanRewriteOutput } from '../lib/canvas';
import { stripSelfCert } from '../lib/self-cert';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const dir='docs/创作质量同类修复_20261007';
const round=JSON.parse(fs.readFileSync(dir+'/第二轮正式模型验收.json','utf8'));
const goal='国庆前后门店生意对比，问每家老板真实感受，全国实体店老板愿意看和讨论。不卖课，不私信获客。尚未采访，没有实录、数字、已知答案。一人，手机和领夹麦。';
const results:any[]=[];
async function run(id:string){
  const row=round.results.find((r:any)=>r.id===id);
  const text=stripSelfCert(row.answer);const issues=unsupportedFacts(text,goal);
  console.log(JSON.stringify({id,issues:issues.length,started:true}));
  const start=Date.now();
  const answer=await askDify(buildFactFixPrompt({text,issues:issues.slice(0,8),context:goal}),'kaiwu-craft-repair-synthetic-20261007-'+id,'',{signal:AbortSignal.timeout(300000)});
  const fixed=answer.ok?stripSelfCert(cleanRewriteOutput(answer.text)):'';
  const result={id,ok:answer.ok,accepted:answer.ok&&!fixTooBig(text,fixed,issues.slice(0,8)),elapsedMs:Date.now()-start,before:text,issues,after:fixed,remaining:fixed?unsupportedFacts(fixed,goal):[],error:answer.ok?null:answer.message};
  results.push(result);fs.writeFileSync(dir+'/自动修正正式实测.json',JSON.stringify({scope:'正式模型调用；模拟网页实际的检测-修正-改动范围验证，不冒充浏览器交互，不写业务历史',results},null,2));
  console.log(JSON.stringify({id,ok:result.ok,accepted:result.accepted,remaining:result.remaining,elapsedMs:result.elapsedMs}));
}
Promise.all(['direction_single','opening_interview','title_interview'].map(run)).catch(()=>{console.error('repair probe failed; credentials not logged');process.exitCode=1;});
