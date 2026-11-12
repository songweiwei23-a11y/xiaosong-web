import fs from 'node:fs';
import {askDify} from '../lib/dify-task';
import {boundedRepairPrompt,boundedResultIssues} from '../lib/bounded-result-check';
import {reconcileTitleCounts} from '../lib/result-reconciliation';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const root='docs/全板块质量修复_20261008';
const intent=JSON.parse(fs.readFileSync('docs/全创作板块实测_20261008/正式模型实测.json','utf8')).fixtures.streetIntent;
async function run(id:string,task:string,count:number,candidate:string,query:string,userIntent:string){
 const stem=`${root}/正式模型对照/${id}_最终发布范围`;
 const issues=boundedResultIssues(candidate,task,count,userIntent);
 const prompt=boundedRepairPrompt(query,candidate,issues,userIntent);fs.writeFileSync(stem+'_输入.txt',prompt);const start=Date.now();
 const r=await askDify(prompt,`kaiwu-repair-synthetic-20261008-final-${id}`,'创作交付校对',{signal:AbortSignal.timeout(180000)});
 if(!r.ok){fs.writeFileSync(stem+'_结果.json',JSON.stringify({ok:false,error:r.message}));return;}
 const text=task==='标题封面'?reconcileTitleCounts(r.text):r.text;fs.writeFileSync(stem+'_输出.md',text);
 const remaining=boundedResultIssues(text,task,count,userIntent);
 fs.writeFileSync(stem+'_结果.json',JSON.stringify({ok:remaining.length===0,elapsedMs:Date.now()-start,initialIssues:issues,remaining,completion:r.completion},null,2));
 console.log(JSON.stringify({id,ok:remaining.length===0,elapsedMs:Date.now()-start,remaining}));
}
async function main(){
 await Promise.allSettled([1,2].map(n=>run(`future_title_${n}`,'标题封面',3,fs.readFileSync(`${root}/正式模型对照/future_title_${n}_before_交付输出.md`,'utf8'),fs.readFileSync(`${root}/正式模型对照/future_title_${n}_before_输入.txt`,'utf8'),intent)));
 const remix=fs.readFileSync('docs/全创作板块实测_20261008/网页实测/二创_可见正文.md','utf8').replace(/^方案 ([12])：/gm,'### 方案 $1：');
 await run('remix','跨行业二创',1,remix,fs.readFileSync(`${root}/正式模型对照/remix_one_before_输入.txt`,'utf8'),'只要一个快速方案，一人手机，仅用现有样柜，不编尺寸和顾客经历');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
