import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { reviewVerificationPrompt, reconcileReviewSpeechStats } from '../lib/review-verification';
import { extractPlainCopy } from '../lib/script-copy';
import { estimateSpeechStats } from '../lib/script-result-utils';
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const dir='.tmp/quality-regression_20261008';
const input=JSON.parse(fs.readFileSync(dir+'/owner-review-history.private.json','utf8'))[0].input_data;
const rows:any[]=[];
async function run(id:string,duration:string){
 const start=Date.now();
 const r=await askDify(reviewVerificationPrompt(input.draftContent,input.personalRequirements.replace('1-30秒',duration),fs.readFileSync(dir+'/live-'+id+'-answer.private.md','utf8')),'kaiwu-review-final-audit-20261008-'+id,'审稿 原稿事实校对',{signal:AbortSignal.timeout(180000)});
 if(!r.ok)throw Error(r.message);
 const answer=reconcileReviewSpeechStats(r.text);
 fs.writeFileSync(dir+'/final-'+id+'-answer.private.md',answer);
 fs.writeFileSync(dir+'/final-'+id+'-copy.private.txt',extractPlainCopy(answer));
 const row={id,elapsedMs:Date.now()-start,stats:estimateSpeechStats(extractPlainCopy(answer)),usage:r.completion.usage,knownUnsupported:['白萝卜','十二筐','我点点头','我买了一个','四个场景','删掉环卫工对话'].filter(x=>answer.includes(x))};
 rows.push(row);fs.writeFileSync(dir+'/final-audit-summary.private.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
}
Promise.all([run('explicit90','1分30秒'),run('explicit30','30秒以内')]).catch(e=>{console.error(e.name);process.exitCode=1;});
