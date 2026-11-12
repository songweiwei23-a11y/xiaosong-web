import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { buildCreationHandoff } from '../lib/creation-flow';
import { creationBridgePrompt } from '../lib/creation-bridge';
import { creationSettingsBlock } from '../lib/creation-settings';
import { continuationRules } from '../lib/creation-continuation';
import { buildContextBlock } from '../lib/creator-context';
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const root='我想做县城大众讨论，不卖课、不引导到店或私信。主题是年轻人为什么返乡，不编造真人经历或经营数字。结尾问观众怎么看，保留不同观点。';
const settings={purpose:'流量型' as const,userIntent:root,topic:'年轻人为什么返乡',audience:'县城返乡青年',direction:'生活选择与代际观点',notes:'讨论，不做促销'};
const profile={profile_name:'虚构验收·培训店',account_track:['课程培训'],account_platform:['抖音'],target_age:['35-50岁'],unique_selling_point:'培训课程',target_pain_points:['获客'],equipment:['手机']};
const context=buildContextBlock({profile,positioning:null,dealReasons:['课程咨询']},'script');
const cases=[
 {id:'opening_to_script',source:'growth',target:'script',body:'开头：你返乡，是为了生活还是为了逃离？\n视频目的：变现型\n目标人群：装修客户',task:'脚本生成',request:'写完整口播和拍法，最多800字。'},
 {id:'review_to_topic',source:'review',target:'topic',body:'## 优化后的完整脚本\n你返乡，是为了生活还是为了逃离？有的人想离父母近一点，有的人想换一种工作节奏。你怎么看？',task:'选题策划',request:'给3个基于当前稿件的具体选题，每条写承接何处，最多900字。'},
 {id:'remix_to_positioning',source:'remix',target:'content-positioning',body:'## 方案2：返乡讨论\n用父母期待与年轻人选择的反差讨论返乡；视频目的：变现型。',task:'内容定位',request:'分析这个已选方向的受众、内容边界与拍法，最多900字。'},
 {id:'mixed_purpose',source:'remix',target:'script',body:'## 方案2：衣柜测量\n展示老板解释开门空间，再给尺寸咨询入口。',task:'脚本生成',request:'写一条人设与变现结合的短稿，标明两种目的如何体现，最多700字。',settings:{purposeText:'人设型+变现型',userIntent:'建立专业信任并邀请尺寸咨询，两个目的都要保留。',audience:'小卧室业主',topic:'衣柜开门空间'}}
];
(async()=>{const report:any={scope:'正式Dify，合成材料验证承接规则；非全部页面端到端',time:new Date().toISOString(),results:[]};for(let i=0;i<cases.length;i+=2){const rows=await Promise.all(cases.slice(i,i+2).map(async c=>{const p=buildCreationHandoff(c.source,c.target as any,c.body,{originContent:c.settings?.userIntent||root,settings:c.settings||settings});const query=`任务：${c.task}。${c.request}\n${context}\n${creationBridgePrompt(p)}${creationSettingsBlock(p.settings||{})}${['script','topic'].includes(c.target)?continuationRules(c.target as any):''}`;const start=Date.now();const r=await askDify(query,'kaiwu-intent-qa-20261007','',{signal:AbortSignal.timeout(240000)});return {id:c.id,ok:r.ok,answer:r.ok?r.text:'',error:r.ok?null:r.message,elapsedMs:Date.now()-start};}));report.results.push(...rows);fs.writeFileSync('/tmp/kaiwu-intent-model_20261007.json',JSON.stringify(report,null,2));rows.forEach(r=>console.log(JSON.stringify({id:r.id,ok:r.ok,chars:r.answer.length,elapsedMs:r.elapsedMs,error:r.error})));}})().catch(e=>{console.error(e.name);process.exitCode=1;});
