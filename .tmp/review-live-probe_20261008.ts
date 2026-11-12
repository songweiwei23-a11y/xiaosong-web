import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { reviewVerificationPrompt, reconcileReviewSpeechStats, combinedReviewUsage } from '../lib/review-verification';
import { extractPlainCopy } from '../lib/script-copy';
import { estimateSpeechStats } from '../lib/script-result-utils';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }
const dir='.tmp/quality-regression_20261008';
const input=JSON.parse(fs.readFileSync(dir+'/owner-review-history.private.json','utf8'))[0].input_data;
const report={time:new Date().toISOString(),scope:'正式Dify第27版，实际原稿，30秒和90秒两种明确时长对照；不代表用户已确认时长；不写客户历史、不修改成功次数账本',results:[] as any[]};
function save(){fs.writeFileSync(dir+'/live-release-model.private.json',JSON.stringify(report,null,2));}
async function run(id:string,duration:string) {
 const start=Date.now(); console.log(JSON.stringify({id,started:true}));
 try {
  const draft=await askDify(fs.readFileSync(dir+'/'+id+'-prompt.private.txt','utf8'),'kaiwu-review-release-20261008-'+id,fs.readFileSync(dir+'/'+id+'-search.private.txt','utf8'),{signal:AbortSignal.timeout(300000)});
  if(!draft.ok)throw Error(draft.message);
  console.log(JSON.stringify({id,stage:'draft_completed',elapsedMs:Date.now()-start}));
  const check=await askDify(reviewVerificationPrompt(input.draftContent,input.personalRequirements.replace('1-30秒',duration),draft.text),'kaiwu-review-release-20261008-'+id,'审稿 原稿事实校对',{signal:AbortSignal.timeout(180000)});
  if(!check.ok)throw Error(check.message);
  const answer=reconcileReviewSpeechStats(check.text),copy=extractPlainCopy(answer);
  const row={id,ok:true,elapsedMs:Date.now()-start,answer,draftAnswer:draft.text,stats:estimateSpeechStats(copy),usage:combinedReviewUsage(draft.completion.usage??{},check.completion.usage??{}),knownUnsupported:['白萝卜','十二筐','手上的茧','我点点头','我买了一个','3点40','手冻得通红'].filter(x=>answer.includes(x))};
  report.results.push(row);save();
  fs.writeFileSync(dir+'/live-'+id+'-answer.private.md',answer); fs.writeFileSync(dir+'/live-'+id+'-copy.private.txt',copy);
  console.log(JSON.stringify({...row,answer:undefined,draftAnswer:undefined,usage:row.usage}));
 }catch(e){report.results.push({id,ok:false,error:(e as Error).message,elapsedMs:Date.now()-start});save();console.log(JSON.stringify({id,ok:false,error:(e as Error).name}));}
}
async function control(){const r=await askDify('【高阶自由对话】请把这句话翻译成英文：天亮之前，这条街必须是干净的。只给译文。','kaiwu-review-release-20261008-freechat-control','');report.results.push({id:'freechat_control',ok:r.ok,answer:r.ok?r.text:'',usage:r.ok?r.completion.usage:{}});save();console.log(JSON.stringify({id:'freechat_control',ok:r.ok,answer:r.ok?r.text:''}));}
Promise.allSettled([run('explicit90','1分30秒'),run('explicit30','30秒以内'),control()]).then(()=>save());
