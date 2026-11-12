import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { buildPositioningPrompt } from '../lib/positioning-standards';
import { buildQuickOutputSpec } from '../lib/positioning-sections';
import { buildBriefPrompt } from '../lib/creative-brief';
import { buildTitlePrompt } from '../lib/title-standards';
import { buildTextBreakdownPrompt } from '../lib/text-breakdown';
import { buildProfileSummary } from '../lib/profile-summary';
import { buildContextBlock } from '../lib/creator-context';
import { buildSearchQuery } from '../lib/search-query';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const profile={id:'00000000-0000-4000-8000-000000000008',profile_name:'隔离模型验收·清禾柜业',account_platform:['抖音'],account_track:'定制衣柜',account_stage:'刚起号',target_age:['30-50岁'],target_region:['县城'],target_pain_points:'小卧室收纳、担心隐形收费',unique_selling_point:'解释测量与安装边界',equipment:['手机','三脚架'],team_structure:'老板一个人',shooting_location:['店内样柜'],content_restrictions:'禁止编造客户故事、免费服务、价格、未验证的业务和流量效果',persona_facts:{host:'陈姐',yearsInTrade:'从业12年',yearsLocal:'本地2年',mainProducts:'定制衣柜',others:'没有提供售价、经营数据、顾客评价、免费服务政策。'}};
const summary=buildProfileSummary(profile),context=buildContextBlock({profile,positioning:null,dealReasons:[]},'title');
const baseline='陈姐从业12年，在本地居住2年，经营定制衣柜。受众是县城准备装修的小卧室业主。内容在店内样柜拍摄，用手机和三脚架，一人演示测量、开门空间和五金操作。以用户主动私信房间尺寸为咨询入口；没有提供价格、顾客经历、免费政策和经营数据。';
const taskNotes='只使用档案和材料明确事实；未知价格、故事、免费政策不要补造。';
const cases=[
 {task:'账号定位',query:buildPositioningPrompt({profileSummary:summary,platform:'抖音',focus:'full',additionalNotes:taskNotes,restrictions:profile.content_restrictions,outputSpec:buildQuickOutputSpec()})},
 {task:'商业定位',query:buildPositioningPrompt({profileSummary:summary,platform:'抖音',focus:'business',baseline,additionalNotes:taskNotes,restrictions:profile.content_restrictions})},
 {task:'内容定位',query:buildPositioningPrompt({profileSummary:summary,platform:'抖音',focus:'content',baseline,additionalNotes:taskNotes,restrictions:profile.content_restrictions})},
 {task:'创作简报',query:buildBriefPrompt({positioningFull:baseline,profileSummary:summary,notes:taskNotes,taboos:profile.content_restrictions})},
 {task:'标题封面',query:buildTitlePrompt({topic:'小卧室定衣柜前先记三个尺寸',titleTypeLabel:'痛点式',titleFormulaValue:'number-action',titleFormulaLabel:'数字+动作+结果',keywordStrategyLabel:'核心词',keywordStrategyDesc:'保留小卧室衣柜与尺寸',platform:'抖音',targetAudience:'县城准备装修的小卧室业主',count:3,contextBlock:context,sourceContent:'先记墙面净宽、层高和门窗位置，记录之后再比较衣柜方案。没有承诺省钱、收纳倍数、免费服务。'})},
 {task:'拆解爆款',query:buildTextBreakdownPrompt('定小卧室衣柜，先别挑门板颜色。拿张纸记下墙面净宽、层高和门窗位置，再决定怎么开门。想讨论你家的布局，可以私信发尺寸。',context,{topic:'量尺寸再选柜',audience:'县城小卧室业主',platform:'抖音',device:'手机和三脚架',personnel:'一人',scene:'店内样柜',notes:taskNotes})},
];
(async()=>{
 const report:any={time:new Date().toISOString(),scope:'正式Dify调用页面实际提示词构建函数；合成档案，不写网站客户数据，不验证页面交互',results:[]};
 for(let i=0;i<cases.length;i+=2){
  const rows=await Promise.all(cases.slice(i,i+2).map(async c=>{const start=Date.now();try{const r=await askDify(c.query,'kaiwu-extra-board-qa-20261007',buildSearchQuery(c.task,{taskType:c.task},c.query),{signal:AbortSignal.timeout(240000)});return {task:c.task,query:c.query,ok:r.ok,answer:r.ok?r.text:null,error:r.ok?null:r.message,elapsedMs:Date.now()-start};}catch(e){return {task:c.task,query:c.query,ok:false,answer:null,error:(e as Error).name,elapsedMs:Date.now()-start};}}));
  report.results.push(...rows);fs.writeFileSync('/tmp/kaiwu-extra-board-qa_20261007.json',JSON.stringify(report,null,2));rows.forEach(r=>console.log(JSON.stringify({task:r.task,ok:r.ok,seconds:Math.round(r.elapsedMs/1000),chars:r.answer?.length,error:r.error})));
 }
})().catch(e=>{console.error(e.name);process.exitCode=1;});
