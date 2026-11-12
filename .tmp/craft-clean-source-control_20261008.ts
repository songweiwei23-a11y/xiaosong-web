import fs from 'node:fs';
import { askDify } from '../lib/dify-task';
import { buildTitlePrompt } from '../lib/title-standards';
import { creationSettingsBlock } from '../lib/creation-settings';
import { unsupportedFacts } from '../lib/quality-checks';
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
const goal='我想拍国庆前后门店生意对比，去问每家店老板的真实感受。围绕同一核心问题做成熟、具体、有采访深度的内容，让全国实体店老板愿意看和讨论。不做卖课或代运营获客广告，不编造采访答案。尚未采访，没有账本、收入数字或已知答案。';
const settings={topic:'国庆前后门店生意对比',direction:'同一条街不同门店老板的实际变化与真实感受',userIntent:goal,focusContent:goal,purpose:'流量型' as const,audience:'全国实体店老板及关注县城消费的人',device:'手机和领夹麦',personnel:'一人',openingLine:'国庆前后，这条街上的生意到底有什么变化？'};
const context='合成验收账号：县城编导；一人，手机和领夹麦。账号经营背景不等于本条要推销。'+creationSettingsBlock(settings);
const q=buildTitlePrompt({topic:settings.topic,contextBlock:context,sourceContent:goal,titleTypeLabel:'AI推荐',titleFormulaValue:'auto',titleFormulaLabel:'AI推荐',keywordStrategyLabel:'AI推荐',keywordStrategyDesc:'按原稿与平台',platform:'抖音',targetAudience:settings.audience,count:3});
const dir='docs/创作质量同类修复_20261007/Dify纯计划对照_20261008';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/title-prompt.txt',q);
async function main(){
  const status=JSON.parse(fs.readFileSync('docs/创作质量同类修复_20261007/Dify发布接续检查.json','utf8'));
  if(status.publishedVersion!==26 || !status.liveTemplateAndMappingsVerified)throw Error('Publication not verified');
  console.log(JSON.stringify({started:true,promptChars:q.length,scope:'仅用用户计划替换AI参考稿；正式26，未追加服务端末尾约束，关闭联网，合成账号'}));
  const start=Date.now();const result=await askDify(q,'kaiwu-clean-source-control-20261008-title','标题封面 国庆前后门店生意对比',{signal:AbortSignal.timeout(300000)});
  const report={time:new Date().toISOString(),scope:'正式26，一次纯用户计划的标题对照；不同于前两组，未传入生成的采访稿，未加服务端实验规则，不模拟网站鉴权/账本',ok:result.ok,elapsedMs:Date.now()-start,answer:result.ok?result.text:'',factFlags:result.ok?unsupportedFacts(result.text,goal):[],usage:result.ok?result.completion.usage:{}};
  fs.writeFileSync(dir+'/正式模型对照.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,elapsedMs:report.elapsedMs,answerChars:report.answer.length,factFlags:report.factFlags}));
}
main().catch(()=>{console.error('Control failed; no credentials logged');process.exitCode=1;});
