import fs from 'node:fs';
import {askDify} from '../lib/dify-task';
import {boundedRepairPrompt,boundedResultIssues} from '../lib/bounded-result-check';
import {reconcileTitleCounts} from '../lib/result-reconciliation';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const root='docs/全板块质量修复_20261008';
const intent=JSON.parse(fs.readFileSync('docs/全创作板块实测_20261008/正式模型实测.json','utf8')).fixtures.streetIntent;
async function run(n:number){
 const stem=`${root}/正式模型对照/future_title_${n}_after`;
 const candidate=fs.readFileSync(stem+'_交付输出.md','utf8');
 const query=fs.readFileSync(stem+'_输入.txt','utf8');
 const issues=boundedResultIssues(candidate,'标题封面',3,intent);
 const prompt=boundedRepairPrompt(query,candidate,issues,intent);fs.writeFileSync(stem+'_事实复核分支输入.txt',prompt);
 const start=Date.now();
 const r=await askDify(prompt,`kaiwu-repair-synthetic-20261008-title-verify-${n}`,'采访计划 标题校对',{signal:AbortSignal.timeout(180000)});
 if(!r.ok){fs.writeFileSync(stem+'_事实复核分支结果.json',JSON.stringify({ok:false,error:r.message}));return;}
 const text=reconcileTitleCounts(r.text);fs.writeFileSync(stem+'_事实复核分支输出.md',text);
 const remaining=boundedResultIssues(text,'标题封面',3,intent);
 fs.writeFileSync(stem+'_事实复核分支结果.json',JSON.stringify({ok:remaining.length===0,elapsedMs:Date.now()-start,initialIssues:issues,remaining,completion:r.completion},null,2));
 console.log(JSON.stringify({n,ok:remaining.length===0,elapsedMs:Date.now()-start,remaining}));
}
Promise.allSettled([run(1),run(2)]).then(rs=>{for(const r of rs)if(r.status==='rejected')console.error(String(r.reason));});
