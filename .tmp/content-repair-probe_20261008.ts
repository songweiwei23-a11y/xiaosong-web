import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { outputRulesBlock } from '../lib/output-rules';
import { buildContextBlock } from '../lib/creator-context';
import { buildContextBlock as oldContext } from './content-audit-production_20261008/lib/creator-context';
import { buildRemixPrompt } from '../lib/remix';
import { buildRemixPrompt as oldRemix } from './content-audit-production_20261008/lib/remix';
import { buildBriefPrompt } from '../lib/creative-brief';
import { buildBriefPrompt as oldBrief } from './content-audit-production_20261008/lib/creative-brief';
import { buildProfileSummary } from '../lib/profile-summary';
import { reconcileTitleCounts } from '../lib/result-reconciliation';

for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const root='docs/全板块质量修复_20261008';
fs.mkdirSync(root+'/正式模型对照',{recursive:true});
const audit=JSON.parse(fs.readFileSync('docs/全创作板块实测_20261008/正式模型实测.json','utf8'));
const profile=audit.profile;
const ctx:any={profile,positioning:null,dealReasons:[],brief:null};
const oldInput=(id:string)=>fs.readFileSync(`docs/全创作板块实测_20261008/模型原始记录/${id}_输入.txt`,'utf8');
const summary=buildProfileSummary(profile);
const src:any={kind:'paste',industry:'餐饮',title:'虚构测试：点菜先看人数',text:'点菜前，先别急着看招牌。今天拿店里这套餐具看一眼：两个人吃，桌上能摆多少盘；再多点一道，位置还够不够。把自己来几个人、想吃什么记下来。菜喜欢，也得吃得完。'};
const opts:any={layers:['opening','structure','presentation'],count:1,differentiate:'auto',depth:'quick',role:'流量型',duration:'30 秒',outputs:['script','shots','shootPlan'],profileSummary:summary,store:{name:profile.profile_name,lines:['沙发','床','衣柜'],track:'家居家装'},restrictions:profile.content_restrictions,notes:'只借表达机制，不搬运原行业经历；老板一人手机，只用现有样柜做演示，不编尺寸数字或顾客经历。'};
const getAnswer=(id:string)=>audit.results.find((x:any)=>x.id===id)?.answer||'';
const bp={positioningFull:getAnswer('02_positioning')||JSON.parse(fs.readFileSync('docs/全创作板块实测_20261008/账号定位默认快速版实测.json','utf8')).answer,profileSummary:summary,businessPositioning:getAnswer('07_business'),contentPositioning:getAnswer('08_content'),notes:'缺少证据的经营事实和服务承诺必须保持待确认，不要把方案建议写成店铺已经具备的事实。'};
const cases=[
 {id:'future_title_1',board:'标题封面',before:oldInput('21_interview_titles'),after:oldInput('21_interview_titles')+'\n\n'+outputRulesBlock()},
 {id:'future_title_2',board:'标题封面',before:oldInput('21_interview_titles'),after:oldInput('21_interview_titles')+'\n\n'+outputRulesBlock()},
 {id:'knowledge',board:'知识库查询',before:oldInput('06_knowledge'),after:oldInput('06_knowledge').replace(oldContext(ctx,'knowledge'),buildContextBlock(ctx,'knowledge'))},
 {id:'remix_one',board:'跨行业二创',before:oldRemix(src,{...opts,contextBlock:oldContext(ctx,'remix')}),after:buildRemixPrompt(src,{...opts,contextBlock:buildContextBlock(ctx,'remix')})},
 {id:'brief',board:'创作简报',before:oldBrief(bp),after:buildBriefPrompt(bp)+'\n\n'+outputRulesBlock()},
];
const file=root+'/正式模型对照.json';
const report:any=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{startedAt:new Date().toISOString(),scope:'相同正式Dify应用、相同合成材料、前后提示词配对；独立诊断会话，不写客户历史或额度账本；并发最多2，不作为单用户延迟基准',cases:[]};
async function run(c:typeof cases[number],variant:'before'|'after'){
 if(report.cases.some((r:any)=>r.id===c.id&&r.variant===variant))return;
 const query=c[variant];const start=Date.now();const stem=`${root}/正式模型对照/${c.id}_${variant}`;
 fs.writeFileSync(stem+'_输入.txt',query);
 console.log(JSON.stringify({start:c.id,variant,promptChars:query.length}));
 try{
  const r=await askDify(query,`kaiwu-repair-synthetic-20261008-${c.id}-${variant}`,'内容事实边界 创作方法',{signal:AbortSignal.timeout(360000)});
  if(!r.ok)throw Error(r.message);
  const final=c.board==='标题封面'&&variant==='after'?reconcileTitleCounts(r.text):r.text;
  fs.writeFileSync(stem+'_原始输出.md',r.text);fs.writeFileSync(stem+'_交付输出.md',final);
  report.cases.push({id:c.id,board:c.board,variant,ok:true,elapsedMs:Date.now()-start,queryChars:query.length,answer:final,rawAnswer:r.text,completion:r.completion});
 }catch(e){report.cases.push({id:c.id,board:c.board,variant,ok:false,elapsedMs:Date.now()-start,error:(e as Error).message});}
 fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({done:c.id,variant,ok:report.cases.at(-1).ok,elapsedMs:Date.now()-start}));
}
async function main(){for(const c of cases)await Promise.allSettled([run(c,'before'),run(c,'after')]);report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('FINISHED');}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
