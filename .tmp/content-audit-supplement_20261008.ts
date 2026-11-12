import fs from 'node:fs';
import { askDify } from './content-audit-production_20261008/lib/dify-task';
import { parseExtraction, buildCheckPrompt, applyCheck } from './content-audit-production_20261008/lib/interview-import';
import { buildContextBlock } from './content-audit-production_20261008/lib/creator-context';
import { buildOpeningPrompt, parseOpenings } from './content-audit-production_20261008/lib/growth-standards';
import { creationSettingsBlock } from './content-audit-production_20261008/lib/creation-settings';
import { buildPositioningPrompt } from './content-audit-production_20261008/lib/positioning-standards';
import { buildQuickOutputSpec } from './content-audit-production_20261008/lib/positioning-sections';
import { buildProfileSummary } from './content-audit-production_20261008/lib/profile-summary';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const dir='docs/全创作板块实测_20261008',base=JSON.parse(fs.readFileSync(dir+'/正式模型实测.json','utf8'));
async function main(){
 if(process.argv[2]==='interview'){
  const row=base.results.find((x:any)=>x.id==='01_interview_extract');const ex=parseExtraction(row.answer,base.fixtures.interviewSource);
  const prompt=buildCheckPrompt(ex,base.fixtures.interviewSource);fs.writeFileSync(dir+'/模型原始记录/01b_interview_check_输入.txt',prompt);
  const start=Date.now();const checked=await askDify(prompt,'kaiwu-platform-audit-synthetic-20261008-interview-check','前采建档 字段证据校对',{signal:AbortSignal.timeout(180000)});if(!checked.ok)throw Error(checked.message);
  const final=applyCheck(ex,checked.text);fs.writeFileSync(dir+'/前采双步提取验收.json',JSON.stringify({elapsedMs:row.elapsedMs+Date.now()-start,firstCallMs:row.elapsedMs,secondCallMs:Date.now()-start,extraction:final,rawCheck:checked.text,usage:checked.completion.usage},null,2));
  console.log(JSON.stringify({checked:true,fields:final.fields.length,flagged:final.fields.filter((x:any)=>x.check?.ok===false)}));
 } else if(process.argv[2]==='positioning'){
  const prompt=buildPositioningPrompt({profileSummary:buildProfileSummary(base.profile),platform:'抖音',restrictions:base.profile.content_restrictions,focus:'full',outputSpec:buildQuickOutputSpec(),additionalNotes:'只基于已提供资料制定可执行方案。经营年限、价格、销量没有确认。'});
  const start=Date.now();const r=await askDify(prompt,'kaiwu-platform-audit-synthetic-20261008-positioning-default-quick','家具实体店 账号定位 人设 用户',{signal:AbortSignal.timeout(300000)});
  const record={scope:'生产页面默认快速版，与首轮完整版300秒超时区分',ok:r.ok,elapsedMs:Date.now()-start,answer:r.ok?r.text:r.message,usage:r.ok?r.completion.usage:{}};
  fs.writeFileSync(dir+'/账号定位默认快速版实测.json',JSON.stringify(record,null,2));fs.writeFileSync(dir+'/模型原始记录/02b_positioning_quick_输入.txt',prompt);if(r.ok)fs.writeFileSync(dir+'/模型原始记录/02b_positioning_quick_输出.md',r.text);console.log(JSON.stringify({...record,answer:undefined,usage:undefined}));
 } else if(process.argv[2]==='opening'){
  const ctx:any={profile:base.profile,positioning:null,dealReasons:[],brief:base.results.find((x:any)=>x.id==='11_brief')?.answer};
  const settings={topic:'买衣柜前先看门与抽屉打开的位置',duration:'30秒',userIntent:base.fixtures.furnitureIntent,audience:'本地装修家庭',device:'手机',personnel:'一人'};
  const prompt=buildOpeningPrompt({topic:settings.topic,contextBlock:buildContextBlock(ctx,'script')+creationSettingsBlock(settings),currentOpening:base.fixtures.rawDraft,count:3});
  const start=Date.now();const r=await askDify(prompt,'kaiwu-platform-audit-synthetic-20261008-opening-correct-context','衣柜开合空间 开篇钩子',{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error(r.message);
  fs.writeFileSync(dir+'/模型原始记录/15b_opening_输入.txt',prompt);fs.writeFileSync(dir+'/模型原始记录/15b_opening_输出.md',r.text);
  fs.writeFileSync(dir+'/开篇实际页面上下文复测.json',JSON.stringify({scope:'按生产growth页面使用script上下文，与初轮误用opening上下文区分，以本次为准',elapsedMs:Date.now()-start,answer:r.text,parsedItems:parseOpenings(r.text).length,usage:r.completion.usage},null,2));console.log(JSON.stringify({ok:true,parsedItems:parseOpenings(r.text).length,elapsedMs:Date.now()-start}));
 }
}
main().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;});
